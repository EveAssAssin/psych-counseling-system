import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeeInsightService } from '../insight/employee-insight.service';
import {
  CreateCaseDraftDto, ConfirmCaseDto, UpdateCaseDto,
  UpdatePlanItemDto, CreateExecutionDto,
  UpsertStateTagDto, UpsertHolidayDto,
  TodayTasksQueryDto, ListCasesQueryDto,
} from './counseling-cases.dto';

/**
 * Phase 1：CRUD 骨架 + 列表查詢。
 *
 * Phase 2 會接上 AI 排程生成（draftCase / confirmCase 的實作體）。
 * Phase 3 會強化今日任務 view 查詢與執行紀錄回填邏輯。
 * Phase 4 會把 supervisor_ai_sessions 加 case_id 後接 AI 討論。
 */
@Injectable()
export class CounselingCasesService {
  private readonly logger = new Logger(CounselingCasesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly insight: EmployeeInsightService,
  ) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  // ═══════════════════════════════════════════
  //  狀態標籤 / 假日字典（Phase 1 已可用）
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
    return data;
  }

  async deleteHoliday(date: string) {
    const { error } = await this.db.from('counseling_holidays').delete().eq('date', date);
    if (error) throw error;
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
  //  建案：草稿 / 確認（Phase 2 完整實作）
  // ═══════════════════════════════════════════

  /**
   * Phase 1 stub：回傳 NotImplemented，避免前端先接到時誤以為已可用。
   * Phase 2 會：
   *   1. 用 employee_app_number 查 employees 拿 employee_id / name
   *   2. 抓 EmployeeInsightService.getInsight(app_number) 拿快照
   *   3. 算工作日陣列（扣假日 + 週末）
   *   4. 組 Claude prompt，要求 JSON 輸出排程
   *   5. 把 (snapshot + draft items) 暫存在 Redis 或記憶體 Map，回 draft_token
   */
  async createDraft(dto: CreateCaseDraftDto): Promise<{ draft_token: string; preview: any }> {
    throw new BadRequestException('AI plan draft not implemented yet (Phase 2). Skeleton ready.');
  }

  /**
   * Phase 2 會：
   *   1. 用 draft_token 取回暫存 (snapshot + draft_items + form data)
   *   2. 把 adjusted_plan_items（若有）覆蓋 draft_items
   *   3. 插入 counseling_cases，把 initial_insight_snapshot 存入
   *   4. 插入 counseling_plan_items（已對齊工作日）
   *   5. 回完整 case
   */
  async confirmCase(dto: ConfirmCaseDto): Promise<any> {
    throw new BadRequestException('Case confirm not implemented yet (Phase 2). Skeleton ready.');
  }

  // ═══════════════════════════════════════════
  //  排程節點 CRUD
  // ═══════════════════════════════════════════

  async updatePlanItem(itemId: string, dto: UpdatePlanItemDto) {
    // 若是改期，自動記錄 original_scheduled_date
    if (dto.scheduled_date) {
      const { data: existing } = await this.db
        .from('counseling_plan_items')
        .select('original_scheduled_date, scheduled_date')
        .eq('id', itemId)
        .single();
      if (existing && !existing.original_scheduled_date) {
        (dto as any).original_scheduled_date = existing.scheduled_date;
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

    // 若有對應排程節點，順便把它標 done
    if (dto.plan_item_id) {
      await this.db
        .from('counseling_plan_items')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', dto.plan_item_id)
        .eq('status', 'pending'); // 已 done 的不重複改
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

  /**
   * 也回過期未完成（pending 但 scheduled_date < today）的任務，
   * 供前端 dashboard 警示「有遺漏」。
   */
  async getOverdueTasks(supervisorId?: string) {
    const today = new Date().toISOString().slice(0, 10);
    let q = this.db.from('v_counseling_today').select('*').lt('scheduled_date', today);
    if (supervisorId) q = q.eq('supervisor_id', supervisorId);
    const { data, error } = await q.order('scheduled_date');
    if (error) throw error;
    return { count: data?.length ?? 0, tasks: data ?? [] };
  }
}
