import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { StoresService } from '../stores/stores.service';
import { LefthandApiService, EmployeeApiData, StoreApiData } from './lefthand-api.service';
import { TicketApiService, OfficialChannelMessage, TicketHistoryRecord, ExternalReview, PsychSyncFeedbackStats } from './ticket-api.service';

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
    // triggered_by 欄位是 UUID 型別，只有在傳入合法 UUID 時才寫入
    // 字串如 'scheduler' / 'manual' 只用於 trigger_type 判斷，不寫入 DB
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const triggeredByUuid = triggeredBy && UUID_REGEX.test(triggeredBy) ? triggeredBy : undefined;

    const triggerType = triggeredBy === 'scheduler' ? 'scheduled'
      : triggeredBy ? 'manual'
      : 'scheduled';

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
        triggered_by: triggeredByUuid,
        trigger_type: triggerType,
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
  async syncOfficialChannelMessages(triggeredBy?: string, force = false): Promise<SyncLog> {
    const syncLog = await this.createSyncLog('official_channel', 'ticket-system', triggeredBy);

    try {
      await this.updateSyncLog(syncLog.id, { status: 'running' });

      let totalFetched = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalFailed = 0;

      // ========================================
      // Step 1: 取得上次同步時間（force=true 則忽略 cursor，全量重新同步）
      // ========================================
      const lineLastSync = force ? null : await this.getSyncCursor('official-channel-line');
      const commentsLastSync = force ? null : await this.getSyncCursor('official-channel-comments');

      if (force) {
        this.logger.log('Force full resync: ignoring cursors, fetching ALL messages');
      }

      // ========================================
      // Step 2: 同步 LINE 訊息
      // ========================================
      this.logger.log('Step 1: Syncing LINE official channel messages...');
      const lineUpdatedAfter = lineLastSync?.last_record_time || undefined;
      this.logger.log(lineUpdatedAfter
        ? `Incremental sync from: ${lineUpdatedAfter}`
        : 'First sync: fetching ALL historical LINE messages');

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
        // 工單系統 API 排序：ORDER BY updated_at ASC, id ASC（穩定）
        // 最後一筆的 updated_at 即下次增量起點；相同 timestamp 的邊界 case
        // 由 source_record_id unique constraint 自動去重，不需額外處理
        if (lineMessages.length > 0) {
          const lastMsg = lineMessages[lineMessages.length - 1];
          await this.updateSyncCursor('official-channel-line', lastMsg.updated_at, lineMessages.length);
        }
      } catch (error) {
        this.logger.error('Failed to sync LINE messages:', error.message);
        totalFailed++;
      }

      // ========================================
      // Step 3: 同步工單留言
      // ========================================
      this.logger.log('Step 2: Syncing ticket comments...');
      const commentsUpdatedAfter = commentsLastSync?.last_record_time || undefined;
      this.logger.log(commentsUpdatedAfter
        ? `Incremental sync from: ${commentsUpdatedAfter}`
        : 'First sync: fetching ALL historical ticket comments');

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

        // 更新同步游標（同上，取最後一筆 updated_at）
        if (comments.length > 0) {
          const lastComment = comments[comments.length - 1];
          await this.updateSyncCursor('official-channel-comments', lastComment.updated_at, comments.length);
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
   * 批量 Upsert 官方頻道訊息（批次查詢版，避免 N+1）
   *
   * 工單系統已確認：
   * - 排序為 ORDER BY updated_at ASC, id ASC（穩定，分頁不亂）
   * - updated_at == created_at（不會被更新），cursor 完全可靠
   * - 同一 timestamp 多筆時，用 source_record_id unique constraint 去重
   */
  private async upsertOfficialChannelMessages(
    messages: OfficialChannelMessage[],
    sourceSystem: string,
  ): Promise<{ created: number; updated: number; skipped: number; failed: number }> {
    if (messages.length === 0) return { created: 0, updated: 0, skipped: 0, failed: 0 };

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    try {
      // ── Step 1: 一次查出本批所有 source_record_id 是否已存在 ──
      const sourceIds = messages.map(m => m.source_record_id);
      const { data: existingRows } = await this.supabase
        .getAdminClient()
        .from(this.OCM_TABLE)
        .select('source_record_id')
        .in('source_record_id', sourceIds);

      const existingSet = new Set((existingRows || []).map((r: any) => r.source_record_id));

      // ── Step 2: 一次查出本批所有 app_number 的員工資料 ──
      const appNumbers = [...new Set(messages.map(m => m.employee_app_number).filter(Boolean))];
      const employeeMap = new Map<string, any>();

      if (appNumbers.length > 0) {
        const { data: employees } = await this.supabase
          .getAdminClient()
          .from('employees')
          .select('id, employee_app_number')
          .in('employee_app_number', appNumbers);

        (employees || []).forEach((e: any) => {
          employeeMap.set(e.employee_app_number, e);
        });
      }

      // ── Step 3: 分成 new / existing 兩批，各自批量操作 ──
      const toInsert: any[] = [];
      const toUpdate: any[] = [];
      const now = new Date().toISOString();

      for (const msg of messages) {
        const employee = employeeMap.get(msg.employee_app_number) || null;

        if (!employee && msg.employee_app_number) {
          this.logger.warn(`Employee not found for app_number: ${msg.employee_app_number} (${msg.employee_name})`);
          skipped++;
        }

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
          synced_at: now,
        };

        if (existingSet.has(msg.source_record_id)) {
          toUpdate.push(record);
        } else {
          toInsert.push(record);
        }
      }

      // 批量 insert（新筆）
      if (toInsert.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < toInsert.length; i += CHUNK) {
          const chunk = toInsert.slice(i, i + CHUNK);
          const { error } = await this.supabase
            .getAdminClient()
            .from(this.OCM_TABLE)
            .insert(chunk);

          if (error) {
            // 部分因邊界重疊而已存在（同 updated_at 多筆），不算失敗
            if (error.code === '23505') {
              // unique violation → 已存在，算 updated
              updated += chunk.length;
            } else {
              this.logger.error(`Batch insert error: ${error.message}`);
              failed += chunk.length;
            }
          } else {
            created += chunk.length;
          }
        }
      }

      // 批量 upsert（已存在的，更新 synced_at / source_updated_at）
      if (toUpdate.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < toUpdate.length; i += CHUNK) {
          const chunk = toUpdate.slice(i, i + CHUNK);
          const { error } = await this.supabase
            .getAdminClient()
            .from(this.OCM_TABLE)
            .upsert(chunk, { onConflict: 'source_record_id', ignoreDuplicates: false });

          if (error) {
            this.logger.error(`Batch upsert error: ${error.message}`);
            failed += chunk.length;
          } else {
            updated += chunk.length;
          }
        }
      }
    } catch (error) {
      this.logger.error('upsertOfficialChannelMessages failed:', error.message);
      failed += messages.length;
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

  // ============================================
  // 客戶回報統計同步（review-system /psych-sync/reviews）
  // ============================================

  private readonly CFS_TABLE = 'customer_feedback_stats';

  /**
   * 從 review-system 拉取每位員工的客訴/回報統計，寫入 customer_feedback_stats 表
   * 每次全量覆蓋（UPSERT by employee_app_number）
   * 建議每日排程執行一次
   */
  async syncCustomerFeedbackStats(triggeredBy?: string): Promise<SyncLog> {
    const syncLog = await this.createSyncLog('customer_feedback_stats', 'review-system', triggeredBy);

    try {
      await this.updateSyncLog(syncLog.id, { status: 'running' });

      // 呼叫 review-system 官方同步端點
      const statsArray: PsychSyncFeedbackStats[] = await this.ticketApi.getPsychSyncReviews();

      let totalFetched = statsArray.length;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalFailed = 0;

      // 取得員工 app_number → UUID 對照表
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

      const client = this.supabase.getAdminClient();

      for (const stat of statsArray) {
        try {
          const emp = empByAppNumber[stat.app_number];
          const employeeId = emp?.id || null;

          const record = {
            employee_id: employeeId,
            employee_app_number: stat.app_number,
            employee_name: stat.employee_name || emp?.name || null,
            store_name: stat.store_name || emp?.store_name || null,
            total_feedbacks: stat.total_feedbacks || 0,
            pending_count: stat.pending_count || 0,
            processing_count: stat.processing_count || 0,
            resolved_count: stat.resolved_count || 0,
            closed_count: stat.closed_count || 0,
            by_type: stat.by_type || {},
            by_urgency: stat.by_urgency || {},
            latest_feedback_at: stat.latest_feedback_at || null,
            raw_data: stat,
            synced_at: new Date().toISOString(),
          };

          // UPSERT by employee_app_number
          const { data: existing } = await client
            .from(this.CFS_TABLE)
            .select('id')
            .eq('employee_app_number', stat.app_number)
            .maybeSingle();

          if (existing) {
            const { error } = await client
              .from(this.CFS_TABLE)
              .update(record)
              .eq('employee_app_number', stat.app_number);
            if (error) throw error;
            totalUpdated++;
          } else {
            const { error } = await client.from(this.CFS_TABLE).insert(record);
            if (error) throw error;
            totalCreated++;
          }
        } catch (err: any) {
          this.logger.error(`Failed to upsert feedback stats for ${stat.app_number}:`, err.message);
          totalFailed++;
        }
      }

      await this.updateSyncLog(syncLog.id, {
        status: totalFailed > 0 ? 'partial' : 'completed',
        finished_at: new Date().toISOString(),
        total_fetched: totalFetched,
        total_created: totalCreated,
        total_updated: totalUpdated,
        total_skipped: 0,
        total_failed: totalFailed,
      });

      this.logger.log(
        `Customer feedback stats sync completed: ${totalFetched} fetched, ${totalCreated} created, ${totalUpdated} updated, ${totalFailed} failed`,
      );

      return this.getSyncLog(syncLog.id);
    } catch (error) {
      this.logger.error('Customer feedback stats sync failed:', error);
      await this.updateSyncLog(syncLog.id, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_message: error.message,
      });
      return this.getSyncLog(syncLog.id);
    }
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
  /**
   * 清除指定 sync cursor（重置後下次同步會做全量）
   */
  async resetSyncCursor(syncType: string): Promise<{ success: boolean; message: string }> {
    const VALID_TYPES = ['official-channel-line', 'official-channel-comments', 'ticket-history', 'review-data'];
    if (!VALID_TYPES.includes(syncType)) {
      return { success: false, message: `Invalid cursor type. Valid: ${VALID_TYPES.join(', ')}` };
    }
    const { error } = await this.supabase.getAdminClient()
      .from(this.SYNC_CURSORS_TABLE)
      .delete()
      .eq('sync_type', syncType);
    if (error) {
      this.logger.error(`Failed to reset cursor ${syncType}: ${error.message}`);
      return { success: false, message: error.message };
    }
    this.logger.log(`Sync cursor reset: ${syncType}`);
    return { success: true, message: `Cursor '${syncType}' cleared. Next sync will fetch ALL historical data.` };
  }

  /**
   * 從 source_payload 補充 store_name（快速修復，不需要 API 呼叫）
   */
  async patchStoreNamesFromPayload(): Promise<{ updated: number; skipped: number }> {
    this.logger.log('Patching store_name from source_payload...');

    const client = this.supabase.getAdminClient();

    // 取出 store_name 為 null 但 source_payload 不為 null 的員工
    const { data: employees, error } = await client
      .from('employees')
      .select('id, store_name, source_payload')
      .is('store_name', null)
      .not('source_payload', 'is', null);

    if (error) {
      this.logger.error('Error fetching employees for patch:', error);
      throw error;
    }

    this.logger.log(`Found ${employees?.length || 0} employees with null store_name`);

    let updated = 0;
    let skipped = 0;

    for (const emp of employees || []) {
      const groupname = emp.source_payload?.groupname;
      if (groupname) {
        await client
          .from('employees')
          .update({ store_name: groupname })
          .eq('id', emp.id);
        updated++;
      } else {
        skipped++;
      }
    }

    this.logger.log(`Patch complete: ${updated} updated, ${skipped} skipped (no groupname in payload)`);
    return { updated, skipped };
  }

}