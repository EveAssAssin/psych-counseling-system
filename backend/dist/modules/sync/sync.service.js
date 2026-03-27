"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_service_1 = require("../supabase/supabase.service");
const employees_service_1 = require("../employees/employees.service");
const stores_service_1 = require("../stores/stores.service");
const lefthand_api_service_1 = require("./lefthand-api.service");
const ticket_api_service_1 = require("./ticket-api.service");
let SyncService = SyncService_1 = class SyncService {
    constructor(configService, supabase, employeesService, storesService, lefthandApi, ticketApi) {
        this.configService = configService;
        this.supabase = supabase;
        this.employeesService = employeesService;
        this.storesService = storesService;
        this.lefthandApi = lefthandApi;
        this.ticketApi = ticketApi;
        this.logger = new common_1.Logger(SyncService_1.name);
        this.SYNC_LOGS_TABLE = 'sync_logs';
        this.NON_STORE_DEPARTMENTS = [
            '加工部', '企劃部', '總經理室', '營運部', '商城倉管部',
            '工程部', '教育訓練部', '商城門市', '倉管部', '行政部'
        ];
        this.EXCLUDED_KEYWORDS = [
            '不指定店員', '不指定人員', '測試', 'test', 'mock', '系統'
        ];
        this.OCM_TABLE = 'official_channel_messages';
        this.SYNC_CURSORS_TABLE = 'sync_cursors';
    }
    async syncEmployees(triggeredBy) {
        const syncLog = await this.createSyncLog('employee_full', 'lefthand_api', triggeredBy);
        try {
            await this.updateSyncLog(syncLog.id, { status: 'running' });
            let totalSkipped = 0;
            const skippedReasons = [];
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
            this.logger.log('Step 2: Filtering employees (must have both appnumber and erpid)...');
            const validEmployees = rawEmployees.filter((emp) => {
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
            this.logger.log('Step 3: Marking excluded/special accounts...');
            const processedEmployees = validEmployees.map((emp) => {
                const name = emp.employeename || '';
                const isExcluded = this.EXCLUDED_KEYWORDS.some(keyword => name.toLowerCase().includes(keyword.toLowerCase()));
                return {
                    ...emp,
                    _isExcluded: isExcluded,
                    _excludeReason: isExcluded ? '符合排除關鍵字' : null,
                };
            });
            const excludedCount = processedEmployees.filter((e) => e._isExcluded).length;
            this.logger.log(`Excluded accounts: ${excludedCount}`);
            this.logger.log('Step 4: Fetching employee details via getemployeebyerps...');
            const employeeDetailsMap = new Map();
            const allErpIds = processedEmployees
                .filter((emp) => emp.employeeerpid)
                .map((emp) => emp.employeeerpid);
            this.logger.log(`Total ERP IDs to query: ${allErpIds.length}`);
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
                }
                catch (error) {
                    this.logger.warn(`Failed to fetch batch ${Math.floor(i / batchSize) + 1}:`, error.message);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            this.logger.log(`Employee details map size: ${employeeDetailsMap.size}`);
            this.logger.log('Step 5: Building final employee records with person_type...');
            const employeesToUpsert = processedEmployees.map((emp) => {
                const details = employeeDetailsMap.get(emp.employeeerpid) || {};
                const groupname = details.groupname || '';
                let personType = 'store';
                let isStoreStaff = true;
                if (emp._isExcluded) {
                    personType = 'excluded';
                    isStoreStaff = false;
                }
                else if (this.NON_STORE_DEPARTMENTS.some(dept => groupname.includes(dept))) {
                    personType = 'nonstore';
                    isStoreStaff = false;
                }
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
            this.logger.log('Step 6: Upserting employees to database...');
            const result = await this.employeesService.bulkUpsert(employeesToUpsert);
            const syncDetails = {
                total_raw: rawEmployees.length,
                total_valid: validEmployees.length,
                total_excluded: excludedCount,
                skipped_samples: skippedReasons.slice(0, 10),
                person_type_breakdown: {
                    store: employeesToUpsert.filter((e) => e.person_type === 'store').length,
                    nonstore: employeesToUpsert.filter((e) => e.person_type === 'nonstore').length,
                    excluded: employeesToUpsert.filter((e) => e.person_type === 'excluded').length,
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
            this.logger.log(`Employee sync completed: ${result.created} created, ${result.updated} updated, ${totalSkipped} skipped, ${result.failed} failed`);
            this.logger.log(`Person type breakdown: store=${syncDetails.person_type_breakdown.store}, nonstore=${syncDetails.person_type_breakdown.nonstore}, excluded=${syncDetails.person_type_breakdown.excluded}`);
            return this.getSyncLog(syncLog.id);
        }
        catch (error) {
            this.logger.error('Employee sync failed:', error);
            await this.updateSyncLog(syncLog.id, {
                status: 'failed',
                finished_at: new Date().toISOString(),
                error_message: error.message,
            });
            throw error;
        }
    }
    async syncStore(storeData) {
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
        }
        catch (error) {
            this.logger.warn(`Failed to sync store ${storeData.name}:`, error.message);
        }
    }
    async syncDailyData(triggeredBy) {
        const syncLog = await this.createSyncLog('external_daily', 'multi_source', triggeredBy);
        try {
            await this.updateSyncLog(syncLog.id, { status: 'running' });
            let totalFetched = 0;
            let totalCreated = 0;
            let totalFailed = 0;
            const errors = [];
            const sources = ['attendance', 'score', 'review', 'official_channel'];
            for (const source of sources) {
                try {
                    const result = await this.syncExternalSource(source);
                    totalFetched += result.fetched;
                    totalCreated += result.created;
                    totalFailed += result.failed;
                }
                catch (sourceError) {
                    this.logger.error(`Failed to sync source ${source}:`, sourceError);
                    errors.push({ source, error: sourceError.message });
                    totalFailed++;
                }
            }
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
        }
        catch (error) {
            this.logger.error('Daily sync failed:', error);
            await this.updateSyncLog(syncLog.id, {
                status: 'failed',
                finished_at: new Date().toISOString(),
                error_message: error.message,
            });
            throw error;
        }
    }
    async syncOfficialChannelConversations(triggeredBy) {
        this.logger.log('Syncing official channel conversations');
        return { fetched: 0, created: 0, failed: 0 };
    }
    async syncExternalSource(source) {
        this.logger.log(`Syncing external source: ${source}`);
        return { fetched: 0, created: 0, failed: 0 };
    }
    async createSyncLog(syncType, sourceName, triggeredBy) {
        return this.supabase.create(this.SYNC_LOGS_TABLE, {
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
        }, { useAdmin: true });
    }
    async updateSyncLog(id, data) {
        await this.supabase.update(this.SYNC_LOGS_TABLE, { id }, data, { useAdmin: true });
    }
    async getSyncLog(id) {
        const log = await this.supabase.findOne(this.SYNC_LOGS_TABLE, { id }, { useAdmin: true });
        if (!log) {
            throw new Error(`Sync log not found: ${id}`);
        }
        return log;
    }
    async getRecentSyncLogs(limit = 20) {
        return this.supabase.findMany(this.SYNC_LOGS_TABLE, {
            orderBy: { column: 'started_at', ascending: false },
            limit,
            useAdmin: true,
        });
    }
    async syncOfficialChannelMessages(triggeredBy) {
        const syncLog = await this.createSyncLog('official_channel', 'ticket-system', triggeredBy);
        try {
            await this.updateSyncLog(syncLog.id, { status: 'running' });
            let totalFetched = 0;
            let totalCreated = 0;
            let totalUpdated = 0;
            let totalSkipped = 0;
            let totalFailed = 0;
            const lineLastSync = await this.getSyncCursor('official-channel-line');
            const commentsLastSync = await this.getSyncCursor('official-channel-comments');
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            const defaultAfter = yesterday.toISOString();
            const defaultBefore = today.toISOString();
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
                if (lineMessages.length > 0) {
                    const lastMessageTime = lineMessages.reduce((max, msg) => msg.updated_at > max ? msg.updated_at : max, lineMessages[0].updated_at);
                    await this.updateSyncCursor('official-channel-line', lastMessageTime, lineMessages.length);
                }
            }
            catch (error) {
                this.logger.error('Failed to sync LINE messages:', error.message);
                totalFailed++;
            }
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
                if (comments.length > 0) {
                    const lastMessageTime = comments.reduce((max, msg) => msg.updated_at > max ? msg.updated_at : max, comments[0].updated_at);
                    await this.updateSyncCursor('official-channel-comments', lastMessageTime, comments.length);
                }
            }
            catch (error) {
                this.logger.error('Failed to sync ticket comments:', error.message);
                totalFailed++;
            }
            await this.updateSyncLog(syncLog.id, {
                status: totalFailed > 0 ? 'partial' : 'completed',
                finished_at: new Date().toISOString(),
                total_fetched: totalFetched,
                total_created: totalCreated,
                total_updated: totalUpdated,
                total_skipped: totalSkipped,
                total_failed: totalFailed,
            });
            this.logger.log(`Official channel sync completed: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalFailed} failed`);
            return this.getSyncLog(syncLog.id);
        }
        catch (error) {
            this.logger.error('Official channel sync failed:', error);
            await this.updateSyncLog(syncLog.id, {
                status: 'failed',
                finished_at: new Date().toISOString(),
                error_message: error.message,
            });
            throw error;
        }
    }
    async upsertOfficialChannelMessages(messages, sourceSystem) {
        let created = 0;
        let updated = 0;
        let skipped = 0;
        let failed = 0;
        for (const msg of messages) {
            try {
                const employee = await this.employeesService.findByAppNumber(msg.employee_app_number);
                const existing = await this.supabase.findOne(this.OCM_TABLE, { source_record_id: msg.source_record_id }, { useAdmin: true });
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
                    await this.supabase.update(this.OCM_TABLE, { source_record_id: msg.source_record_id }, record, { useAdmin: true });
                    updated++;
                }
                else {
                    await this.supabase.create(this.OCM_TABLE, record, { useAdmin: true });
                    created++;
                }
                if (!employee) {
                    this.logger.warn(`Employee not found for app_number: ${msg.employee_app_number} (${msg.employee_name})`);
                    skipped++;
                }
            }
            catch (error) {
                this.logger.error(`Failed to upsert message ${msg.source_record_id}:`, error.message);
                failed++;
            }
        }
        return { created, updated, skipped, failed };
    }
    async getSyncCursor(syncType) {
        return this.supabase.findOne(this.SYNC_CURSORS_TABLE, { sync_type: syncType }, { useAdmin: true });
    }
    async updateSyncCursor(syncType, lastRecordTime, count) {
        const existing = await this.getSyncCursor(syncType);
        if (existing) {
            await this.supabase.update(this.SYNC_CURSORS_TABLE, { sync_type: syncType }, {
                last_synced_at: new Date().toISOString(),
                last_record_time: lastRecordTime,
                total_synced: existing.total_synced + count,
            }, { useAdmin: true });
        }
        else {
            await this.supabase.create(this.SYNC_CURSORS_TABLE, {
                sync_type: syncType,
                last_synced_at: new Date().toISOString(),
                last_record_time: lastRecordTime,
                total_synced: count,
            }, { useAdmin: true });
        }
    }
};
exports.SyncService = SyncService;
exports.SyncService = SyncService = SyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        supabase_service_1.SupabaseService,
        employees_service_1.EmployeesService,
        stores_service_1.StoresService,
        lefthand_api_service_1.LefthandApiService,
        ticket_api_service_1.TicketApiService])
], SyncService);
//# sourceMappingURL=sync.service.js.map