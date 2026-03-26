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
