import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LefthandApiService } from '../sync/lefthand-api.service';
import { UploadService } from '../upload/upload.service';
import {
  CreateScheduleDto, UpdateScheduleDto, CancelScheduleDto,
  CreateSubcategoryDto, ListSchedulesQueryDto,
  OverdueHandleDto, MonitorPhotoDto,
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
    private readonly upload: UploadService,
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
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');
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
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');

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
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');
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
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');
    return data;
  }

  async renameSubcategory(id: string, name: string) {
    const clean = (name || '').trim();
    if (!clean) throw new BadRequestException('不可建立空白內容');
    if (clean.length > 20) throw new BadRequestException('小分類名稱不可超過 20 字');

    const { data: cur } = await this.db
      .from('calendar_subcategories')
      .select('id, category_key')
      .eq('id', id)
      .maybeSingle();
    if (!cur) throw new NotFoundException('找不到此小分類');

    // 同大分類下不可與其他項目重名
    const { data: dup } = await this.db
      .from('calendar_subcategories')
      .select('id')
      .eq('category_key', cur.category_key)
      .eq('name', clean)
      .neq('id', id)
      .maybeSingle();
    if (dup) throw new BadRequestException('此小分類已存在，請直接選擇既有項目。');

    const { data, error } = await this.db
      .from('calendar_subcategories')
      .update({ name: clean })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');
    return data;
  }

  async deactivateSubcategory(id: string) {
    const { data, error } = await this.db
      .from('calendar_subcategories')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');
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
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');
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

    // 2. 過去日期：開放補登（放寬限制）。isPast 供後續排休檢查略過使用。
    const now = this.nowTaipei();
    const isPast = dto.schedule_date < now.date;

    // 3. 員工存在且在職
    const { data: emp } = await this.db
      .from('employees')
      .select('id, name, employeeappnumber, store_name, is_active')
      .eq('employeeappnumber', dto.employee_app_number)
      .single();
    if (!emp) throw new NotFoundException(`找不到員工 ${dto.employee_app_number}`);
    if (emp.is_active === false) throw new BadRequestException('該員工已離職或停用，無法建立排程。');

    // 4. 排休檢查（保守：非上班一律擋）；過去日期為補登，略過排休阻擋。
    const att = await this.checkAttendance(dto.employee_app_number, dto.schedule_date);
    if (!isPast && att.status !== 'work') {
      throw new BadRequestException(att.message);
    }

    // 5. 衝突檢查
    const conflict = await this.findConflict({
      date: dto.schedule_date, startMin, endMin,
      empAppNumber: dto.employee_app_number, creatorId: dto.created_by_id,
    });
    if (conflict) throw new BadRequestException(conflict.message);

    // 6. 標籤（大/小分類皆可多選，第一個為主要；小分類掛在主要大分類下）
    const categoryKeys = this.resolveCategoryKeys(dto.category_keys, dto.category_key);
    const primaryCat = categoryKeys[0];
    const rawSubs = this.resolveSubNames(dto.subcategory_names, dto.subcategory_name);
    const ensuredSubs: { id: string; name: string }[] = [];
    for (const n of rawSubs) ensuredSubs.push(await this.ensureSubcategory(primaryCat, n, dto.created_by));
    const primarySub = ensuredSubs[0];

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
        category_key: primaryCat,
        category_keys: categoryKeys,
        subcategory_id: primarySub.id,
        subcategory_name: primarySub.name,
        subcategory_names: ensuredSubs.map((e) => e.name),
        note: dto.note,
        contact_method: dto.contact_method || null,
        attendance_check: att.raw,
        status: 'pending',
        created_by: dto.created_by || null,
        created_by_id: dto.created_by_id || null,
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');

    for (const s of ensuredSubs) await this.bumpSubcategoryUsage(s.id);
    return data;
  }

  /** 解析大分類多選（第一個為主要），相容單一 category_key */
  private resolveCategoryKeys(keys?: CategoryKey[], single?: CategoryKey): CategoryKey[] {
    const arr = (keys && keys.length ? keys : (single ? [single] : [])).filter(Boolean) as CategoryKey[];
    // 去重、保留順序
    const uniq = Array.from(new Set(arr));
    if (!uniq.length) throw new BadRequestException('請至少選擇一個標籤分類');
    return uniq;
  }

  /** 解析小分類多選（去空白、去重、保留順序），相容單一 subcategory_name */
  private resolveSubNames(names?: string[], single?: string): string[] {
    const arr = (names && names.length ? names : (single ? [single] : []))
      .map((s) => (s || '').trim()).filter(Boolean);
    const uniq = Array.from(new Set(arr));
    if (!uniq.length) throw new BadRequestException('請至少選擇一個標籤細項');
    return uniq;
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

    // 逾期不得直接改時間：必須走「逾期處理」流程（填原因＋上傳監控證明＋設定下次時間）
    const curEnd = new Date(`${current.schedule_date}T${curStart}:00`);
    curEnd.setMinutes(curEnd.getMinutes() + current.duration_minutes);
    const isOverdueNow =
      !['completed', 'closed', 'cancelled'].includes(current.status) &&
      curEnd.getTime() < Date.now();
    if (isOverdueNow && timeOrPersonChanged) {
      throw new BadRequestException('逾期案件不得直接修改時間，請改用「逾期處理」：先填逾期原因、上傳監控證明，再設定下次時間。');
    }

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

    // 分類（大/小分類多選；有帶任何一個就重算）
    const catChanged = dto.category_keys !== undefined || dto.category_key !== undefined;
    const subChanged = dto.subcategory_names !== undefined || dto.subcategory_name !== undefined;
    if (catChanged || subChanged) {
      const categoryKeys = this.resolveCategoryKeys(
        dto.category_keys ?? (dto.category_key ? [dto.category_key] : undefined) ?? (current.category_keys as CategoryKey[]),
        current.category_key,
      );
      const primaryCat = categoryKeys[0];
      const rawSubs = this.resolveSubNames(
        dto.subcategory_names ?? (dto.subcategory_name ? [dto.subcategory_name] : undefined) ?? (current.subcategory_names as string[]),
        current.subcategory_name,
      );
      const ensured: { id: string; name: string }[] = [];
      for (const n of rawSubs) ensured.push(await this.ensureSubcategory(primaryCat, n, current.created_by));
      patch.category_key = primaryCat;
      patch.category_keys = categoryKeys;
      patch.subcategory_id = ensured[0].id;
      patch.subcategory_name = ensured[0].name;
      patch.subcategory_names = ensured.map((e) => e.name);
    }

    if (dto.note !== undefined) patch.note = dto.note;
    if (dto.contact_method !== undefined) patch.contact_method = dto.contact_method;
    if (dto.actual_minutes !== undefined) patch.actual_minutes = dto.actual_minutes;
    if (dto.status !== undefined) {
      patch.status = dto.status;
      if (dto.status === 'completed') patch.completed_at = new Date().toISOString();
    }
    if (dto.updated_by !== undefined) patch.updated_by = dto.updated_by;

    if (Object.keys(patch).length === 0) return current;

    const { data, error } = await this.db.from('calendar_schedules').update(patch).eq('id', id).select().single();
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');
    return data;
  }

  // ═══════════════════════════════════════════
  //  標記已重新安排（逾期重排後於原排程留紀錄）
  // ═══════════════════════════════════════════
  async markRescheduled(id: string, toId?: string) {
    const { data, error } = await this.db
      .from('calendar_schedules')
      .update({ rescheduled_at: new Date().toISOString(), rescheduled_to_id: toId || null })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');
    return data;
  }

  // ═══════════════════════════════════════════
  //  逾期處理：填原因 + 設定下次時間 → 建立新排程、保留原始、寫改期歷史
  //  規則：需先上傳至少一張監控證明；逾期不得直接改時間
  // ═══════════════════════════════════════════
  async handleOverdue(id: string, dto: OverdueHandleDto) {
    const current = await this.getOne(id);
    if (['completed', 'closed', 'cancelled'].includes(current.status)) {
      throw new BadRequestException('此排程已結束，無法進行逾期處理。');
    }
    if (!dto.overdue_reason?.trim()) throw new BadRequestException('請填寫逾期原因。');

    // 需至少一張監控證明
    const { data: photos } = await this.db
      .from('schedule_monitor_photos').select('id').eq('schedule_id', id).limit(1);
    if (!photos || photos.length === 0) {
      throw new BadRequestException('請先上傳至少一張監控證明，才能進行逾期改期。');
    }

    // 下次時間驗證
    const startMin = toMin(dto.next_start_time);
    const endMin = startMin + dto.next_duration_minutes;
    if (startMin < WORK_START_MIN || endMin > WORK_END_MIN) {
      throw new BadRequestException(`排程時間需落在 ${minToHHMM(WORK_START_MIN)}–${minToHHMM(WORK_END_MIN)} 之間`);
    }
    const now = this.nowTaipei();
    if (dto.next_date < now.date || (dto.next_date === now.date && startMin < now.min)) {
      throw new BadRequestException('下次時間不可為已經過的日期或時間。');
    }

    // 建立新排程（複製原內容，套用新時間）
    const { data: newSched, error: insErr } = await this.db
      .from('calendar_schedules')
      .insert({
        schedule_date: dto.next_date,
        start_time: dto.next_start_time,
        duration_minutes: dto.next_duration_minutes,
        end_time: minToHHMM(endMin),
        employee_id: current.employee_id,
        employee_app_number: current.employee_app_number,
        employee_name: current.employee_name,
        store_name: current.store_name || null,
        category_key: current.category_key,
        category_keys: current.category_keys,
        subcategory_id: current.subcategory_id,
        subcategory_name: current.subcategory_name,
        subcategory_names: current.subcategory_names,
        note: current.note,
        contact_method: current.contact_method || null,
        status: 'pending',
        created_by: dto.changed_by || current.created_by || null,
        created_by_id: dto.changed_by_id || current.created_by_id || null,
      })
      .select().single();
    if (insErr) throw new BadRequestException(insErr.message || '建立新排程失敗');

    // 改期歷史（原始不覆蓋）
    await this.db.from('schedule_reschedules').insert({
      schedule_id: id,
      new_schedule_id: newSched.id,
      original_date: current.schedule_date,
      original_start_time: String(current.start_time).slice(0, 5),
      original_duration_minutes: current.duration_minutes,
      new_date: dto.next_date,
      new_start_time: dto.next_start_time,
      new_duration_minutes: dto.next_duration_minutes,
      reason: dto.overdue_reason.trim(),
      changed_by: dto.changed_by || null,
    });

    // 原排程：記逾期原因、標記已改期、狀態→待追蹤（保留原始日期時間）
    const { data: updated, error: updErr } = await this.db
      .from('calendar_schedules')
      .update({
        overdue_reason: dto.overdue_reason.trim(),
        rescheduled_at: new Date().toISOString(),
        rescheduled_to_id: newSched.id,
        status: 'awaiting_followup',
        updated_by: dto.changed_by || null,
      })
      .eq('id', id).select().single();
    if (updErr) throw new BadRequestException(updErr.message || '更新原排程失敗');

    return { original: updated, new_schedule: newSched };
  }

  // ── 監控證明照片 ──
  async addMonitorPhoto(id: string, file: Express.Multer.File, dto: MonitorPhotoDto) {
    await this.getOne(id);
    if (!file) throw new BadRequestException('請選擇要上傳的照片。');
    const up = await this.upload.uploadFile(file, 'calendar' as any, id);
    if (!up.success) throw new BadRequestException(up.error || '照片上傳失敗');
    const { data, error } = await this.db.from('schedule_monitor_photos').insert({
      schedule_id: id,
      image_url: up.url,
      image_path: up.path,
      note: dto.note || null,
      uploaded_by: dto.uploaded_by || null,
    }).select().single();
    if (error) throw new BadRequestException(error.message || '照片紀錄建立失敗');
    return data;
  }

  async listMonitorPhotos(id: string) {
    const { data, error } = await this.db.from('schedule_monitor_photos')
      .select('*').eq('schedule_id', id).order('uploaded_at', { ascending: true });
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');
    return data || [];
  }

  async deleteMonitorPhoto(photoId: string) {
    const { data: photo } = await this.db.from('schedule_monitor_photos').select('*').eq('id', photoId).single();
    if (!photo) throw new NotFoundException('找不到該監控證明。');
    const { data: sched } = await this.db.from('calendar_schedules').select('status').eq('id', photo.schedule_id).single();
    if (sched && ['completed', 'closed'].includes(sched.status)) {
      throw new BadRequestException('已完成／已結案的紀錄，監控證明不可刪除。');
    }
    if (photo.image_path) { try { await this.upload.deleteFile(photo.image_path); } catch { /* 忽略 storage 刪除失敗 */ } }
    const { error } = await this.db.from('schedule_monitor_photos').delete().eq('id', photoId);
    if (error) throw new BadRequestException(error.message || '刪除失敗');
    return { success: true };
  }

  async listReschedules(id: string) {
    const { data, error } = await this.db.from('schedule_reschedules')
      .select('*').eq('schedule_id', id).order('changed_at', { ascending: false });
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');
    return data || [];
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
    if (error) throw new BadRequestException(error.message || '資料庫操作失敗');
    return data;
  }
}
