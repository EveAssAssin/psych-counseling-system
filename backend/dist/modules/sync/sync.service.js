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
    }
    async syncEmployees(triggeredBy) {
        const syncLog = await this.createSyncLog('employee_full', 'lefthand_api', triggeredBy);
        try {
            await this.updateSyncLog(syncLog.id, { status: 'running' });
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
            this.logger.log('Step 2: Fetching stores with employee details...');
            const storesResult = await this.lefthandApi.getAllStoresWithEmployees();
            const employeeDetailsMap = new Map();
            if (storesResult.success) {
                for (const store of storesResult.data) {
                    await this.syncStore(store);
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
            this.logger.log('Step 3: Upserting employees to database...');
            const employeesToUpsert = employees.map((emp) => {
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
            const result = await this.employeesService.bulkUpsert(employeesToUpsert);
            await this.updateSyncLog(syncLog.id, {
                status: result.failed > 0 ? 'partial' : 'completed',
                finished_at: new Date().toISOString(),
                total_fetched: employees.length,
                total_created: result.created,
                total_updated: result.updated,
                total_failed: result.failed,
                error_details: result.errors.length > 0 ? { errors: result.errors.slice(0, 10) } : undefined,
            });
            this.logger.log(`Employee sync completed: ${result.created} created, ${result.updated} updated, ${result.failed} failed`);
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