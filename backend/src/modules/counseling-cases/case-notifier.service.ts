import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * 每日輔導排程 LINE 推播。
 *
 * 設計：
 *   - 推播時機：平日 (Mon-Fri) 早上 8:30 (Asia/Taipei)
 *   - 推播對象：authorized_supervisors 中 line_user_id 不為 NULL 的輔導員
 *   - 推播內容：當日 v_counseling_today 視該輔導員的待辦 + 過期警示
 *   - 沒有任務的輔導員不推（避免噪音）
 *   - 推送失敗單一輔導員不影響其他人
 */
@Injectable()
export class CaseNotifierService {
  private readonly logger = new Logger(CaseNotifierService.name);
  private readonly LINE_PUSH_API = 'https://api.line.me/v2/bot/message/push';

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private get db() { return this.supabase.getAdminClient(); }

  private get lineToken(): string | undefined {
    return this.config.get<string>('LINE_CHANNEL_ACCESS_TOKEN');
  }

  // ═══════════════════════════════════════════
  //  排程觸發：每平日 8:30 (Asia/Taipei)
  // ═══════════════════════════════════════════

  @Cron('30 8 * * 1-5', { timeZone: 'Asia/Taipei' })
  async dailyMorningPush() {
    this.logger.log('[Cron] 開始推送今日輔導排程...');
    try {
      const result = await this.pushTodayTasksToAll();
      this.logger.log(`[Cron] 推送完成：sent=${result.sent}, skipped=${result.skipped}, failed=${result.failed}`);
    } catch (err: any) {
      this.logger.error(`[Cron] 推送失敗：${err?.message}`, err?.stack);
    }
  }

  // ═══════════════════════════════════════════
  //  綁定 LINE userId（upsert：沒 supervisor 自動建）
  // ═══════════════════════════════════════════

  async bindLineUserId(identifier: string, lineUserId: string) {
    if (!lineUserId || !lineUserId.startsWith('U') || lineUserId.length < 30) {
      throw new BadRequestException('LINE userId 格式不正確（應為 U 開頭的長字串）');
    }

    // 先試 UPDATE
    const { data: updated, error: updErr } = await this.db
      .from('authorized_supervisors')
      .update({ line_user_id: lineUserId, updated_at: new Date().toISOString() })
      .eq('identifier', identifier)
      .select('id, identifier, name, line_user_id, role, is_active')
      .maybeSingle();

    if (updErr) throw updErr;
    if (updated) return updated;

    // 沒有對應 supervisor → 從 employees 查姓名後自動建立
    const { data: emp } = await this.db
      .from('employees')
      .select('name, employeeappnumber')
      .eq('employeeappnumber', identifier)
      .maybeSingle();
    if (!emp) {
      throw new NotFoundException(`員工 ${identifier} 不存在，無法綁定`);
    }

    const { data: inserted, error: insErr } = await this.db
      .from('authorized_supervisors')
      .insert({
        identifier,
        name: emp.name,
        role: 'counselor',
        is_active: true,
        line_user_id: lineUserId,
      })
      .select('id, identifier, name, line_user_id, role, is_active')
      .single();
    if (insErr) throw insErr;
    this.logger.log(`Auto-created authorized_supervisor for ${identifier} (${emp.name}) with LINE binding`);
    return inserted;
  }

  async unbindLineUserId(identifier: string) {
    const { data, error } = await this.db
      .from('authorized_supervisors')
      .update({ line_user_id: null, updated_at: new Date().toISOString() })
      .eq('identifier', identifier)
      .select('id, identifier, name')
      .single();
    if (error || !data) throw new NotFoundException(`找不到輔導員 ${identifier}`);
    return data;
  }

  // ═══════════════════════════════════════════
  //  推播：所有已綁定輔導員
  // ═══════════════════════════════════════════

  async pushTodayTasksToAll(): Promise<{ sent: number; skipped: number; failed: number; details: any[] }> {
    if (!this.lineToken) {
      this.logger.warn('LINE_CHANNEL_ACCESS_TOKEN 未設定，跳過推播');
      return { sent: 0, skipped: 0, failed: 0, details: [{ reason: 'no_token' }] };
    }

    const { data: supervisors, error } = await this.db
      .from('authorized_supervisors')
      .select('id, identifier, name, line_user_id')
      .eq('is_active', true)
      .not('line_user_id', 'is', null);
    if (error) throw error;

    let sent = 0, skipped = 0, failed = 0;
    const details: any[] = [];

    for (const sup of supervisors ?? []) {
      try {
        const res = await this.pushTodayTasksToSupervisor(sup.id);
        if (res.pushed) sent++;
        else skipped++;
        details.push({ supervisor_id: sup.id, name: sup.name, ...res });
      } catch (err: any) {
        failed++;
        details.push({ supervisor_id: sup.id, name: sup.name, error: err?.message });
        this.logger.warn(`Push to ${sup.identifier} failed: ${err?.message}`);
      }
    }
    return { sent, skipped, failed, details };
  }

  // ═══════════════════════════════════════════
  //  推播：單一輔導員
  // ═══════════════════════════════════════════

  async pushTodayTasksToSupervisor(supervisorId: string): Promise<{
    pushed: boolean;
    reason?: string;
    today_count?: number;
    overdue_count?: number;
  }> {
    const { data: sup } = await this.db
      .from('authorized_supervisors')
      .select('id, identifier, name, line_user_id, is_active')
      .eq('id', supervisorId)
      .single();
    if (!sup) return { pushed: false, reason: 'supervisor_not_found' };
    if (!sup.is_active) return { pushed: false, reason: 'supervisor_inactive' };
    if (!sup.line_user_id) return { pushed: false, reason: 'no_line_binding' };

    const today = this.todayInTaipei();

    const { data: todayTasks } = await this.db
      .from('v_counseling_today').select('*')
      .eq('supervisor_id', supervisorId)
      .eq('scheduled_date', today)
      .order('case_id').order('sequence');

    const { data: overdueTasks } = await this.db
      .from('v_counseling_today').select('*')
      .eq('supervisor_id', supervisorId)
      .lt('scheduled_date', today);

    const todayCount = todayTasks?.length ?? 0;
    const overdueCount = overdueTasks?.length ?? 0;

    if (todayCount === 0 && overdueCount === 0) {
      return { pushed: false, reason: 'no_tasks', today_count: 0, overdue_count: 0 };
    }

    const message = this.buildMessage(sup.name, today, todayTasks ?? [], overdueTasks ?? []);
    await this.pushLineText(sup.line_user_id, message);
    return { pushed: true, today_count: todayCount, overdue_count: overdueCount };
  }

  // ═══════════════════════════════════════════
  //  訊息組裝
  // ═══════════════════════════════════════════

  private buildMessage(supervisorName: string, today: string, todayTasks: any[], overdueTasks: any[]): string {
    const methodLabel: Record<string, string> = {
      phone: '電話',
      face_to_face: '面談',
      line_text: 'LINE 文字',
      observation: '實地觀察',
      group: '小組',
      written: '書面',
    };

    const lines: string[] = [];
    lines.push(`🗓 ${supervisorName} 的今日輔導排程`);
    lines.push(`📅 ${today}`);
    lines.push('');

    if (todayTasks.length > 0) {
      lines.push(`【今日 ${todayTasks.length} 項】`);
      const byCase = new Map<string, any[]>();
      for (const t of todayTasks) {
        const key = t.case_id;
        if (!byCase.has(key)) byCase.set(key, []);
        byCase.get(key)!.push(t);
      }
      let idx = 1;
      for (const [, tasks] of byCase) {
        const first = tasks[0];
        lines.push(`${idx}. ${first.employee_name}`);
        lines.push(`   目標：${this.truncate(first.case_goal, 40)}`);
        for (const t of tasks) {
          const m = methodLabel[t.method] || t.method;
          lines.push(`   • [${m}] ${this.truncate(t.objective, 50)}`);
        }
        idx++;
      }
    } else {
      lines.push('【今日】無排定任務');
    }

    if (overdueTasks.length > 0) {
      lines.push('');
      lines.push(`⚠️ 過期未完成：${overdueTasks.length} 項`);
      for (const t of overdueTasks.slice(0, 3)) {
        const m = methodLabel[t.method] || t.method;
        lines.push(`  ${t.scheduled_date} ${t.employee_name} [${m}]`);
      }
      if (overdueTasks.length > 3) {
        lines.push(`  ... 還有 ${overdueTasks.length - 3} 項`);
      }
    }

    lines.push('');
    lines.push('—— 樂活心理輔導系統');
    return lines.join('\n');
  }

  private truncate(s: string, n: number): string {
    if (!s) return '';
    return s.length <= n ? s : s.slice(0, n - 1) + '…';
  }

  private todayInTaipei(): string {
    const tw = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
    const y = tw.getFullYear();
    const m = String(tw.getMonth() + 1).padStart(2, '0');
    const d = String(tw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ═══════════════════════════════════════════
  //  LINE Push API（純 HTTP）
  // ═══════════════════════════════════════════

  private async pushLineText(userId: string, text: string): Promise<void> {
    const token = this.lineToken;
    if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');

    const safeText = text.length > 4900 ? text.slice(0, 4900) + '\n…(訊息過長已截斷)' : text;

    await axios.post(
      this.LINE_PUSH_API,
      {
        to: userId,
        messages: [{ type: 'text', text: safeText }],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );
  }
}
