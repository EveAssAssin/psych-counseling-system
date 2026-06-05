import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * 工作日計算工具：扣假日 + 週末 + 補班日覆蓋。
 *
 * 設計：
 *   - 假日表來自 counseling_holidays（type = national / company / makeup_workday）
 *   - makeup_workday + is_workday=true 的日子，即使是週六/週日也算工作日
 *   - 一般 weekend 由程式判斷（不入表）
 *   - 內部 cache holidays 10 分鐘，避免每次排程都跑 DB
 */
@Injectable()
export class HolidaysService {
  private readonly logger = new Logger(HolidaysService.name);
  private cache: { fetchedAt: number; map: Map<string, { type: string; is_workday: boolean }> } | null = null;
  private readonly TTL_MS = 10 * 60 * 1000;

  constructor(private readonly supabase: SupabaseService) {}

  private get db() { return this.supabase.getAdminClient(); }

  invalidateCache() { this.cache = null; }

  private async ensureCache() {
    if (this.cache && Date.now() - this.cache.fetchedAt < this.TTL_MS) return this.cache.map;
    const { data, error } = await this.db
      .from('counseling_holidays')
      .select('date, type, is_workday');
    if (error) throw error;
    const map = new Map<string, { type: string; is_workday: boolean }>();
    for (const row of data ?? []) {
      map.set(row.date, { type: row.type, is_workday: !!row.is_workday });
    }
    this.cache = { fetchedAt: Date.now(), map };
    return map;
  }

  /** YYYY-MM-DD 字串 → Date object（避免時區飄移，固定當地 0:00） */
  private parseDate(d: string | Date): Date {
    if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** 判斷某日是不是工作日 */
  async isWorkday(date: string | Date): Promise<boolean> {
    const d = this.parseDate(date);
    const key = this.formatDate(d);
    const map = await this.ensureCache();
    const entry = map.get(key);

    // 補班日：明確標記為工作日，覆蓋週末判斷
    if (entry && entry.is_workday) return true;

    // 假日（national / company）→ 非工作日
    if (entry && !entry.is_workday) return false;

    // 沒在假日表 → 看是不是週末
    const dow = d.getDay(); // 0=Sun, 6=Sat
    return dow !== 0 && dow !== 6;
  }

  /** 找下一個工作日（含 fromDate 本身若為工作日） */
  async nextWorkday(fromDate: string | Date): Promise<string> {
    let d = this.parseDate(fromDate);
    for (let i = 0; i < 30; i++) { // 防呆，連續 30 天都不是工作日就有問題
      if (await this.isWorkday(d)) return this.formatDate(d);
      d.setDate(d.getDate() + 1);
    }
    throw new Error(`No workday found within 30 days from ${this.formatDate(this.parseDate(fromDate))}`);
  }

  /** 取得 [start, end] 區間（含兩端）內所有工作日的日期字串陣列 */
  async getWorkdayDates(start: string | Date, end: string | Date): Promise<string[]> {
    const startD = this.parseDate(start);
    const endD = this.parseDate(end);
    if (startD > endD) return [];
    const result: string[] = [];
    const cur = new Date(startD);
    while (cur <= endD) {
      if (await this.isWorkday(cur)) result.push(this.formatDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  /** 計算 [start, end] 區間內工作日數量 */
  async workdaysBetween(start: string | Date, end: string | Date): Promise<number> {
    return (await this.getWorkdayDates(start, end)).length;
  }

  /** 從 startDate 起跳第 N 個工作日（startDate 若為工作日算第 0 個） */
  async addWorkdays(startDate: string | Date, n: number): Promise<string> {
    if (n < 0) throw new Error('n must be >= 0');
    let d = this.parseDate(startDate);
    // 先把 d 對齊到第一個工作日
    while (!(await this.isWorkday(d))) d.setDate(d.getDate() + 1);
    let count = 0;
    while (count < n) {
      d.setDate(d.getDate() + 1);
      if (await this.isWorkday(d)) count++;
    }
    return this.formatDate(d);
  }
}
