import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { StoresService } from '../stores/stores.service';
import { LefthandApiService, EmployeeApiData, StoreApiData } from './lefthand-api.service';

export interface SyncLog {
  id: string;
  sync_type: string;
  source_name?: string;
  status: 'started' | 'running' | 'completed' | 'failed' | 'partial';
  started_at: string;
  finished_at?: string;
  total_fetched: number;
  total_created: number;
  total_updated: number;
  total_skipped: number;
  total_failed: number;
  error_message?: string;
  error_details?: Record<string, any>;
  triggered_by?: string;
  trigger_type: string;
  created_at: string;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly SYNC_LOGS_TABLE = 'sync_logs';

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly employeesService: EmployeesService,
    private readonly storesService: StoresService,
    private readonly lefthandApi: LefthandApiService,
  ) {}

  /**
   * 執行員工主檔全量同步（從左手系統 API）
   */
  async syncEmployees(triggeredBy?: string): Promise<SyncLog> {
    const syncLog = await this.createSyncLog('employee_full', 'lefthand_api', triggeredBy);

    try {
      await this.updateSyncLog(syncLog.id, { status: 'running' });

      // 第一步：取得全部員工基本資料
      this.logger.log('Step 1: Fetching all employees...');
      const employeesResult = await this.lefthandApi.getAllEmployees();

      if (!employeesResult.success) {
        throw new Error(`Failed to fetch employees: ${employeesResult.message}`);
      }

      const employees = employeesResult.data;
      this.logger.log(`Fetched ${employees.length} employees from API`);

      if (employees.length === 0) {
        await this.updateSyncLog(syncLog.id, {
          status: 'completed',
          finished_at: new Date().toISOString(),
          total_fetched: 0,
        });
        return this.getSyncLog(syncLog.id);
      }

      // 第二步：取得門市資料（包含更詳細的員工資訊）
      this.logger.log('Step 2: Fetching stores with employee details...');
      const storesResult = await this.lefthandApi.getAllStoresWithEmployees();
      
      // 建立員工詳細資料對照表
      const employeeDetailsMap = new Map<string, any>();
      
      if (storesResult.success) {
        for (const store of storesResult.data) {
          // 同步門市資料
          await this.syncStore(store);
          
          // 收集員工詳細資料
          if (store.employees) {
            for (const emp of store.employees) {
              employeeDetailsMap.set(emp.erpid, {
                store_name: store.name,
                store_erpid: store.erpid,
                region: store.city,
                role: emp.role,
                jobtitle: emp.jobtitle,
              });
            }
          }
        }
      }

      // 第三步：批量 Upsert 員工資料
      this.logger.log('Step 3: Upserting employees to database...');
      const employeesToUpsert = employees.map((emp: EmployeeApiData) => {
        const details = employeeDetailsMap.get(emp.employeeerpid || '') || {};
        
        return {
          employeeappnumber: emp.employeeappnumber,
          employeeerpid: emp.employeeerpid,
          name: emp.employeename,
          role: details.role,
          title: details.jobtitle,
          store_name: details.store_name,
          department: details.region,
          is_active: true,
          is_leave: false,
          source_payload: {
            ...emp,
            ...details,
            synced_at: new Date().toISOString(),
          },
        };
      });

      const result = await this.employeesService.bulkUpsert(employeesToUpsert as any);

      // 更新同步日誌
      await this.updateSyncLog(syncLog.id, {
        status: result.failed > 0 ? 'partial' : 'completed',
        finished_at: new Date().toISOString(),
        total_fetched: employees.length,
        total_created: result.created,
        total_updated: result.updated,
        total_failed: result.failed,
        error_details: result.errors.length > 0 ? { errors: result.errors.slice(0, 10) } : undefined,
      });

      this.logger.log(
        `Employee sync completed: ${result.created} created, ${result.updated} updated, ${result.failed} failed`,
      );

      return this.getSyncLog(syncLog.id);
    } catch (error) {
      this.logger.error('Employee sync failed:', error);

      await this.updateSyncLog(syncLog.id, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: error.message,
      });

      throw error;
    }
  }

  /**
   * 同步單一門市
   */
  private async syncStore(storeData: StoreApiData): Promise<void> {
    try {
      await this.storesService.upsertByErpId({
        store_erp_id: storeData.erpid,
        store_code: storeData.id,
        name: storeData.name,
        region: storeData.city,
        address: storeData.address,
        is_active: true,
        source_payload: {
          phone: storeData.phone,
          worktime: storeData.worktime,
          longitude: storeData.longitude,
          latitude: storeData.latitude,
          coverimage: storeData.coverimage,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to sync store ${storeData.name}:`, error.message);
    }
  }

  /**
   * 執行每日多來源資料同步
   */
  async syncDailyData(triggeredBy?: string): Promise<SyncLog> {
    const syncLog = await this.createSyncLog('external_daily', 'multi_source', triggeredBy);

    try {
      await this.updateSyncLog(syncLog.id, { status: 'running' });

      let totalFetched = 0;
      let totalCreated = 0;
      let totalFailed = 0;
      const errors: any[] = [];

      // 同步各來源
      const sources = ['attendance', 'score', 'review', 'official_channel'];

      for (const source of sources) {
        try {
          const result = await this.syncExternalSource(source);
          totalFetched += result.fetched;
          totalCreated += result.created;
          totalFailed += result.failed;
        } catch (sourceError) {
          this.logger.error(`Failed to sync source ${source}:`, sourceError);
          errors.push({ source, error: sourceError.message });
          totalFailed++;
        }
      }

      // 更新同步日誌
      const status = errors.length === 0 ? 'completed' : errors.length < sources.length ? 'partial' : 'failed';

      await this.updateSyncLog(syncLog.id, {
        status,
        finished_at: new Date().toISOString(),
        total_fetched: totalFetched,
        total_created: totalCreated,
        total_failed: totalFailed,
        error_details: errors.length > 0 ? { errors } : undefined,
      });

      return this.getSyncLog(syncLog.id);
    } catch (error) {
      this.logger.error('Daily sync failed:', error);

      await this.updateSyncLog(syncLog.id, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: error.message,
      });

      throw error;
    }
  }

  /**
   * 同步官方頻道對話
   */
  async syncOfficialChannelConversations(triggeredBy?: string): Promise<{
    fetched: number;
    created: number;
    failed: number;
  }> {
    this.logger.log('Syncing official channel conversations');

    // 預留的整合邏輯
    return { fetched: 0, created: 0, failed: 0 };
  }

  /**
   * 同步外部資料來源
   */
  private async syncExternalSource(source: string): Promise<{
    fetched: number;
    created: number;
    failed: number;
  }> {
    this.logger.log(`Syncing external source: ${source}`);

    // 預留的整合邏輯
    return { fetched: 0, created: 0, failed: 0 };
  }

  /**
   * 建立同步日誌
   */
  private async createSyncLog(
    syncType: string,
    sourceName: string,
    triggeredBy?: string,
  ): Promise<SyncLog> {
    return this.supabase.create<SyncLog>(
      this.SYNC_LOGS_TABLE,
      {
        sync_type: syncType,
        source_name: sourceName,
        status: 'started',
        started_at: new Date().toISOString(),
        total_fetched: 0,
        total_created: 0,
        total_updated: 0,
        total_skipped: 0,
        total_failed: 0,
        triggered_by: triggeredBy,
        trigger_type: triggeredBy ? 'manual' : 'scheduled',
      },
      { useAdmin: true },
    );
  }

  /**
   * 更新同步日誌
   */
  private async updateSyncLog(id: string, data: Partial<SyncLog>): Promise<void> {
    await this.supabase.update(this.SYNC_LOGS_TABLE, { id }, data, { useAdmin: true });
  }

  /**
   * 取得同步日誌
   */
  async getSyncLog(id: string): Promise<SyncLog> {
    const log = await this.supabase.findOne<SyncLog>(
      this.SYNC_LOGS_TABLE,
      { id },
      { useAdmin: true },
    );

    if (!log) {
      throw new Error(`Sync log not found: ${id}`);
    }

    return log;
  }

  /**
   * 取得最近的同步日誌
   */
  async getRecentSyncLogs(limit: number = 20): Promise<SyncLog[]> {
    return this.supabase.findMany<SyncLog>(this.SYNC_LOGS_TABLE, {
      orderBy: { column: 'started_at', ascending: false },
      limit,
      useAdmin: true,
    });
  }
}
