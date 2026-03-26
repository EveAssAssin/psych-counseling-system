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
let SyncService = SyncService_1 = class SyncService {
    constructor(configService, supabase, employeesService, storesService, lefthandApi) {
        this.configService = configService;
        this.supabase = supabase;
        this.employeesService = employeesService;
        this.storesService = storesService;
        this.lefthandApi = lefthandApi;
        this.logger = new common_1.Logger(SyncService_1.name);
        this.SYNC_LOGS_TABLE = 'sync_logs';
        this.NON_STORE_DEPARTMENTS = [
            '加工部', '企劃部', '總經理室', '營運部', '商城倉管部',
            '工程部', '教育訓練部', '商城門市', '倉管部', '行政部'
        ];
        this.EXCLUDED_KEYWORDS = [
            '不指定店員', '不指定人員', '測試', 'test', 'mock', '系統'
        ];
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
            this.logger.log('Step 4: Fetching store data for groupname mapping...');
            const storesResult = await this.lefthandApi.getAllStoresWithEmployees();
            const employeeDetailsMap = new Map();
            if (storesResult.success) {
                for (const store of storesResult.data) {
                    await this.syncStore(store);
                    if (store.employees) {
                        for (const emp of store.employees) {
                            employeeDetailsMap.set(emp.erpid, {
                                groupname: store.name,
                                grouperpid: store.erpid,
                                region: store.city,
                                role: emp.role,
                                jobtitle: emp.jobtitle,
                                isleave: emp.isleave,
                                isfreeze: emp.isfreeze,
                            });
                        }
                    }
                }
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
};
exports.SyncService = SyncService;
exports.SyncService = SyncService = SyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        supabase_service_1.SupabaseService,
        employees_service_1.EmployeesService,
        stores_service_1.StoresService,
        lefthand_api_service_1.LefthandApiService])
], SyncService);
//# sourceMappingURL=sync.service.js.map