import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export enum RiskFlagStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive',
}

export interface RiskFlag {
  id: string;
  analysis_result_id?: string;
  employee_id: string;
  risk_type: string;
  severity: string;
  title: string;
  description?: string;
  evidence_text?: string;
  status: RiskFlagStatus;
  assigned_to?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution_note?: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class RiskFlagsService {
  private readonly logger = new Logger(RiskFlagsService.name);
  private readonly TABLE = 'risk_flags';

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 取得所有開放的風險標記
   */
  async getOpenFlags(options?: {
    severity?: string;
    risk_type?: string;
    employee_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: RiskFlag[]; total: number }> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const client = this.supabase.getAdminClient();
    let query = client
      .from(this.TABLE)
      .select('*', { count: 'exact' })
      .in('status', ['open', 'acknowledged', 'in_progress']);

    if (options?.severity) {
      query = query.eq('severity', options.severity);
    }
    if (options?.risk_type) {
      query = query.eq('risk_type', options.risk_type);
    }
    if (options?.employee_id) {
      query = query.eq('employee_id', options.employee_id);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    return { data: data || [], total: count || 0 };
  }

  /**
   * 以「員工」為單位彙整風險：
   *   - AI 標記：risk_flags（開放中）依 employee_id 聚合
   *   - 輔導員標記：employees.risk_tags（危險/準淘汰/高關注，人工填寫）
   * 回傳每位有任一種標記的員工，並標示 has_ai / has_counselor 供前端篩選
   *   （全部 / AI / 輔導員 / 兩者皆有）。
   */
  async getRiskEmployees(): Promise<{ data: any[] }> {
    const client = this.supabase.getAdminClient();

    // 1. 開放中的 AI 風險標記，依員工聚合
    const { data: flags, error: fErr } = await client
      .from(this.TABLE)
      .select('employee_id, severity, risk_type, title, status, created_at')
      .in('status', ['open', 'acknowledged', 'in_progress'])
      .order('created_at', { ascending: false });
    if (fErr) throw fErr;

    const aiMap = new Map<string, any[]>();
    for (const f of flags || []) {
      if (!f.employee_id) continue;
      if (!aiMap.has(f.employee_id)) aiMap.set(f.employee_id, []);
      aiMap.get(f.employee_id)!.push(f);
    }

    // 2. 有輔導員手動風險標記（risk_tags 非空）的員工
    const { data: tagged, error: tErr } = await client
      .from('employees')
      .select('id, name, store_name, department, risk_tags, is_active, employeeappnumber')
      .not('risk_tags', 'is', null);
    if (tErr) throw tErr;
    const counselorEmps = (tagged || []).filter(
      (e: any) => Array.isArray(e.risk_tags) && e.risk_tags.length > 0,
    );

    // 3. 補抓「只有 AI 標記、但不在上面清單」的員工基本資料
    const byId = new Map<string, any>();
    for (const e of counselorEmps) byId.set(e.id, e);
    const missingAiIds = [...aiMap.keys()].filter((id) => !byId.has(id));
    if (missingAiIds.length) {
      const { data: aiEmps } = await client
        .from('employees')
        .select('id, name, store_name, department, risk_tags, is_active, employeeappnumber')
        .in('id', missingAiIds);
      for (const e of aiEmps || []) byId.set(e.id, e);
    }

    // 4. 組裝結果
    const result = [] as any[];
    for (const [id, emp] of byId) {
      const aiFlags = aiMap.get(id) || [];
      const riskTags = Array.isArray(emp.risk_tags) ? emp.risk_tags : [];
      result.push({
        employee_id: id,
        name: emp.name,
        store_name: emp.store_name || emp.department || null,
        app_number: emp.employeeappnumber,
        is_active: emp.is_active,
        ai_flags: aiFlags,
        ai_count: aiFlags.length,
        risk_tags: riskTags,
        has_ai: aiFlags.length > 0,
        has_counselor: riskTags.length > 0,
      });
    }
    // 兩者皆有的排前面，其次依姓名
    result.sort((a, b) =>
      (Number(b.has_ai && b.has_counselor) - Number(a.has_ai && a.has_counselor)) ||
      (a.name || '').localeCompare(b.name || '', 'zh-Hant'),
    );

    return { data: result };
  }

  /**
   * 取得高風險標記（critical + high）
   */
  async getHighRiskFlags(limit: number = 20): Promise<RiskFlag[]> {
    const client = this.supabase.getAdminClient();

    const { data, error } = await client
      .from(this.TABLE)
      .select('*')
      .in('status', ['open', 'acknowledged', 'in_progress'])
      .in('severity', ['critical', 'high'])
      .order('severity', { ascending: true }) // critical 排前面
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  }

  /**
   * 取得單一風險標記
   */
  async findById(id: string): Promise<RiskFlag> {
    const flag = await this.supabase.findOne<RiskFlag>(
      this.TABLE,
      { id },
      { useAdmin: true },
    );

    if (!flag) {
      throw new NotFoundException(`Risk flag not found: ${id}`);
    }

    return flag;
  }

  /**
   * 取得員工的風險標記
   */
  async findByEmployee(employeeId: string): Promise<RiskFlag[]> {
    return this.supabase.findMany<RiskFlag>(this.TABLE, {
      filters: { employee_id: employeeId },
      orderBy: { column: 'created_at', ascending: false },
      useAdmin: true,
    });
  }

  /**
   * 確認風險標記
   */
  async acknowledge(id: string, userId: string): Promise<RiskFlag> {
    const updated = await this.supabase.update<RiskFlag>(
      this.TABLE,
      { id },
      {
        status: RiskFlagStatus.ACKNOWLEDGED,
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      } as any,
      { useAdmin: true },
    );

    if (!updated) {
      throw new NotFoundException(`Risk flag not found: ${id}`);
    }

    this.logger.log(`Risk flag acknowledged: ${id} by ${userId}`);
    return updated;
  }

  /**
   * 開始處理風險標記
   */
  async startProgress(id: string, assignedTo?: string): Promise<RiskFlag> {
    const updated = await this.supabase.update<RiskFlag>(
      this.TABLE,
      { id },
      {
        status: RiskFlagStatus.IN_PROGRESS,
        assigned_to: assignedTo,
      } as any,
      { useAdmin: true },
    );

    if (!updated) {
      throw new NotFoundException(`Risk flag not found: ${id}`);
    }

    return updated;
  }

  /**
   * 解決風險標記
   */
  async resolve(
    id: string,
    userId: string,
    resolutionNote?: string,
  ): Promise<RiskFlag> {
    const updated = await this.supabase.update<RiskFlag>(
      this.TABLE,
      { id },
      {
        status: RiskFlagStatus.RESOLVED,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
        resolution_note: resolutionNote,
      } as any,
      { useAdmin: true },
    );

    if (!updated) {
      throw new NotFoundException(`Risk flag not found: ${id}`);
    }

    this.logger.log(`Risk flag resolved: ${id} by ${userId}`);
    return updated;
  }

  /**
   * 標記為誤報
   */
  async markAsFalsePositive(
    id: string,
    userId: string,
    note?: string,
  ): Promise<RiskFlag> {
    const updated = await this.supabase.update<RiskFlag>(
      this.TABLE,
      { id },
      {
        status: RiskFlagStatus.FALSE_POSITIVE,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
        resolution_note: note || 'Marked as false positive',
      } as any,
      { useAdmin: true },
    );

    if (!updated) {
      throw new NotFoundException(`Risk flag not found: ${id}`);
    }

    this.logger.log(`Risk flag marked as false positive: ${id}`);
    return updated;
  }

  /**
   * 取得統計
   */
  async getStats(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    critical: number;
    high: number;
  }> {
    const client = this.supabase.getAdminClient();

    const [total, open, inProgress, resolved, critical, high] = await Promise.all([
      this.supabase.count(this.TABLE, {}, { useAdmin: true }),
      this.supabase.count(this.TABLE, { status: 'open' }, { useAdmin: true }),
      this.supabase.count(this.TABLE, { status: 'in_progress' }, { useAdmin: true }),
      this.supabase.count(this.TABLE, { status: 'resolved' }, { useAdmin: true }),
      this.supabase.count(this.TABLE, { severity: 'critical' }, { useAdmin: true }),
      this.supabase.count(this.TABLE, { severity: 'high' }, { useAdmin: true }),
    ]);

    return { total, open, inProgress, resolved, critical, high };
  }
}
