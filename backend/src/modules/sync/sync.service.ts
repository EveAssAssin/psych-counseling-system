import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { StoresService } from '../stores/stores.service';
import { LefthandApiService, EmployeeApiData, StoreApiData } from './lefthand-api.service';
import { TicketApiService, OfficialChannelMessage, TicketHistoryRecord, ExternalReview } from './ticket-api.service';

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
    private readonly ticketApi: TicketApiService,
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
   * 取得所有同步狀態（各類型最後同步時間 + 最近日誌）
   */
  async getSyncStatus(): Promise<{
    cursors: Record<string, any>;
    recentLogs: SyncLog[];
  }> {
    // 取得所有同步游標
    const cursors: Record<string, any> = {};

    const cursorTypes = ['official-channel-line', 'official-channel-comments', 'ticket-history'];
    for (const type of cursorTypes) {
      const cursor = await this.getSyncCursor(type);
      cursors[type] = cursor || { last_synced_at: null, last_record_time: null, total_synced: 0 };
    }

    // 取得最近 5 筆同步日誌
    const recentLogs = await this.getRecentSyncLogs(5);

    return { cursors, recentLogs };
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

  // ============================================
  // 官方頻道訊息同步（工單系統 API）
  // ============================================

  private readonly OCM_TABLE = 'official_channel_messages';
  private readonly SYNC_CURSORS_TABLE = 'sync_cursors';

  /**
   * 同步官方頻道訊息（LINE 訊息 + 工單留言）
   * 每日早上 5:00 執行，只抓取增量資料
   */
  async syncOfficialChannelMessages(triggeredBy?: string): Promise<SyncLog> {
    const syncLog = await this.createSyncLog('official_channel', 'ticket-system', triggeredBy);

    try {
      await this.updateSyncLog(syncLog.id, { status: 'running' });

      let totalFetched = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalFailed = 0;

      // ========================================
      // Step 1: 取得上次同步時間
      // ========================================
      const lineLastSync = await this.getSyncCursor('official-channel-line');
      const commentsLastSync = await this.getSyncCursor('official-channel-comments');

      // 如果是第一次同步（無 cursor），從 90 天前開始抓全部歷史資料
      // 之後的增量同步只抓上次同步之後的新資料
      const now = new Date();
      const firstSyncStart = new Date(now);
      firstSyncStart.setDate(firstSyncStart.getDate() - 90);
      firstSyncStart.setHours(0, 0, 0, 0);

      const defaultAfter = firstSyncStart.toISOString();

      // ========================================
      // Step 2: 同步 LINE 訊息
      // ========================================
      this.logger.log('Step 1: Syncing LINE official channel messages...');
      const lineUpdatedAfter = lineLastSync?.last_record_time || defaultAfter;
      
      try {
        const lineMessages = await this.ticketApi.getAllOfficialChannelMessages({
          updated_after: lineUpdatedAfter,
        });

        this.logger.log(`Fetched ${lineMessages.length} LINE messages`);
        totalFetched += lineMessages.length;

        const lineResult = await this.upsertOfficialChannelMessages(lineMessages, 'ticket-system-line');
        totalCreated += lineResult.created;
        totalUpdated += lineResult.updated;
        totalSkipped += lineResult.skipped;
        totalFailed += lineResult.failed;

        // 更新同步游標
        if (lineMessages.length > 0) {
          const lastMessageTime = lineMessages.reduce((max, msg) => 
            msg.updated_at > max ? msg.updated_at : max, lineMessages[0].updated_at);
          await this.updateSyncCursor('official-channel-line', lastMessageTime, lineMessages.length);
        }
      } catch (error) {
        this.logger.error('Failed to sync LINE messages:', error.message);
        totalFailed++;
      }

      // ========================================
      // Step 3: 同步工單留言
      // ========================================
      this.logger.log('Step 2: Syncing ticket comments...');
      const commentsUpdatedAfter = commentsLastSync?.last_record_time || defaultAfter;

      try {
        const comments = await this.ticketApi.getAllTicketComments({
          updated_after: commentsUpdatedAfter,
        });

        this.logger.log(`Fetched ${comments.length} ticket comments`);
        totalFetched += comments.length;

        const commentsResult = await this.upsertOfficialChannelMessages(comments, 'ticket-system-comments');
        totalCreated += commentsResult.created;
        totalUpdated += commentsResult.updated;
        totalSkipped += commentsResult.skipped;
        totalFailed += commentsResult.failed;

        // 更新同步游標
        if (comments.length > 0) {
          const lastMessageTime = comments.reduce((max, msg) => 
            msg.updated_at > max ? msg.updated_at : max, comments[0].updated_at);
          await this.updateSyncCursor('official-channel-comments', lastMessageTime, comments.length);
        }
      } catch (error) {
        this.logger.error('Failed to sync ticket comments:', error.message);
        totalFailed++;
      }

      // ========================================
      // Step 4: 更新同步日誌
      // ========================================
      await this.updateSyncLog(syncLog.id, {
        status: totalFailed > 0 ? 'partial' : 'completed',
        finished_at: new Date().toISOString(),
        total_fetched: totalFetched,
        total_created: totalCreated,
        total_updated: totalUpdated,
        total_skipped: totalSkipped,
        total_failed: totalFailed,
      });

      this.logger.log(
        `Official channel sync completed: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalFailed} failed`,
      );

      return this.getSyncLog(syncLog.id);
    } catch (error) {
      this.logger.error('Official channel sync failed:', error);

      await this.updateSyncLog(syncLog.id, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: error.message,
      });

      throw error;
    }
  }

  /**
   * 批量 Upsert 官方頻道訊息
   */
  private async upsertOfficialChannelMessages(
    messages: OfficialChannelMessage[],
    sourceSystem: string,
  ): Promise<{ created: number; updated: number; skipped: number; failed: number }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const msg of messages) {
      try {
        // 用 employee_app_number 查找員工
        const employee = await this.employeesService.findByAppNumber(msg.employee_app_number);

        // 檢查是否已存在
        const existing = await this.supabase.findOne(
          this.OCM_TABLE,
          { source_record_id: msg.source_record_id },
          { useAdmin: true },
        );

        const record = {
          source_record_id: msg.source_record_id,
          source_system: sourceSystem,
          employee_id: employee?.id || null,
          employee_app_number: msg.employee_app_number,
          employee_erp_id: msg.employee_erp_id,
          employee_name: msg.employee_name,
          group_name: msg.group_name,
          channel: msg.channel,
          thread_id: msg.thread_id,
          direction: msg.direction,
          message_time: msg.message_time,
          message_text: msg.message_text,
          message_type: msg.message_type || 'text',
          ticket_no: msg.ticket_no || null,
          author_name: msg.author_name || null,
          author_role: msg.author_role || null,
          agent_type: msg.agent_type || 'human',
          source_updated_at: msg.updated_at,
          synced_at: new Date().toISOString(),
        };

        if (existing) {
          await this.supabase.update(
            this.OCM_TABLE,
            { source_record_id: msg.source_record_id },
            record,
            { useAdmin: true },
          );
          updated++;
        } else {
          await this.supabase.create(this.OCM_TABLE, record, { useAdmin: true });
          created++;
        }

        // 如果找不到員工，記錄 warning
        if (!employee) {
          this.logger.warn(`Employee not found for app_number: ${msg.employee_app_number} (${msg.employee_name})`);
          skipped++;
        }
      } catch (error) {
        this.logger.error(`Failed to upsert message ${msg.source_record_id}:`, error.message);
        failed++;
      }
    }

    return { created, updated, skipped, failed };
  }

  // ============================================
  // 工單歷史同步（按員工逐一查詢）
  // ============================================

  private readonly ETH_TABLE = 'employee_ticket_history';
  private readonly TC_TABLE = 'ticket_conversations';

  /**
   * 同步所有員工的工單歷史
   */
  async syncTicketHistory(triggeredBy?: string): Promise<SyncLog> {
    const syncLog = await this.createSyncLog('ticket_history', 'ticket-system', triggeredBy);

    try {
      await this.updateSyncLog(syncLog.id, { status: 'running' });

      // 取得上次同步時間
      const lastSync = await this.getSyncCursor('ticket-history');
      const now = new Date();
      const firstSyncStart = new Date(now);
      firstSyncStart.setDate(firstSyncStart.getDate() - 90);
      firstSyncStart.setHours(0, 0, 0, 0);
      const updatedAfter = lastSync?.last_record_time || firstSyncStart.toISOString();

      // 取得所有有效員工
      const employees = await this.supabase.findMany<any>('employees', {
        filters: { is_active: true },
        useAdmin: true,
        limit: 9999,
      });

      // 只取有 employeeappnumber 的員工
      const validEmployees = employees.filter((e: any) => e.employeeappnumber);
      this.logger.log(`Found ${validEmployees.length} valid employees for ticket history sync`);

      let totalFetched = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      let latestUpdateTime = updatedAfter;

      for (const emp of validEmployees) {
        try {
          const records = await this.ticketApi.getAllEmployeeTicketHistory({
            app_number: emp.employeeappnumber,
            updated_after: updatedAfter,
          });

          if (records.length === 0) continue;

          totalFetched += records.length;

          for (const ticket of records) {
            try {
              const result = await this.upsertTicketHistory(ticket, emp);
              if (result === 'created') totalCreated++;
              else if (result === 'updated') totalUpdated++;

              // 追蹤最新的 updated_at
              if (ticket.updated_at > latestUpdateTime) {
                latestUpdateTime = ticket.updated_at;
              }
            } catch (error) {
              this.logger.error(`Failed to upsert ticket ${ticket.ticket_no}:`, error.message);
              totalFailed++;
            }
          }

          // 避免 API 過載
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          this.logger.error(`Failed to fetch tickets for ${emp.employeeappnumber} (${emp.name}):`, error.message);
          totalSkipped++;
        }
      }

      // 更新同步游標
      if (totalCreated + totalUpdated > 0) {
        await this.updateSyncCursor('ticket-history', latestUpdateTime, totalCreated + totalUpdated);
      }

      await this.updateSyncLog(syncLog.id, {
        status: totalFailed > 0 ? 'partial' : 'completed',
        finished_at: new Date().toISOString(),
        total_fetched: totalFetched,
        total_created: totalCreated,
        total_updated: totalUpdated,
        total_skipped: totalSkipped,
        total_failed: totalFailed,
        error_details: {
          total_employees: validEmployees.length,
        },
      });

      this.logger.log(
        `Ticket history sync completed: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalFailed} failed`,
      );

      return this.getSyncLog(syncLog.id);
    } catch (error) {
      this.logger.error('Ticket history sync failed:', error);

      await this.updateSyncLog(syncLog.id, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: error.message,
      });

      throw error;
    }
  }

  /**
   * Upsert 單張工單 + 對話事件
   */
  private async upsertTicketHistory(
    ticket: TicketHistoryRecord,
    employee: any,
  ): Promise<'created' | 'updated'> {
    const existing = await this.supabase.findOne(
      this.ETH_TABLE,
      { ticket_id: ticket.ticket_id },
      { useAdmin: true },
    );

    const record = {
      ticket_id: ticket.ticket_id,
      ticket_no: ticket.ticket_no,
      employee_id: employee.id,
      employee_app_number: employee.employeeappnumber,
      employee_erp_id: employee.employeeerpid || null,
      employee_name: ticket.staff_name || employee.name,
      store_name: ticket.store_name,
      issue_title: ticket.issue_title,
      issue_desc: ticket.issue_desc,
      category: ticket.category,
      parent_category: ticket.parent_category,
      sub_category: ticket.sub_category,
      status: ticket.status,
      review_status: ticket.review_status,
      priority: ticket.priority,
      customer_name: ticket.customer_name || null,
      customer_code: ticket.customer_code || null,
      assigned_engineer: ticket.assigned_engineer,
      attachment_count: ticket.attachment_count || 0,
      conversation_count: ticket.conversation_count || 0,
      ticket_created_at: ticket.created_at,
      ticket_updated_at: ticket.updated_at,
      ticket_closed_at: ticket.closed_at || null,
      synced_at: new Date().toISOString(),
    };

    let ticketHistoryId: string;
    let result: 'created' | 'updated';

    if (existing) {
      await this.supabase.update(
        this.ETH_TABLE,
        { ticket_id: ticket.ticket_id },
        record,
        { useAdmin: true },
      );
      ticketHistoryId = (existing as any).id;
      result = 'updated';
    } else {
      const created = await this.supabase.create(this.ETH_TABLE, record, { useAdmin: true });
      ticketHistoryId = (created as any).id;
      result = 'created';
    }

    // 同步對話事件（先刪後建）
    if (ticket.conversation && ticket.conversation.length > 0) {
      // 刪除舊的對話事件
      try {
        await this.supabase.delete(this.TC_TABLE, { ticket_id: ticket.ticket_id }, { useAdmin: true });
      } catch (e) {
        // 可能沒有舊資料，忽略
      }

      // 批量建立新對話事件
      for (const conv of ticket.conversation) {
        try {
          await this.supabase.create(
            this.TC_TABLE,
            {
              ticket_history_id: ticketHistoryId,
              ticket_id: ticket.ticket_id,
              event_type: conv.event_type,
              actor_name: conv.actor_name,
              actor_role: conv.actor_role,
              content: conv.content,
              event_created_at: conv.created_at,
            },
            { useAdmin: true },
          );
        } catch (e) {
          this.logger.warn(`Failed to insert conversation for ticket ${ticket.ticket_no}:`, e.message);
        }
      }
    }

    return result;
  }

  /**
   * 取得同步游標
   */
  private async getSyncCursor(syncType: string): Promise<{ last_record_time: string | null } | null> {
    return this.supabase.findOne(
      this.SYNC_CURSORS_TABLE,
      { sync_type: syncType },
      { useAdmin: true },
    );
  }

  /**
   * 同步評價資料（reviews + review_responses）
   * 評價資料存在於本系統 DB，此同步任務負責追蹤最新評價狀態並產生 sync log
   */
  async syncReviewData(triggeredBy?: string): Promise<SyncLog> {
    const syncLog = await this.createSyncLog('review_sync', 'review-system', triggeredBy);

    try {
      await this.updateSyncLog(syncLog.id, { status: 'running' });

      // 取得上次同步時間
      const lastSync = await this.getSyncCursor('review-data');
      const now = new Date();
      const firstSyncStart = new Date(now);
      firstSyncStart.setDate(firstSyncStart.getDate() - 90);
      firstSyncStart.setHours(0, 0, 0, 0);
      const updatedAfter = lastSync?.last_record_time || firstSyncStart.toISOString();

      // 從 review-system 外部 API 取得新增/更新/刪除的評價
      const externalReviews = await this.ticketApi.getReviewsSince(updatedAfter);

      let totalFetched = externalReviews.length;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalDeleted = 0;
      let totalFailed = 0;
      let latestUpdatedAt = updatedAfter;

      // 取得所有員工 app_number → UUID 對照表
      const employees = await this.supabase.findMany<any>('employees', {
        filters: { is_active: true },
        useAdmin: true,
        limit: 9999,
      });
      const empByAppNumber: Record<string, any> = {};
      for (const emp of employees) {
        if (emp.employeeappnumber) {
          empByAppNumber[emp.employeeappnumber] = emp;
        }
      }

      for (const ext of externalReviews) {
        try {
          const result = await this.upsertExternalReview(ext, empByAppNumber);
          if (result === 'created') totalCreated++;
          else if (result === 'updated') totalUpdated++;
          else if (result === 'deleted') totalDeleted++;

          if (ext.updated_at > latestUpdatedAt) {
            latestUpdatedAt = ext.updated_at;
          }
        } catch (err: any) {
          this.logger.error(`Failed to upsert review ${ext.id}:`, err.message);
          totalFailed++;
        }
      }

      // 更新同步游標
      if (totalFetched > 0) {
        await this.updateSyncCursor('review-data', latestUpdatedAt, totalCreated + totalUpdated);
      }

      await this.updateSyncLog(syncLog.id, {
        status: totalFailed > 0 ? 'partial' : 'completed',
        finished_at: new Date().toISOString(),
        total_fetched: totalFetched,
        total_created: totalCreated,
        total_updated: totalUpdated,
        total_skipped: 0,
        total_failed: totalFailed,
        error_details: {
          deleted: totalDeleted,
          sync_window_from: updatedAfter,
        },
      });

      this.logger.log(
        `Review sync completed: ${totalFetched} fetched, ${totalCreated} created, ${totalUpdated} updated, ${totalDeleted} soft-deleted`,
      );

      return this.getSyncLog(syncLog.id);
    } catch (error) {
      this.logger.error('Review sync failed:', error);
      await this.updateSyncLog(syncLog.id, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: error.message,
      });
      return this.getSyncLog(syncLog.id);
    }
  }

  /**
   * Upsert 單筆來自外部 review-system 的評價
   * 以 external_review_id 為唯一鍵：
   *   - 不存在 → 建立
   *   - 已存在 → 更新
   *   - deleted_at 有值 → 軟刪除（標記 deleted_at，AI 分析自動略過）
   */
  private async upsertExternalReview(
    ext: ExternalReview,
    empByAppNumber: Record<string, any>,
  ): Promise<'created' | 'updated' | 'deleted' | 'skipped'> {
    const externalId = String(ext.id);

    // 找對應員工 UUID
    const emp = empByAppNumber[ext.employee_app_number];
    if (!emp) {
      this.logger.warn(`Employee not found for app_number: ${ext.employee_app_number}, skipping review ${externalId}`);
      return 'skipped';
    }

    // 找實際當事人（如果有代理）
    let actualEmployeeId: string | null = null;
    if (ext.actual_employee_app_number && ext.actual_employee_app_number !== ext.employee_app_number) {
      const actualEmp = empByAppNumber[ext.actual_employee_app_number];
      actualEmployeeId = actualEmp?.id || null;
    }

    const client = this.supabase.getAdminClient();

    // 查是否已存在
    const { data: existing } = await client
      .from('reviews')
      .select('id, deleted_at')
      .eq('external_review_id', externalId)
      .maybeSingle();

    const reviewData: Record<string, any> = {
      employee_id: emp.id,
      actual_employee_id: actualEmployeeId,
      is_proxy: ext.is_proxy || false,
      source: ext.source,
      review_type: ext.review_type,
      urgency: ext.urgency || 'normal',
      content: ext.content,
      event_date: ext.event_date,
      status: ext.status,
      response_speed_hours: ext.response_speed_hours,
      responded_at: ext.responded_at,
      closed_at: ext.closed_at,
      deleted_at: ext.deleted_at || null,   // 來源刪除 → 標記軟刪除
      external_review_id: externalId,
      synced_at: new Date().toISOString(),
      requires_response: ext.review_type === 'negative' || ext.review_type === 'other',
    };

    if (!existing) {
      // 新增
      const { error } = await client.from('reviews').insert(reviewData);
      if (error) throw error;

      // 同步回覆對話
      if (ext.responses && ext.responses.length > 0) {
        const { data: newReview } = await client
          .from('reviews')
          .select('id')
          .eq('external_review_id', externalId)
          .single();
        if (newReview) {
          await this.syncReviewResponses(newReview.id, emp.id, ext.responses);
        }
      }
      return 'created';
    } else {
      // 更新
      const { error } = await client
        .from('reviews')
        .update(reviewData)
        .eq('external_review_id', externalId);
      if (error) throw error;

      // 更新回覆對話
      if (ext.responses && ext.responses.length > 0) {
        await this.syncReviewResponses(existing.id, emp.id, ext.responses);
      }

      return ext.deleted_at ? 'deleted' : 'updated';
    }
  }

  /**
   * 同步評價回覆對話
   */
  private async syncReviewResponses(
    reviewId: string,
    employeeId: string,
    responses: ExternalReview['responses'],
  ): Promise<void> {
    if (!responses || responses.length === 0) return;
    const client = this.supabase.getAdminClient();

    for (const resp of responses) {
      const { error } = await client.from('review_responses').upsert(
        {
          review_id: reviewId,
          employee_id: employeeId,
          responder_type: resp.responder_type,
          responder_name: resp.responder_name,
          content: resp.content,
          created_at: resp.created_at,
        },
        { onConflict: 'review_id,responder_type,created_at', ignoreDuplicates: true },
      );
      if (error) {
        this.logger.warn(`Failed to upsert review response: ${error.message}`);
      }
    }
  }

  /**
   * 更新同步游標
   */
  private async updateSyncCursor(syncType: string, lastRecordTime: string, count: number): Promise<void> {
    const existing = await this.getSyncCursor(syncType);

    if (existing) {
      await this.supabase.update(
        this.SYNC_CURSORS_TABLE,
        { sync_type: syncType },
        {
          last_synced_at: new Date().toISOString(),
          last_record_time: lastRecordTime,
          total_synced: (existing as any).total_synced + count,
        },
        { useAdmin: true },
      );
    } else {
      await this.supabase.create(
        this.SYNC_CURSORS_TABLE,
        {
          sync_type: syncType,
          last_synced_at: new Date().toISOString(),
          last_record_time: lastRecordTime,
          total_synced: count,
        },
        { useAdmin: true },
      );
    }
  }
}
