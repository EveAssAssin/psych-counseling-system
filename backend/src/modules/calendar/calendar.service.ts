import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LefthandApiService } from '../sync/lefthand-api.service';
import {
  CreateScheduleDto, UpdateScheduleDto, CancelScheduleDto,
  CreateSubcategoryDto, ListSchedulesQueryDto,
  CATEGORY_KEYS, CategoryKey,
} from './calendar.dto';

// 可安排面談的工作時間（時間軸範圍，之後可改為公司設定）
const WORK_START_MIN = 11 * 60; // 11:00
const WORK_END_MIN = 21 * 60;   // 21:00

// ── 純函式：時間工具（可單元測試）──
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
/** 兩段時間是否重疊（整段比對，非只比開始時間） */
export function isOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}
/**
 * HRM 出勤資料 → 當日是否「放假」（與既有 EmployeeAttendancePanel 判斷一致）。
 * 放假條件：attendanceResult 含「休」或「假」，或有請假項目，或有排休(dayOff)。
 * 其餘一律視為上班（上班日的 attendanceResult 可能是班別名稱、空字串等，不會固定為「上班」二字）。
 */
export function isDayOff(attendanceResult?: string | null, hasLeaveItems = false, hasDayOff = false): boolean {
  const r = attendanceResult || '';
  if (r.includes('休') || r.includes('假')) return true;
  if (hasLeaveItems) return true;
  if (hasDayOff) return true;
  return false;
}
/** 日期正規化為 YYYYMMDD，容錯 2026-08-03 / 2026/08/03 / 2026/8/3 */
function normDate(s?: string): string {
  if (!s) return '';
  const m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (m) return `${m[1]}${m[2].padStart(2, '0')}${m[3].padStart(2, '0')}`;
  return s.replace(/\D/g, '').slice(0, 8);
}
function sameDate(a?: string, b?: string): boolean {
  return !!a && !!b && normDate(a) === normDate(b);
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly lefthand: LefthandApiService,
  ) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  // 台北時區的今天 / 現在分鐘
  private nowTaipei(): { date: string; min: number } {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(new Date());
      const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
      const date = `${get('year')}-${get('month')}-${get('day')}`;
      let hh = get('hour');
      if (hh === '24') hh = '00';
      return { date, min: Number(hh) * 60 + Number(get('minute')) };
    } catch {
      // 後備：手動 UTC+8（避免部署環境缺完整 ICU 時崩潰）
      const t = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const date = t.toISOString().slice(0, 10);
      return { date, min: t.getUTCHours() * 60 + t.getUTCMinutes() };
    }
  }

  // ═══════════════════════════════════════════
  //  排休 / 出勤檢查（沿用既有 HRM 出勤 API #28）
  // ═══════════════════════════════════════════
  /**
   * 查某員工某日的排班狀態。
   * 回傳 status：
   *   'work'    有上班，可排程
   *   'off'     排休 / 休假 / 請假，不可排程
   *   'unknown' 查無資料 / API 失敗，保守禁止排程
   */
  async checkAttendance(appNumber: string, date: string): Promise<{
    status: 'work' | 'off' | 'unknown';
    raw: string | null;
    message: string;
    employee?: { name: string; app_number: string };
  }> {
    const { data: emp } = await this.db
      .from('employees')
      .select('id, name, employeeappnumber, employeeerpid')
      .eq('employeeappnumber', appNumber)
      .single();

    if (!emp) throw new NotFoundException(`找不到員工 ${appNumber}`);
    if (!emp.employeeerpid) {
      return { status: 'unknown', raw: null, message: '此員工沒有 ERP ID，無法確認出勤狀態。', employee: { name: emp.name, app_number: appNumber } };
    }

    const r = await this.lefthand.getEmployeeAttendance([emp.employeeerpid], date, date);
    if (!r.success) {
      return { status: 'unknown', raw: null, message: '目前無法確認該人員的出勤狀態，請稍後再試或確認排班資料。', employee: { name: emp.name, app_number: appNumber } };
    }
    const empData = (r.data || []).find((d: any) => d.employeeErpid === emp.employeeerpid) || r.data?.[0];
    const day = (empData?.attendances || []).find((a: any) => sameDate(a.workDate, date));

    if (!day) {
      return { status: 'unknown', raw: null, message: '目前查不到該人員當日的排班資料，請稍後再試或確認排班資料。', employee: { name: emp.name, app_number: appNumber } };
    }
    const result: string = day.attendanceResult || '';
    const hasLeave = Array.isArray(day.leaveItems) && day.leaveItems.length > 0;
    const hasDayOff = !!day.dayOff;
    if (!isDayOff(result, hasLeave, hasDayOff)) {
      return { status: 'work', raw: result || '上班', message: '已確認該人員當日有上班，可繼續建立排程。', employee: { name: emp.name, app_number: appNumber } };
    }
    return { status: 'off', raw: result || '休假', message: '該人員當日休假，無法建立排程。', employee: { name: emp.name, app_number: appNumber } };
  }

  // ═══════════════════════════════════════════
  //  週排程查詢
  // ═══════════════════════════════════════════
  async listSchedules(q: ListSchedulesQueryDto) {
    let query = this.db
      .from('calendar_schedules')
      .select('*')
      .gte('schedule_date', q.start_date)
      .lte('schedule_date', q.end_date)
      .order('schedule_date')
      .order('start_time');

    if (q.include_cancelled !== 'true') query = query.neq('status', 'cancelled');
    if (q.created_by_id) query = query.eq('created_by_id', q.created_by_id);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getOne(id: string) {
    const { data, error } = await this.db.from('calendar_schedules').select('*').eq('id', id).single();
    if (error || !data) throw new NotFoundException('找不到此排程');
    return data;
  }

  // ═══════════════════════════════════════════
  //  衝突檢查（整段重疊）
  // ═══════════════════════════════════════════
  private async findConflict(params: {
    date: string; startMin: number; endMin: number;
    empAppNumber: string; creatorId?: string; excludeId?: string;
  }): Promise<{ type: 'employee' | 'creator'; message: string } | null> {
    let query = this.db
      .from('calendar_schedules')
      .select('id, start_time, duration_minutes, employee_app_number, created_by_id')
      .eq('schedule_date', params.date)
      .neq('status', 'cancelled');
    if (params.excludeId) query = query.neq('id', params.excludeId);

    const { data, error } = await query;
    if (error) throw error;

    for (const it of data ?? []) {
      const s = toMin(String(it.start_time).slice(0, 5));
      const e = s + it.duration_minutes;
      if (!isOverlap(params.startMin, params.endMin, s, e)) continue;
      if (it.employee_app_number === params.empAppNumber) {
        return { type: 'employee', message: '該人員於此時段已有其他排程，請重新選擇時間。' };
      }
      if (params.creatorId && it.created_by_id === params.creatorId) {
        return { type: 'creator', message: '您於此時段已有其他排程，請確認是否調整時間。' };
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════
  //  小分類字典
  // ═══════════════════════════════════════════
  async listSubcategories(categoryKey?: string) {
    let query = this.db.from('calendar_subcategories').select('*').eq('is_active', true).order('name');
    if (categoryKey) query = query.eq('category_key', categoryKey);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async createSubcategory(dto: CreateSubcategoryDto) {
    const name = (dto.name || '').trim();
    if (!name) throw new BadRequestException('不可建立空白內容');
    if (name.length > 20) throw new BadRequestException('小分類名稱不可超過 20 字');

    // 同大分類下是否已存在（含停用）
    const { data: exist } = await this.db
      .from('calendar_subcategories')
      .select('id, is_active')
      .eq('category_key', dto.category_key)
      .eq('name', name)
      .maybeSingle();

    if (exist) {
      if (exist.is_active) throw new BadRequestException('此小分類已存在，請直接選擇既有項目。');
      // 曾停用 → 重新啟用
      const { data: reactivated, error: reErr } = await this.db
        .from('calendar_subcategories')
        .update({ is_active: true })
        .eq('id', exist.id)
        .select()
        .single();
      if (reErr) throw reErr;
      return reactivated;
    }

    const { data, error } = await this.db
      .from('calendar_subcategories')
      .insert({ category_key: dto.category_key, name, created_by: dto.created_by || null })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deactivateSubcategory(id: string) {
    const { data, error } = await this.db
      .from('calendar_subcategories')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /** 確保小分類存在（既有則取，缺則建），回傳 { id, name } */
  private async ensureSubcategory(categoryKey: CategoryKey, name: string, createdBy?: string): Promise<{ id: string; name: string }> {
    const clean = (name || '').trim();
    if (!clean) throw new BadRequestException('小分類不可為空白');
    if (clean.length > 20) throw new BadRequestException('小分類名稱不可超過 20 字');

    const { data: found } = await this.db
      .from('calendar_subcategories')
      .select('id, name, is_active')
      .eq('category_key', categoryKey)
      .eq('name', clean)
      .maybeSingle();

    if (found) {
      if (!found.is_active) {
        await this.db.from('calendar_subcategories').update({ is_active: true }).eq('id', found.id);
      }
      return { id: found.id, name: found.name };
    }
    const { data: created, error } = await this.db
      .from('calendar_subcategories')
      .insert({ category_key: categoryKey, name: clean, created_by: createdBy || null })
      .select('id, name')
      .single();
    if (error) throw error;
    return { id: created.id, name: created.name };
  }

  private async bumpSubcategoryUsage(id: string) {
    // 讀 → +1（無 RPC，簡單處理）
    const { data } = await this.db.from('calendar_subcategories').select('usage_count').eq('id', id).single();
    const next = (data?.usage_count ?? 0) + 1;
    await this.db.from('calendar_subcategories').update({ usage_count: next }).eq('id', id);
  }

  // ═══════════════════════════════════════════
  //  建立排程
  // ═══════════════════════════════════════════
  async create(dto: CreateScheduleDto) {
    const startMin = toMin(dto.start_time);
    const endMin = startMin + dto.duration_minutes;

    // 1. 工作時間範圍
    if (startMin < WORK_START_MIN || endMin > WORK_END_MIN) {
      throw new BadRequestException(`排程時間需落在 ${minToHHMM(WORK_START_MIN)}–${minToHHMM(WORK_END_MIN)} 之間`);
    }

    // 2. 不可為過去
    const now = this.nowTaipei();
    if (dto.schedule_date < now.date || (dto.schedule_date === now.date && startMin < now.min)) {
      throw new BadRequestException('不可選擇已經過的日期或時間。');
    }

    // 3. 員工存在且在職
    const { data: emp } = await this.db
      .from('employees')
      .select('id, name, employeeappnumber, store_name, is_active')
      .eq('employeeappnumber', dto.employee_app_number)
      .single();
    if (!emp) throw new NotFoundException(`找不到員工 ${dto.employee_app_number}`);
    if (emp.is_active === false) throw new BadRequestException('該員工已離職或停用，無法建立排程。');

    // 4. 排休檢查（保守：非上班一律擋）
    const att = await this.checkAttendance(dto.employee_app_number, dto.schedule_date);
    if (att.status !== 'work') {
      throw new BadRequestException(att.message);
    }

    // 5. 衝突檢查
    const conflict = await this.findConflict({
      date: dto.schedule_date, startMin, endMin,
      empAppNumber: dto.employee_app_number, creatorId: dto.created_by_id,
    });
    if (conflict) throw new BadRequestException(conflict.message);

    // 6. 小分類
    const sub = await this.ensureSubcategory(dto.category_key, dto.subcategory_name, dto.created_by);

    // 7. 寫入
    const { data, error } = await this.db
      .from('calendar_schedules')
      .insert({
        schedule_date: dto.schedule_date,
        start_time: dto.start_time,
        duration_minutes: dto.duration_minutes,
        end_time: minToHHMM(endMin),
        employee_id: emp.id,
        employee_app_number: emp.employeeappnumber,
        employee_name: emp.name,
        store_name: emp.store_name || null,
        category_key: dto.category_key,
        subcategory_id: sub.id,
        subcategory_name: sub.name,
        note: dto.note,
        attendance_check: att.raw,
        status: 'pending',
        created_by: dto.created_by || null,
        created_by_id: dto.created_by_id || null,
      })
      .select()
      .single();
    if (error) throw error;

    await this.bumpSubcategoryUsage(sub.id);
    return data;
  }

  // ═══════════════════════════════════════════
  //  更新排程
  // ═══════════════════════════════════════════
  async update(id: string, dto: UpdateScheduleDto) {
    const current = await this.getOne(id);
    if (current.status === 'cancelled') throw new BadRequestException('已取消的排程無法編輯。');

    const patch: Record<string, any> = {};
    const date = dto.schedule_date ?? current.schedule_date;
    const startStr = dto.start_time ?? String(current.start_time).slice(0, 5);
    const duration = dto.duration_minutes ?? current.duration_minutes;
    const empAppNumber = dto.employee_app_number ?? current.employee_app_number;
    const startMin = toMin(startStr);
    const endMin = startMin + duration;

    // 只在「值真的變了」時才重跑排休/衝突檢查（與前端一致、符合需求 15.1）
    const curStart = String(current.start_time).slice(0, 5);
    const timeOrPersonChanged =
      (dto.schedule_date !== undefined && dto.schedule_date !== current.schedule_date) ||
      (dto.start_time !== undefined && dto.start_time !== curStart) ||
      (dto.duration_minutes !== undefined && dto.duration_minutes !== current.duration_minutes) ||
      (dto.employee_app_number !== undefined && dto.employee_app_number !== current.employee_app_number);

    if (timeOrPersonChanged) {
      if (startMin < WORK_START_MIN || endMin > WORK_END_MIN) {
        throw new BadRequestException(`排程時間需落在 ${minToHHMM(WORK_START_MIN)}–${minToHHMM(WORK_END_MIN)} 之間`);
      }
      // 不可改到過去（與建立一致）
      const now = this.nowTaipei();
      if (date < now.date || (date === now.date && startMin < now.min)) {
        throw new BadRequestException('不可將排程改到已經過的日期或時間。');
      }
      // 換人 / 換日 → 重新排休檢查
      const att = await this.checkAttendance(empAppNumber, date);
      if (att.status !== 'work') throw new BadRequestException(att.message);
      patch.attendance_check = att.raw;

      // 重新衝突檢查（排除自己）
      const conflict = await this.findConflict({
        date, startMin, endMin, empAppNumber,
        creatorId: current.created_by_id, excludeId: id,
      });
      if (conflict) throw new BadRequestException(conflict.message);

      // 換人 → 更新冗餘欄位
      if (dto.employee_app_number !== undefined) {
        const { data: emp } = await this.db
          .from('employees')
          .select('id, name, employeeappnumber, store_name, is_active')
          .eq('employeeappnumber', empAppNumber)
          .single();
        if (!emp) throw new NotFoundException(`找不到員工 ${empAppNumber}`);
        if (emp.is_active === false) throw new BadRequestException('該員工已離職或停用。');
        patch.employee_id = emp.id;
        patch.employee_app_number = emp.employeeappnumber;
        patch.employee_name = emp.name;
        patch.store_name = emp.store_name || null;
      }
      patch.schedule_date = date;
      patch.start_time = startStr;
      patch.duration_minutes = duration;
      patch.end_time = minToHHMM(endMin);
    }

    // 分類
    const categoryKey = (dto.category_key ?? current.category_key) as CategoryKey;
    if (dto.subcategory_name !== undefined || dto.category_key !== undefined) {
      const subName = dto.subcategory_name ?? current.subcategory_name;
      const sub = await this.ensureSubcategory(categoryKey, subName, current.created_by);
      patch.category_key = categoryKey;
      patch.subcategory_id = sub.id;
      patch.subcategory_name = sub.name;
    }

    if (dto.note !== undefined) patch.note = dto.note;
    if (dto.status !== undefined) {
      patch.status = dto.status;
      if (dto.status === 'completed') patch.completed_at = new Date().toISOString();
    }
    if (dto.updated_by !== undefined) patch.updated_by = dto.updated_by;

    if (Object.keys(patch).length === 0) return current;

    const { data, error } = await this.db.from('calendar_schedules').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════
  //  取消排程（不實體刪除）
  // ═══════════════════════════════════════════
  async cancel(id: string, dto: CancelScheduleDto) {
    const current = await this.getOne(id);
    if (current.status === 'cancelled') return current;
    const { data, error } = await this.db
      .from('calendar_schedules')
      .update({ status: 'cancelled', cancel_reason: dto.cancel_reason, updated_by: dto.updated_by || null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
