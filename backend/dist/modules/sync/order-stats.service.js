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
var OrderStatsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStatsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const supabase_service_1 = require("../supabase/supabase.service");
let OrderStatsService = OrderStatsService_1 = class OrderStatsService {
    constructor(supabase, config) {
        this.supabase = supabase;
        this.config = config;
        this.logger = new common_1.Logger(OrderStatsService_1.name);
        this.E0123_BASE_URL = 'https://api.lohasglasses.com/openApi';
        this.E0123_COMPANY_ID = parseInt(this.config.get('E0123_COMPANY_ID') || '386201');
        this.E0123_TOKEN = this.config.get('E0123_TOKEN') || '';
    }
    get db() {
        return this.supabase.getAdminClient();
    }
    async syncMonthOrderStats(year, month) {
        this.logger.log(`Syncing order stats for ${year}-${String(month).padStart(2, '0')}`);
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        let allOrders = [];
        let pageNum = 1;
        const pageSize = 1000;
        while (true) {
            try {
                const params = new URLSearchParams();
                params.append('companyId', String(this.E0123_COMPANY_ID));
                params.append('token', this.E0123_TOKEN);
                params.append('createDateStart', startDate);
                params.append('createDateEnd', endDate);
                params.append('pageNum', String(pageNum));
                params.append('pageSize', String(pageSize));
                const resp = await axios_1.default.post(`${this.E0123_BASE_URL}/getOrderList`, params, {
                    timeout: 30000,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                });
                const data = resp.data;
                this.logger.log(`E0123 response: returnCode=${data.returnCode}, returnMsg=${data.returnMsg}, orders=${(data.orderList || []).length}`);
                if (data.returnCode !== 'SUCCESS') {
                    this.logger.warn(`E0123 API error: ${data.returnMsg} (full: ${JSON.stringify(data).slice(0, 300)})`);
                    return { success: false, synced: 0, message: `E0123 API 錯誤：${data.returnMsg || JSON.stringify(data).slice(0, 200)}` };
                }
                const orders = data.orderList || [];
                allOrders = allOrders.concat(orders);
                this.logger.log(`Page ${pageNum}: got ${orders.length} orders (total: ${allOrders.length})`);
                if (orders.length < pageSize)
                    break;
                pageNum++;
            }
            catch (err) {
                this.logger.error(`E0123 API call failed: ${err.message}`);
                return { success: false, synced: 0, message: err.message };
            }
        }
        if (allOrders.length === 0) {
            this.logger.warn(`No orders found for ${year}-${month}. Token set: ${!!this.E0123_TOKEN}, CompanyId: ${this.E0123_COMPANY_ID}`);
            return { success: true, synced: 0, message: `該月份無訂單資料（token=${this.E0123_TOKEN ? '已設定' : '未設定'}）` };
        }
        const statsMap = new Map();
        for (const order of allOrders) {
            const erpId = String(order.saleOpId || '');
            if (!erpId || erpId === '0')
                continue;
            const rawLabels = order.order_label_names || '';
            const labels = rawLabels
                .split(/[,，、]/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            const amount = parseFloat(order.realAmount || 0);
            const totalKey = `${erpId}||全部`;
            const totalEntry = statsMap.get(totalKey) || { count: 0, amount: 0 };
            totalEntry.count++;
            totalEntry.amount += amount;
            statsMap.set(totalKey, totalEntry);
            for (const label of labels) {
                const key = `${erpId}||${label}`;
                const entry = statsMap.get(key) || { count: 0, amount: 0 };
                entry.count++;
                entry.amount += amount;
                statsMap.set(key, entry);
            }
        }
        const erpIds = [...new Set([...statsMap.keys()].map(k => k.split('||')[0]))];
        const { data: empRows } = await this.db
            .from('employees')
            .select('id, employeeappnumber, employeeerpid')
            .in('employeeerpid', erpIds);
        const erpToEmp = {};
        for (const e of empRows || []) {
            if (e.employeeerpid) {
                erpToEmp[String(e.employeeerpid)] = { id: e.id, app_number: e.employeeappnumber };
            }
        }
        const upsertRows = [];
        for (const [key, val] of statsMap.entries()) {
            const [erpId, label] = key.split('||');
            const emp = erpToEmp[erpId];
            upsertRows.push({
                erp_id: erpId,
                employee_id: emp?.id || null,
                employee_app_number: emp?.app_number || null,
                period_year: year,
                period_month: month,
                label_name: label,
                order_count: val.count,
                total_amount: parseFloat(val.amount.toFixed(2)),
                synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }
        const { error } = await this.db
            .from('employee_order_stats')
            .upsert(upsertRows, {
            onConflict: 'erp_id,period_year,period_month,label_name',
            ignoreDuplicates: false,
        });
        if (error) {
            this.logger.error(`Upsert failed: ${error.message}`);
            return { success: false, synced: 0, message: error.message };
        }
        this.logger.log(`Synced ${upsertRows.length} stats rows for ${year}-${month}`);
        return { success: true, synced: upsertRows.length, message: `已同步 ${allOrders.length} 筆訂單，產生 ${upsertRows.length} 筆統計` };
    }
    async syncRecentMonths() {
        const now = new Date();
        const results = [];
        for (let i = 0; i <= 1; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const r = await this.syncMonthOrderStats(d.getFullYear(), d.getMonth() + 1);
            results.push(`${d.getFullYear()}-${d.getMonth() + 1}: ${r.message}`);
        }
        return { success: true, message: results.join(' | ') };
    }
    async getEmployeeOrderTrend(appNumber) {
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
        }
        const { data: rows } = await this.db
            .from('employee_order_stats')
            .select('period_year, period_month, label_name, order_count, total_amount')
            .eq('employee_app_number', appNumber)
            .or(months.map(m => `and(period_year.eq.${m.year},period_month.eq.${m.month})`).join(','))
            .order('period_year')
            .order('period_month');
        if (!rows || rows.length === 0) {
            return {
                hasData: false,
                lastSyncedMonth: null,
                totalTrend: this.emptyTrend('全部'),
                byLabel: [],
            };
        }
        const allLabels = [...new Set(rows.map((r) => r.label_name))];
        const byLabel = [];
        for (const label of allLabels) {
            const labelRows = rows.filter((r) => r.label_name === label);
            byLabel.push(this.calcTrend(label, labelRows, months));
        }
        const totalTrend = byLabel.find(t => t.label === '全部') || this.emptyTrend('全部');
        const otherLabels = byLabel.filter(t => t.label !== '全部');
        const lastMonth = months[months.length - 1];
        const lastSyncedMonth = `${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}`;
        return {
            hasData: true,
            lastSyncedMonth,
            totalTrend,
            byLabel: otherLabels.sort((a, b) => b.recentAvg - a.recentAvg),
        };
    }
    calcTrend(label, rows, months) {
        const monthData = months.map(m => {
            const row = rows.find((r) => r.period_year === m.year && r.period_month === m.month);
            return { year: m.year, month: m.month, count: row?.order_count ?? 0 };
        });
        const recent = monthData.slice(3);
        const prev = monthData.slice(0, 3);
        const recentAvg = recent.reduce((s, m) => s + m.count, 0) / 3;
        const prevAvg = prev.reduce((s, m) => s + m.count, 0) / 3;
        let trend = 'stable';
        let changePercent = null;
        if (prevAvg === 0 && recentAvg > 0) {
            trend = 'new';
        }
        else if (prevAvg > 0) {
            changePercent = parseFloat(((recentAvg - prevAvg) / prevAvg * 100).toFixed(1));
            if (changePercent >= 10)
                trend = 'up';
            else if (changePercent <= -10)
                trend = 'down';
            else
                trend = 'stable';
        }
        return {
            label,
            recentAvg: parseFloat(recentAvg.toFixed(1)),
            prevAvg: parseFloat(prevAvg.toFixed(1)),
            trend,
            changePercent,
            months: monthData,
        };
    }
    emptyTrend(label) {
        return {
            label,
            recentAvg: 0,
            prevAvg: 0,
            trend: 'stable',
            changePercent: null,
            months: [],
        };
    }
    async getStoreMemberTrends(storeName, excludeAppNumber) {
        const { data: storeEmps } = await this.db
            .from('employees')
            .select('employeeappnumber, name')
            .eq('store_name', storeName)
            .eq('is_active', true);
        if (!storeEmps || storeEmps.length === 0) {
            return { memberCount: 0, storeAvg: { recentAvg: 0, prevAvg: 0, changePercent: null, trend: 'stable' }, members: [] };
        }
        const targets = storeEmps.filter((e) => e.employeeappnumber !== excludeAppNumber);
        if (targets.length === 0) {
            return { memberCount: 0, storeAvg: { recentAvg: 0, prevAvg: 0, changePercent: null, trend: 'stable' }, members: [] };
        }
        const memberResults = await Promise.all(targets.map(async (e) => {
            const trend = await this.getEmployeeOrderTrend(e.employeeappnumber);
            return {
                name: e.name,
                app_number: e.employeeappnumber,
                recentAvg: trend.totalTrend.recentAvg,
                prevAvg: trend.totalTrend.prevAvg,
                trend: trend.totalTrend.trend,
                changePercent: trend.totalTrend.changePercent,
            };
        }));
        const membersWithData = memberResults.filter(m => m.recentAvg > 0 || m.prevAvg > 0);
        const avgRecent = membersWithData.length > 0
            ? parseFloat((membersWithData.reduce((s, m) => s + m.recentAvg, 0) / membersWithData.length).toFixed(1))
            : 0;
        const avgPrev = membersWithData.length > 0
            ? parseFloat((membersWithData.reduce((s, m) => s + m.prevAvg, 0) / membersWithData.length).toFixed(1))
            : 0;
        const storeChangePercent = avgPrev > 0
            ? parseFloat(((avgRecent - avgPrev) / avgPrev * 100).toFixed(1))
            : null;
        const storeTrendDir = storeChangePercent === null ? 'stable'
            : storeChangePercent >= 10 ? 'up' : storeChangePercent <= -10 ? 'down' : 'stable';
        return {
            memberCount: targets.length,
            storeAvg: { recentAvg: avgRecent, prevAvg: avgPrev, changePercent: storeChangePercent, trend: storeTrendDir },
            members: memberResults,
        };
    }
};
exports.OrderStatsService = OrderStatsService;
exports.OrderStatsService = OrderStatsService = OrderStatsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        config_1.ConfigService])
], OrderStatsService);
//# sourceMappingURL=order-stats.service.js.map