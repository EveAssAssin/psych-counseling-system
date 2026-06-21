import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeeInsightService } from '../insight/employee-insight.service';
import { HolidaysService } from './holidays.service';
import { CaseDraftStoreService, CaseDraftPayload } from './case-draft-store.service';
import { AiPlannerService } from './ai-planner.service';
import { LefthandApiService } from '../sync/lefthand-api.service';
import {
  CreateCaseDraftDto, ConfirmCaseDto, UpdateCaseDto,
  UpdatePlanItemDto, CreateExecutionDto,
  UpsertStateTagDto, UpsertHolidayDto,
  TodayTasksQueryDto, ListCasesQueryDto,
} from './counseling-cases.dto';

@Injectable()
export class CounselingCasesService {
  private readonly logger = new Logger(CounselingCasesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly insight: EmployeeInsightService,
    private readonly holidays: HolidaysService,
    private readonly draftStore: CaseDraftStoreService,
    private readonly planner: AiPlannerService,
    private readonly lefthand: LefthandApiService,
  ) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  // ═══════════════════════════════════════════
  //  輔導員列表（前端 picker 用）
  // ═══════════════════════════════════════════

  async listActiveSupervisors() {
    const { data, error } = await this.db
      .from('authorized_supervisors')
      .select('id, identifier, name, role, line_user_id')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      identifier: r.identifier,
      name: r.name,
      role: r.role,
      has_line_binding: !!r.line_user_id,
    }));
  }

  // ═══════════════════════════════════════════
  //  員工出勤資料（左手 API #28）
  // ═══════════════════════════════════════════

  /**
   * 取得員工最近一段期間的出勤狀況（含休假、請假、加班）。
   * 給輔導案排程時提供參考，避免在員工放假日安排輔導。
   */
  async getEmployeeAttendance(appNumber: string, startDate?: string, endDate?: string) {
    // 預設過去 30 天 + 未來 14 天
    const today = new Date();
    const start = startDate || (() => {
      const d = new Date(today); d.setDate(d.getDate() - 30);
      return d.toISOString().slice(0, 10);
    })();
    const end = endDate || (() => {
      const d = new Date(today); d.setDate(d.getDate() + 14);
      return d.toISOString().slice(0, 10);
    })();

    // 1. app_number → erpid
    const { data: emp, error } = await this.db
      .from('employees')
      .select('id, name, employeeappnumber, employeeerpid')
      .eq('employeeappnumber', appNumber)
      .single();
    if (error || !emp) {
      throw new NotFoundException(`找不到員工 ${appNumber}`);
    }
    if (!emp.employeeerpid) {
      return {
        success: false,
        message: '此員工沒有 ERP ID，無法查詢出勤',
        employee: { name: emp.name, app_number: emp.employeeappnumber },
        days: [],
      };
    }

    // 2. 呼叫左手 API
    const r = await this.lefthand.getEmployeeAttendance([emp.employeeerpid], start, end);
    if (!r.success) {
      return {
        success: false,
        message: r.message,
        employee: { name: emp.name, app_number: emp.employeeappnumber, erp_id: emp.employeeerpid },
        days: [],
      };
    }

    const empData = (r.data || []).find((d: any) => d.employeeErpid === emp.employeeerpid) || r.data?.[0];
    const attendances = empData?.attendances || [];

    return {
      success: true,
      employee: {
        name: emp.name,
        app_number: emp.employeeappnumber,
        erp_id: emp.employeeerpid,
      },
      range: { start, end },
      days: attendances,
    };
  }

  // ═══════════════════════════════════════════
  //  狀態標籤字典
  // ═══════════════════════════════════════════

  async listStateTags(includeInactive = false) {
    let q = this.db.from('counseling_state_tags').select('*').order('sort_order');
    if (!includeInactive) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async upsertStateTag(dto: UpsertStateTagDto) {
    const { data, error } = await this.db
      .from('counseling_state_tags')
      .upsert({ ...dto, updated_at: new Date().toISOString() }, { onConflict: 'code' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deactivateStateTag(id: string) {
    const { error } = await this.db
      .from('counseling_state_tags')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  }

  // ═══════════════════════════════════════════
  //  假日表
  // ═══════════════════════════════════════════

  async listHolidays(year?: number) {
    let q = this.db.from('counseling_holidays').select('*').order('date');
    if (year) {
      q = q.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async upsertHoliday(dto: UpsertHolidayDto) {
    const { data, error } = await this.db
      .from('counseling_holidays')
      .upsert(dto, { onConflict: 'date' })
      .select()
      .single();
    if (error) throw error;
    this.holidays.invalidateCache();
    return data;
  }

  async deleteHoliday(date: string) {
    const { error } = await this.db.from('counseling_holidays').delete().eq('date', date);
    if (error) throw error;
    this.holidays.invalidateCache();
    return { success: true };
  }

  // ═══════════════════════════════════════════
  //  輔導案 CRUD
  // ═══════════════════════════════════════════

  async listCases(query: ListCasesQueryDto) {
    let q = this.db.from('counseling_cases').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (query.status) q = q.eq('status', query.status);
    if (query.supervisor_id) q = q.eq('supervisor_id', query.supervisor_id);
    if (query.employee_app_number) q = q.eq('employee_app_number', query.employee_app_number);
    if (query.state_tag_code) q = q.contains('state_tag_codes', [query.state_tag_code]);

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) throw error;
    return { items: data ?? [], total: count ?? 0, limit, offset };
  }

  async getCase(id: string) {
    const { data: caseRow, error } = await this.db
      .from('counseling_cases').select('*').eq('id', id).single();
    if (error || !caseRow) throw new NotFoundException(`Case ${id} not found`);

    const { data: items } = await this.db
      .from('counseling_plan_items').select('*')
      .eq('case_id', id)
      .order('sequence');

    const { data: executions } = await this.db
      .from('counseling_executions').select('*')
      .eq('case_id', id)
      .order('executed_at', { ascending: false });

    return { ...caseRow, plan_items: items ?? [], executions: executions ?? [] };
  }

  async updateCase(id: string, dto: UpdateCaseDto) {
    const { data, error } = await this.db
      .from('counseling_cases')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async closeCase(id: string, closingSummary: string) {
    return this.updateCase(id, {
      status: 'completed',
      closing_summary: closingSummary,
    } as UpdateCaseDto);
  }

  // ═══════════════════════════════════════════
  //  建案：草稿生成
  // ═══════════════════════════════════════════

  async createDraft(dto: CreateCaseDraftDto): Promise<{
    draft_token: string;
    summary: string;
    items: any[];
    workday_dates: string[];
    employee: { id: string; name: string; app_number: string };
    supervisor: { id: string; name: string };
    state_tags: any[];
    meta: Record<string, any>;
  }> {
    // 1. 查員工
    const { data: employee, error: empErr } = await this.db
      .from('employees')
      .select('id, name, employeeappnumber, employeeerpid, department, store_name, title, is_active')
      .eq('employeeappnumber', dto.employee_app_number)
      .single();
    if (empErr || !employee) {
      throw new NotFoundException(`找不到員工 ${dto.employee_app_number}`);
    }

    // 2. 查輔導員
    const { data: supervisor, error: supErr } = await this.db
      .from('authorized_supervisors')
      .select('id, name, identifier, is_active')
      .eq('id', dto.supervisor_id)
      .single();
    if (supErr || !supervisor) {
      throw new NotFoundException(`找不到輔導員 ${dto.supervisor_id}`);
    }
    if (!supervisor.is_active) {
      throw new BadRequestException('輔導員帳號已停用');
    }

    // 3. 查狀態標籤
    const { data: tagRows, error: tagErr } = await this.db
      .from('counseling_state_tags')
      .select('code, label, description, ai_prompt_hint, severity, default_duration_days')
      .in('code', dto.state_tag_codes);
    if (tagErr) throw tagErr;
    if (!tagRows || tagRows.length !== dto.state_tag_codes.length) {
      throw new BadRequestException('部分狀態標籤無效');
    }

    // 4. 算工作日陣列
    const workdayDates = await this.holidays.getWorkdayDates(dto.start_date, dto.target_end_date);
    if (workdayDates.length === 0) {
      throw new BadRequestException('期間內沒有任何工作日，請調整時間區間');
    }

    // 5. 拉 employee insight（容錯：失敗就 null，不阻擋建案）
    let insightSnapshot: any = null;
    let insightSummary: any = null;
    try {
      insightSnapshot = await this.insight.getInsight(dto.employee_app_number);
      insightSummary = insightSnapshot?.summary ?? null;
    } catch (err: any) {
      this.logger.warn(`Insight fetch failed for ${dto.employee_app_number}: ${err?.message}`);
    }

    // 6. 呼叫 AI 排程
    const aiOutput = await this.planner.generateDraft({
      employee: {
        name: employee.name,
        app_number: employee.employeeappnumber,
        department: employee.department,
        store_name: employee.store_name,
        title: employee.title,
      },
      state_tags: tagRows,
      state_description: dto.state_description,
      goal: dto.goal,
      allowed_methods: dto.allowed_methods,
      workday_count: workdayDates.length,
      start_date: dto.start_date,
      target_end_date: dto.target_end_date,
      insight_summary: insightSummary,
    });

    // 7. 把 workday_offset 映射到實際 workday 日期
    const draftItems = aiOutput.items.map((it, idx) => ({
      sequence: idx + 1,
      scheduled_date: workdayDates[Math.min(it.workday_offset, workdayDates.length - 1)],
      method: it.method,
      objective: it.objective,
      recommended_actions: it.recommended_actions,
      estimated_minutes: it.estimated_minutes,
    }));

    // 8. 暫存
    const payload: CaseDraftPayload = {
      form: dto,
      resolved: {
        employee_id: employee.id,
        employee_name: employee.name,
        supervisor_name: supervisor.name,
      },
      insight_snapshot: insightSnapshot,
      ai_summary: aiOutput.summary,
      draft_items: draftItems,
      ai_meta: aiOutput.meta,
      created_at: Date.now(),
    };
    const token = this.draftStore.put(payload);

    return {
      draft_token: token,
      summary: aiOutput.summary,
      items: draftItems,
      workday_dates: workdayDates,
      employee: { id: employee.id, name: employee.name, app_number: employee.employeeappnumber },
      supervisor: { id: supervisor.id, name: supervisor.name },
      state_tags: tagRows,
      meta: aiOutput.meta,
    };
  }

  // ═══════════════════════════════════════════
  //  建案：確認寫入
  // ═══════════════════════════════════════════

  async confirmCase(dto: ConfirmCaseDto): Promise<any> {
    const draft = this.draftStore.get(dto.draft_token);
    if (!draft) {
      throw new BadRequestException('草稿已過期或不存在，請重新生成');
    }

    let finalItems = draft.draft_items;
    if (dto.adjusted_plan_items && dto.adjusted_plan_items.length > 0) {
      const allowed = new Set(draft.form.allowed_methods);
      finalItems = dto.adjusted_plan_items
        .map((it, idx) => {
          if (!allowed.has(it.method)) {
            throw new BadRequestException(`第 ${idx + 1} 項使用了未授權的方法：${it.method}`);
          }
          return {
            sequence: it.sequence ?? idx + 1,
            scheduled_date: it.scheduled_date,
            method: it.method,
            objective: it.objective,
            recommended_actions: it.recommended_actions ?? {},
            estimated_minutes: it.estimated_minutes ?? 30,
          };
        })
        .sort((a, b) => (a.scheduled_date > b.scheduled_date ? 1 : -1))
        .map((x, i) => ({ ...x, sequence: i + 1 }));
    }

    if (finalItems.length === 0) {
      throw new BadRequestException('至少需要 1 個排程節點');
    }

    // 對齊工作日
    for (const item of finalItems) {
      const isWork = await this.holidays.isWorkday(item.scheduled_date);
      if (!isWork) {
        item.scheduled_date = await this.holidays.nextWorkday(item.scheduled_date);
      }
    }

    // 寫 case
    const summary = dto.adjusted_summary ?? draft.ai_summary;
    const { data: insertedCase, error: caseErr } = await this.db
      .from('counseling_cases')
      .insert({
        employee_id: draft.resolved.employee_id,
        employee_app_number: draft.form.employee_app_number,
        employee_name: draft.resolved.employee_name,
        supervisor_id: draft.form.supervisor_id,
        supervisor_name: draft.resolved.supervisor_name,
        state_tag_codes: draft.form.state_tag_codes,
        state_description: draft.form.state_description ?? null,
        goal: draft.form.goal,
        start_date: draft.form.start_date,
        target_end_date: draft.form.target_end_date,
        allowed_methods: draft.form.allowed_methods,
        status: 'active',
        initial_insight_snapshot: draft.insight_snapshot,
        ai_plan_summary: summary,
        ai_plan_meta: draft.ai_meta,
      })
      .select()
      .single();
    if (caseErr) throw caseErr;

    // 寫 plan_items
    const itemRows = finalItems.map(it => ({
      case_id: insertedCase.id,
      scheduled_date: it.scheduled_date,
      sequence: it.sequence,
      method: it.method,
      objective: it.objective,
      recommended_actions: it.recommended_actions,
      estimated_minutes: it.estimated_minutes,
      status: 'pending',
    }));
    const { error: itemsErr } = await this.db.from('counseling_plan_items').insert(itemRows);
    if (itemsErr) {
      await this.db.from('counseling_cases').delete().eq('id', insertedCase.id);
      throw itemsErr;
    }

    this.draftStore.delete(dto.draft_token);
    return this.getCase(insertedCase.id);
  }

  // ═══════════════════════════════════════════
  //  排程節點
  // ═══════════════════════════════════════════

  async updatePlanItem(itemId: string, dto: UpdatePlanItemDto) {
    if (dto.scheduled_date) {
      const { data: existing } = await this.db
        .from('counseling_plan_items')
        .select('original_scheduled_date, scheduled_date')
        .eq('id', itemId)
        .single();
      if (existing && !existing.original_scheduled_date) {
        (dto as any).original_scheduled_date = existing.scheduled_date;
      }
      const isWork = await this.holidays.isWorkday(dto.scheduled_date);
      if (!isWork) {
        dto.scheduled_date = await this.holidays.nextWorkday(dto.scheduled_date);
      }
    }
    const { data, error } = await this.db
      .from('counseling_plan_items')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════
  //  執行紀錄
  // ═══════════════════════════════════════════

  async createExecution(caseId: string, dto: CreateExecutionDto) {
    const payload = {
      case_id: caseId,
      plan_item_id: dto.plan_item_id ?? null,
      executed_at: dto.executed_at ?? new Date().toISOString(),
      actual_method: dto.actual_method,
      duration_minutes: dto.duration_minutes ?? null,
      what_happened: dto.what_happened,
      employee_reaction: dto.employee_reaction ?? null,
      next_action_hint: dto.next_action_hint ?? null,
      mood_score: dto.mood_score ?? null,
      attachments: dto.attachments ?? [],
      recorded_by: dto.recorded_by,
      recorded_by_name: dto.recorded_by_name,
    };

    const { data, error } = await this.db
      .from('counseling_executions')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    if (dto.plan_item_id) {
      await this.db
        .from('counseling_plan_items')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', dto.plan_item_id)
        .eq('status', 'pending');
    }
    return data;
  }

  async listExecutions(caseId: string) {
    const { data, error } = await this.db
      .from('counseling_executions').select('*')
      .eq('case_id', caseId)
      .order('executed_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════
  //  今日任務 dashboard
  // ═══════════════════════════════════════════

  async getTodayTasks(query: TodayTasksQueryDto) {
    const today = query.date ?? new Date().toISOString().slice(0, 10);
    let q = this.db.from('v_counseling_today').select('*').eq('scheduled_date', today);
    if (query.supervisor_id) q = q.eq('supervisor_id', query.supervisor_id);
    const { data, error } = await q.order('case_id').order('sequence');
    if (error) throw error;
    return { date: today, tasks: data ?? [] };
  }

  async getOverdueTasks(supervisorId?: string) {
    const today = new Date().toISOString().slice(0, 10);
    let q = this.db.from('v_counseling_today').select('*').lt('scheduled_date', today);
    if (supervisorId) q = q.eq('supervisor_id', supervisorId);
    const { data, error } = await q.order('scheduled_date');
    if (error) throw error;
    return { count: data?.length ?? 0, tasks: data ?? [] };
  }
}
