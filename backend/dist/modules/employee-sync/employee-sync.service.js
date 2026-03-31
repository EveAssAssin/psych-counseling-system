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
var EmployeeSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeSyncService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
const crypto = require("crypto");
const AES_KEY = 'GmAOoS003d5OJ2G2';
const AES_IV = 'bgfDcfWdWG6NSUr5';
const BACKEND_DEPT_ERPIDS = [
    { grouperpid: '0000', name: '商城倉管部' },
    { grouperpid: '000000', name: '營運部' },
    { grouperpid: '00002', name: '企劃部' },
    { grouperpid: '00003', name: '暗部' },
    { grouperpid: '0001', name: '工程部' },
    { grouperpid: '120035', name: '區長' },
    { grouperpid: '1200350063', name: '公關部' },
    { grouperpid: '1200350064', name: '總經理室' },
    { grouperpid: '120079', name: '教育訓練部' },
    { grouperpid: '1990302', name: '商城門市' },
];
let EmployeeSyncService = EmployeeSyncService_1 = class EmployeeSyncService {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = new common_1.Logger(EmployeeSyncService_1.name);
        this.apiUrl = 'https://map.lohasglasses.com/_api/v1.ashx';
    }
    aesEncrypt(text) {
        const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(AES_KEY), Buffer.from(AES_IV));
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    }
    isValidEmployee(e, appNumberMap) {
        return !!(e.erpid &&
            appNumberMap.has(e.erpid) &&
            !e.isleave &&
            !e.isfreeze &&
            !e.name?.includes('不指定') &&
            !e.erpid?.startsWith('9999'));
    }
    async getAppNumberMap() {
        this.logger.log('Fetching all employees for app number mapping...');
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: 'getallemployees' }),
        });
        const result = await response.json();
        const employees = result.data || [];
        const map = new Map();
        for (const emp of employees) {
            if (emp.employeeerpid && emp.employeeappnumber) {
                map.set(emp.employeeerpid, emp.employeeappnumber);
            }
        }
        this.logger.log(`Found ${map.size} employees with app numbers`);
        return map;
    }
    async syncStoreEmployees() {
        this.logger.log('Starting store employees sync...');
        const appNumberMap = await this.getAppNumberMap();
        const stores = await this.supabase.findMany('stores', {
            filters: { is_active: true },
        });
        this.logger.log(`Found ${stores.length} active stores`);
        let totalSynced = 0;
        for (const store of stores) {
            try {
                const encryptedGroupId = this.aesEncrypt(store.store_code);
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        method: 'getemployeebygroup',
                        groupid: encryptedGroupId,
                    }),
                });
                const result = await response.json();
                const employees = result.data || [];
                let storeCount = 0;
                for (const emp of employees) {
                    if (this.isValidEmployee(emp, appNumberMap)) {
                        try {
                            await this.supabase.upsert('employees_cache', {
                                store_id: store.id,
                                store_erpid: store.store_code,
                                erpid: emp.erpid,
                                app_number: appNumberMap.get(emp.erpid),
                                name: emp.name,
                                jobtitle: emp.jobtitle || null,
                                department: 'store',
                                is_active: true,
                                synced_at: new Date().toISOString(),
                            }, { onConflict: 'erpid' });
                            storeCount++;
                        }
                        catch (e) {
                            this.logger.warn(`Failed to upsert employee ${emp.erpid}: ${e.message}`);
                        }
                    }
                }
                this.logger.log(`Store ${store.name}: synced ${storeCount} employees`);
                totalSynced += storeCount;
            }
            catch (error) {
                this.logger.error(`Failed to sync store ${store.name}: ${error.message}`);
            }
        }
        this.logger.log(`Store sync completed: ${totalSynced} employees from ${stores.length} stores`);
        return { synced: totalSynced, stores: stores.length };
    }
    async syncBackendEmployees() {
        this.logger.log('Starting backend employees sync...');
        const appNumberMap = await this.getAppNumberMap();
        let totalSynced = 0;
        for (const dept of BACKEND_DEPT_ERPIDS) {
            try {
                const encryptedGroupId = this.aesEncrypt(dept.grouperpid);
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        method: 'getemployeebygroup',
                        groupid: encryptedGroupId,
                    }),
                });
                const result = await response.json();
                const employees = result.data || [];
                let deptCount = 0;
                for (const emp of employees) {
                    if (this.isValidEmployee(emp, appNumberMap)) {
                        try {
                            await this.supabase.upsert('employees_cache', {
                                store_id: null,
                                store_erpid: dept.grouperpid,
                                erpid: emp.erpid,
                                app_number: appNumberMap.get(emp.erpid),
                                name: emp.name,
                                jobtitle: emp.jobtitle || dept.name,
                                department: 'backend',
                                is_active: true,
                                synced_at: new Date().toISOString(),
                            }, { onConflict: 'erpid' });
                            deptCount++;
                        }
                        catch (e) {
                            this.logger.warn(`Failed to upsert employee ${emp.erpid}: ${e.message}`);
                        }
                    }
                }
                this.logger.log(`Department ${dept.name}: synced ${deptCount} employees`);
                totalSynced += deptCount;
            }
            catch (error) {
                this.logger.error(`Failed to sync department ${dept.name}: ${error.message}`);
            }
        }
        this.logger.log(`Backend sync completed: ${totalSynced} employees from ${BACKEND_DEPT_ERPIDS.length} departments`);
        return { synced: totalSynced, departments: BACKEND_DEPT_ERPIDS.length };
    }
    async syncAll() {
        const storeResult = await this.syncStoreEmployees();
        const backendResult = await this.syncBackendEmployees();
        return {
            stores: storeResult,
            backend: backendResult,
            total: storeResult.synced + backendResult.synced,
        };
    }
    async getStats() {
        const allEmployees = await this.supabase.findMany('employees_cache', {
            filters: { is_active: true },
        });
        const storeCount = allEmployees.filter(e => e.department === 'store').length;
        const backendCount = allEmployees.filter(e => e.department === 'backend').length;
        return {
            store_employees: storeCount,
            backend_employees: backendCount,
            total: allEmployees.length,
        };
    }
};
exports.EmployeeSyncService = EmployeeSyncService;
exports.EmployeeSyncService = EmployeeSyncService = EmployeeSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], EmployeeSyncService);
//# sourceMappingURL=employee-sync.service.js.map