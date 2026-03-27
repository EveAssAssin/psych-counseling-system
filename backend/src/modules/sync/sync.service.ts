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

  // 非門市部門列表（用於判斷 person_type）
  private readonly NON_STORE_DEPARTMENTS = [
    '加工部', '企劃部', '總經理室', '營運部', '商城倉管部', 
    '工程部', '教育訓練部', '商城門市', '倉管部', '行政部'
  ];

  // 排除關鍵字（這些名稱的員工要標記為 excluded）
  private readonly EXCLUDED_KEYWORDS = [
    '不指定店員', '不指定人員', '測試', 'test', 'mock', '系統'
  ];

  /**
   * 執行員工主檔全量同步（從左手系統 API）
   * 依照「人員資料一致性規則」執行
   */
  async syncEmployees(triggeredBy?: string): Promise<SyncLog> {
    const syncLog = await this.createSyncLog('employee_full', 'lefthand_api', triggeredBy);

    try {
      await this.updateSyncLog(syncLog.id, { status: 'running' });

      let totalSkipped = 0;
      const skippedReasons: { name: string; reason: string }[] = [];

      // ========================================
      // Step 1: getallemployees 取得正式員工候選母體
      // ========================================
      this.logger.log('Step 1: Fetching all employees from getallemployees...');
      const employeesResult = await this.lefthandApi.getAllEmployees();

      if (!employeesResult.success) {
        throw new Error(`Failed to fetch employees: ${employeesResult.message}`);
      }

      const rawEmployees = employeesResult.data;
      this.logger.log(`Fetched ${rawEmployees.length} raw employees from API`);

      if (rawEmployees.length === 0) {
        await this.updateSyncLog(syncLog.id, {
          status: 'completed',
          finished_at: new Date().toISOString(),
          total_fetched: 0,
        });
        return this.getSyncLog(syncLog.id);
      }

      // ========================================
      // Step 2: 過濾正式人員條件
      // 必要條件：同時有 employeeappnumber + employeeerpid
      // ========================================
      this.logger.log('Step 2: Filtering employees (must have both appnumber and erpid)...');
      const validEmployees = rawEmployees.filter((emp: EmployeeApiData) => {
        // 必須同時有 employeeappnumber 和 employeeerpid
        if (!emp.employeeappnumber || !emp.employeeerpid) {
          totalSkipped++;
          skippedReasons.push({
            name: emp.employeename || 'Unknown',
            reason: `缺少必要欄位: appnumber=${emp.employeeappnumber}, erpid=${emp.employeeerpid}`,
          });
          return false;
        }
        return true;
      });

      this.logger.log(`Valid employees after filtering: ${validEmployees.length} (skipped: ${totalSkipped})`);

      // ========================================
      // Step 3: 排除/標記特殊帳號
      // ========================================
      this.logger.log('Step 3: Marking excluded/special accounts...');
      const processedEmployees = validEmployees.map((emp: EmployeeApiData) => {
        const name = emp.employeename || '';
        const isExcluded = this.EXCLUDED_KEYWORDS.some(keyword => 
          name.toLowerCase().includes(keyword.toLowerCase())
        );

        return {
          ...emp,
          _isExcluded: isExcluded,
          _excludeReason: isExcluded ? '符合排除關鍵字' : null,
        };
      });

      const excludedCount = processedEmployees.filter((e: any) => e._isExcluded).length;
      this.logger.log(`Excluded accounts: ${excludedCount}`);

      // ========================================
      // Step 4: 使用 getemployeebyerps 批量補查員工詳細資料
      // 因為 getstoredatas 只回傳「需要顯示在官網的員工」
      // ========================================
      this.logger.log('Step 4: Fetching employee details via getemployeebyerps...');
      
      // 建立 erpid -> 員工詳細資料 對照表
      const employeeDetailsMap = new Map<string, any>();
      
      // 取得所有員工的 erpid
      const allErpIds = processedEmployees
        .filter((emp: any) => emp.employeeerpid)
        .map((emp: any) => emp.employeeerpid);
      
      this.logger.log(`Total ERP IDs to query: ${allErpIds.length}`);
      
      // 分批查詢（每批 50 個，避免 API 超時或限制）
      const batchSize = 50;
      for (let i = 0; i < allErpIds.length; i += batchSize) {
        const batchErpIds = allErpIds.slice(i, i + batchSize);
        this.logger.log(`Querying batch ${Math.floor(i / batchSize) + 1}: ${batchErpIds.length} employees`);
        
        try {
          const detailsResult = await this.lefthandApi.getEmployeesByErpIds(batchErpIds);
          
          if (detailsResult.success && detailsResult.data) {
            for (const emp of detailsResult.data) {
              employeeDetailsMap.set(emp.erpid, {
                groupname: emp.groupname,
                grouperpid: emp.grouperpid,
                role: emp.role,
                jobtitle: emp.jobtitle,
                isleave: emp.isleave,
                isfreeze: emp.isfreeze,
              });
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        }
        
        // 避免 API 過載，每批之間暫停 100ms
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.logger.log(`Employee details map size: ${employeeDetailsMap.size}`);

      // ========================================
      // Step 5: 組合最終員工資料，判斷 person_type
      // ========================================
      this.logger.log('Step 5: Building final employee records with person_type...');
      const employeesToUpsert = processedEmployees.map((emp: any) => {
        const details = employeeDetailsMap.get(emp.employeeerpid) || {};
        const groupname = details.groupname || '';
        
        // 判斷 person_type
        let personType: 'store' | 'nonstore' | 'special' | 'excluded' = 'store';
        let isStoreStaff = true;

        if (emp._isExcluded) {
          personType = 'excluded';
          isStoreStaff = false;
        } else if (this.NON_STORE_DEPARTMENTS.some(dept => groupname.includes(dept))) {
          personType = 'nonstore';
          isStoreStaff = false;
        }

        // 判斷是否在官網展示（有在 getstoredatas 中出現）
        const isDisplayedOnWebsite = employeeDetailsMap.has(emp.employeeerpid);

        return {
          employeeappnumber: emp.employeeappnumber,
          employeeerpid: emp.employeeerpid,
          name: emp.employeename,
          role: details.role,
          title: details.jobtitle,
          store_name: groupname,
          department: details.region || groupname,
          is_active: !details.isleave && !details.isfreeze && !emp._isExcluded,
          is_leave: details.isleave || false,
          person_type: personType,
          is_store_staff: isStoreStaff,
          is_displayed_on_website: isDisplayedOnWebsite,
          source_payload: {
            employeeappnumber: emp.employeeappnumber,
            employeeerpid: emp.employeeerpid,
            employeename: emp.employeename,
            employeeimage: emp.employeeimage,
            groupname: groupname,
            grouperpid: details.grouperpid,
            jobtitle: details.jobtitle,
            role: details.role,
            person_type: personType,
            is_store_staff: isStoreStaff,
            is_displayed_on_website: isDisplayedOnWebsite,
            synced_at: new Date().toISOString(),
          },
        };
      });

      // ========================================
      // Step 6: 批量 Upsert 到資料庫
      // ========================================
      this.logger.log('Step 6: Upserting employees to database...');
      const result = await this.employeesService.bulkUpsert(employeesToUpsert as any);

      // ========================================
      // Step 7: 更新同步日誌
      // ========================================
      const syncDetails = {
        total_raw: rawEmployees.length,
        total_valid: validEmployees.length,
        total_excluded: excludedCount,
        skipped_samples: skippedReasons.slice(0, 10),
        person_type_breakdown: {
          store: employeesToUpsert.filter((e: any) => e.person_type === 'store').length,
          nonstore: employeesToUpsert.filter((e: any) => e.person_type === 'nonstore').length,
          excluded: employeesToUpsert.filter((e: any) => e.person_type === 'excluded').length,
        },
      };

      await this.updateSyncLog(syncLog.id, {
        status: result.failed > 0 ? 'partial' : 'completed',
        finished_at: new Date().toISOString(),
        total_fetched: rawEmployees.length,
        total_created: result.created,
        total_updated: result.updated,
        total_skipped: totalSkipped,
        total_failed: result.failed,
        error_details: {
          ...syncDetails,
          upsert_errors: result.errors.slice(0, 10),
        },
      });

      this.logger.log(
        `Employee sync completed: ${result.created} created, ${result.updated} updated, ${totalSkipped} skipped, ${result.failed} failed`,
      );
      this.logger.log(`Person type breakdown: store=${syncDetails.person_type_breakdown.store}, nonstore=${syncDetails.person_type_breakdown.nonstore}, excluded=${syncDetails.person_type_breakdown.excluded}`);

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
