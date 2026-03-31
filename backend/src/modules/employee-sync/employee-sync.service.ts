import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

// AES 加密設定
const AES_KEY = 'GmAOoS003d5OJ2G2';
const AES_IV = 'bgfDcfWdWG6NSUr5';

// 後勤部門清單
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

interface LeftHandEmployee {
  erpid: string;
  name: string;
  jobtitle?: string;
  isleave?: boolean;
  isfreeze?: boolean;
  grouperpid?: string;
}

interface AllEmployeeItem {
  employeeerpid: string;
  employeeappnumber: string;
  employeename: string;
}

@Injectable()
export class EmployeeSyncService {
  private readonly logger = new Logger(EmployeeSyncService.name);
  private readonly apiUrl = 'https://map.lohasglasses.com/_api/v1.ashx';

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * AES 加密
   */
  private aesEncrypt(text: string): string {
    const cipher = crypto.createCipheriv(
      'aes-128-cbc',
      Buffer.from(AES_KEY),
      Buffer.from(AES_IV),
    );
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  /**
   * 檢查是否為有效員工
   */
  private isValidEmployee(e: LeftHandEmployee, appNumberMap: Map<string, string>): boolean {
    return !!(
      e.erpid &&
      appNumberMap.has(e.erpid) &&
      !e.isleave &&
      !e.isfreeze &&
      !e.name?.includes('不指定') &&
      !e.erpid?.startsWith('9999')
    );
  }

  /**
   * 取得所有員工的 App 帳號對應表
   */
  async getAppNumberMap(): Promise<Map<string, string>> {
    this.logger.log('Fetching all employees for app number mapping...');
    
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'getallemployees' }),
    });

    const result = await response.json();
    const employees: AllEmployeeItem[] = result.data || [];
    
    const map = new Map<string, string>();
    for (const emp of employees) {
      if (emp.employeeerpid && emp.employeeappnumber) {
        map.set(emp.employeeerpid, emp.employeeappnumber);
      }
    }

    this.logger.log(`Found ${map.size} employees with app numbers`);
    return map;
  }

  /**
   * 同步門市員工
   */
  async syncStoreEmployees(): Promise<{ synced: number; stores: number }> {
    this.logger.log('Starting store employees sync...');
    
    // 1. 取得 app number 對應表
    const appNumberMap = await this.getAppNumberMap();

    // 2. 取得所有門市
    const stores = await this.supabase.findMany<any>('stores', {
      filters: { is_active: true },
    });

    this.logger.log(`Found ${stores.length} active stores`);

    let totalSynced = 0;

    // 3. 逐一同步每間門市
    for (const store of stores) {
      try {
        // 取得該門市員工
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
        const employees: LeftHandEmployee[] = result.data || [];

        // 過濾有效員工並 upsert
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
            } catch (e) {
              this.logger.warn(`Failed to upsert employee ${emp.erpid}: ${e.message}`);
            }
          }
        }

        this.logger.log(`Store ${store.name}: synced ${storeCount} employees`);
        totalSynced += storeCount;
      } catch (error) {
        this.logger.error(`Failed to sync store ${store.name}: ${error.message}`);
      }
    }

    this.logger.log(`Store sync completed: ${totalSynced} employees from ${stores.length} stores`);
    return { synced: totalSynced, stores: stores.length };
  }

  /**
   * 同步後勤人員
   */
  async syncBackendEmployees(): Promise<{ synced: number; departments: number }> {
    this.logger.log('Starting backend employees sync...');

    // 1. 取得 app number 對應表
    const appNumberMap = await this.getAppNumberMap();

    let totalSynced = 0;

    // 2. 逐一同步每個後勤部門
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
        const employees: LeftHandEmployee[] = result.data || [];

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
            } catch (e) {
              this.logger.warn(`Failed to upsert employee ${emp.erpid}: ${e.message}`);
            }
          }
        }

        this.logger.log(`Department ${dept.name}: synced ${deptCount} employees`);
        totalSynced += deptCount;
      } catch (error) {
        this.logger.error(`Failed to sync department ${dept.name}: ${error.message}`);
      }
    }

    this.logger.log(`Backend sync completed: ${totalSynced} employees from ${BACKEND_DEPT_ERPIDS.length} departments`);
    return { synced: totalSynced, departments: BACKEND_DEPT_ERPIDS.length };
  }

  /**
   * 完整同步（門市 + 後勤）
   */
  async syncAll(): Promise<any> {
    const storeResult = await this.syncStoreEmployees();
    const backendResult = await this.syncBackendEmployees();

    return {
      stores: storeResult,
      backend: backendResult,
      total: storeResult.synced + backendResult.synced,
    };
  }

  /**
   * 取得同步統計
   */
  async getStats(): Promise<any> {
    const allEmployees = await this.supabase.findMany<any>('employees_cache', {
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
}
