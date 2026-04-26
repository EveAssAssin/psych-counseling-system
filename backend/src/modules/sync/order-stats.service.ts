import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';

export interface OrderTrendItem {
  label: string;
  recentAvg: number;   // 近 3 個月平均接單數
  prevAvg: number;     // 前 3 個月平均接單數
  trend: 'up' | 'down' | 'stable' | 'new';
  changePercent: number | null; // 變化百分比，null 表示無歷史資料
  months: Array<{ year: number; month: number; count: number }>;
}

export interface EmployeeOrderTrend {
  hasData: boolean;
  lastSyncedMonth: string | null;
  totalTrend: OrderTrendItem;
  byLabel: OrderTrendItem[];
}

@Injectable()
export class OrderStatsService {
  private readonly logger = new Logger(OrderStatsService.name);

  private readonly E0123_BASE_URL = 'https://api.lohasglasses.com/openApi';
  private readonly E0123_COMPANY_ID: number;
  private readonly E0123_TOKEN: string;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {
    this.E0123_COMPANY_ID = parseInt(this.config.get<string>('E0123_COMPANY_ID') || '386201');
    this.E0123_TOKEN = this.config.get<string>('E0123_TOKEN') || '';
  }

  private get db() {
    return this.supabase.getAdminClient();
  }

  // ═══════════════════════════════════════════
  //  同步指定月份的訂單統計
  // ═══════════════════════════════════════════

  async syncMonthOrderStats(year: number, month: number): Promise<{
    success: boolean;
    synced: number;
    message: string;
  }> {
    this.logger.log(`Syncing order stats for ${year}-${String(month).padStart(2, '0')}`);

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    // 分頁抓取全部訂單
    let allOrders: any[] = [];
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

        const resp = await axios.post(
          `${this.E0123_BASE_URL}/getOrderList`,
          params,
          {
            timeout: 30000,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        );

        const data = resp.data;
        this.logger.log(`E0123 response: returnCode=${data.returnCode}, returnMsg=${data.returnMsg}, orders=${(data.orderList || []).length}`);
        if (data.returnCode !== 'SUCCESS') {
          this.logger.warn(`E0123 API error: ${data.returnMsg} (full: ${JSON.stringify(data).slice(0, 300)})`);
          return { success: false, synced: 0, message: `E0123 API 錯誤：${data.returnMsg || JSON.stringify(data).slice(0, 200)}` };
        }

        const orders: any[] = data.orderList || [];
        allOrders = allOrders.concat(orders);

        this.logger.log(`Page ${pageNum}: got ${orders.length} orders (total: ${allOrders.length})`);

        if (orders.length < pageSize) break; // 最後一頁
        pageNum++;
      } catch (err) {
        this.logger.error(`E0123 API call failed: ${err.message}`);
        return { success: false, synced: 0, message: err.message };
      }
    }

    if (allOrders.length === 0) {
      this.logger.warn(`No orders found for ${year}-${month}. Token set: ${!!this.E0123_TOKEN}, CompanyId: ${this.E0123_COMPANY_ID}`);
      return { success: true, synced: 0, message: `該月份無訂單資料（token=${this.E0123_TOKEN ? '已設定' : '未設定'}）` };
    }

    // ── 聚合：saleOpId + label ──
    const statsMap: Map<string, { count: number; amount: number }> = new Map();

    for (const order of allOrders) {
      const erpId = String(order.saleOpId || '');
      if (!erpId || erpId === '0') continue;

      // 解析訂單標籤（可能是逗號分隔字串）
      const rawLabels: string = order.order_label_names || '';
      const labels = rawLabels
        .split(/[,，、]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      const amount = parseFloat(order.realAmount || 0);

      // 計入「全部」
      const totalKey = `${erpId}||全部`;
      const totalEntry = statsMap.get(totalKey) || { count: 0, amount: 0 };
      totalEntry.count++;
      totalEntry.amount += amount;
      statsMap.set(totalKey, totalEntry);

      // 計入各個標籤（一張訂單可能同時有多個標籤）
      for (const label of labels) {
        const key = `${erpId}||${label}`;
        const entry = statsMap.get(key) || { count: 0, amount: 0 };
        entry.count++;
        entry.amount += amount;
        statsMap.set(key, entry);
      }
    }

    // ── 查詢員工對應（erp_id → app_number / uuid）──
    const erpIds = [...new Set([...statsMap.keys()].map(k => k.split('||')[0]))];
    const { data: empRows } = await this.db
      .from('employees')
      .select('id, employeeappnumber, employeeerpid')
      .in('employeeerpid', erpIds);

    const erpToEmp: Record<string, { id: string; app_number: string }> = {};
    for (const e of empRows || []) {
      if (e.employeeerpid) {
        erpToEmp[String(e.employeeerpid)] = { id: e.id, app_number: e.employeeappnumber };
      }
    }

    // ── Upsert 到 DB ──
    const upsertRows: any[] = [];
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

  // ── 自動同步（本月 + 上月，供排程使用）──
  async syncRecentMonths(): Promise<{ success: boolean; message: string }> {
    const now = new Date();
    const results: string[] = [];

    // 同步最近 2 個月
    for (let i = 0; i <= 1; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const r = await this.syncMonthOrderStats(d.getFullYear(), d.getMonth() + 1);
      results.push(`${d.getFullYear()}-${d.getMonth() + 1}: ${r.message}`);
    }

    return { success: true, message: results.join(' | ') };
  }

  // ═══════════════════════════════════════════
  //  取得員工業績趨勢（供 AI + 前端使用）
  // ═══════════════════════════════════════════

  async getEmployeeOrderTrend(appNumber: string): Promise<EmployeeOrderTrend> {
    // 取近 6 個月資料
    const now = new Date();
    const months: Array<{ year: number; month: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    const { data: rows } = await this.db
      .from('employee_order_stats')
      .select('period_year, period_month, label_name, order_count, total_amount')
      .eq('employee_app_number', appNumber)
      .or(
        months.map(m => `and(period_year.eq.${m.year},period_month.eq.${m.month})`).join(',')
      )
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

    // 找出所有標籤
    const allLabels = [...new Set(rows.map((r: any) => r.label_name))];
    const byLabel: OrderTrendItem[] = [];

    for (const label of allLabels) {
      const labelRows = rows.filter((r: any) => r.label_name === label);
      byLabel.push(this.calcTrend(label, labelRows, months));
    }

    const totalTrend = byLabel.find(t => t.label === '全部') || this.emptyTrend('全部');
    const otherLabels = byLabel.filter(t => t.label !== '全部');

    // 最後同步月份
    const lastMonth = months[months.length - 1];
    const lastSyncedMonth = `${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}`;

    return {
      hasData: true,
      lastSyncedMonth,
      totalTrend,
      byLabel: otherLabels.sort((a, b) => b.recentAvg - a.recentAvg),
    };
  }

  // ── 計算單一標籤的趨勢 ──
  private calcTrend(
    label: string,
    rows: any[],
    months: Array<{ year: number; month: number }>,
  ): OrderTrendItem {
    const monthData = months.map(m => {
      const row = rows.find((r: any) => r.period_year === m.year && r.period_month === m.month);
      return { year: m.year, month: m.month, count: row?.order_count ?? 0 };
    });

    // 近 3 個月 vs 前 3 個月
    const recent = monthData.slice(3);  // index 3,4,5
    const prev   = monthData.slice(0, 3); // index 0,1,2

    const recentAvg = recent.reduce((s, m) => s + m.count, 0) / 3;
    const prevAvg   = prev.reduce((s, m) => s + m.count, 0) / 3;

    let trend: OrderTrendItem['trend'] = 'stable';
    let changePercent: number | null = null;

    if (prevAvg === 0 && recentAvg > 0) {
      trend = 'new';
    } else if (prevAvg > 0) {
      changePercent = parseFloat(((recentAvg - prevAvg) / prevAvg * 100).toFixed(1));
      if (changePercent >= 10) trend = 'up';
      else if (changePercent <= -10) trend = 'down';
      else trend = 'stable';
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

  private emptyTrend(label: string): OrderTrendItem {
    return {
      label,
      recentAvg: 0,
      prevAvg: 0,
      trend: 'stable',
      changePercent: null,
      months: [],
    };
  }
}
