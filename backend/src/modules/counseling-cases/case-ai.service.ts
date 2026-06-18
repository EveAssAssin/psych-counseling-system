import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * 案件級 AI 討論：每個輔導案可以開一個 session，輔導員在上面跟 AI 討論
 * 這個案的策略、員工反應、下一步怎麼處理。所有訊息持久化在
 * supervisor_ai_messages 表（cascade on session delete）。
 *
 * 跟 SupervisorAiService 的快問對話共用 supervisor_ai_sessions / messages 表，
 * 但 system prompt 自動帶案件上下文：goal / 狀態標籤 / 近期執行紀錄 / insight 摘要。
 *
 * 為何不重用 SupervisorAiService？
 *   - 系統 prompt 邏輯差異大（通用 vs 案件特化）
 *   - 案件 session 需要支援「同一輔導員同一案 → 重用 session」
 *   - 維持 counseling-cases module 自包含，避免循環依賴
 */
@Injectable()
export class CaseAiService {
  private readonly logger = new Logger(CaseAiService.name);
  private readonly anthropic: Anthropic;
  private readonly model: string;

  // 最近執行紀錄帶入 prompt 的上限
  private readonly RECENT_EXECUTIONS_LIMIT = 8;
  // 對話歷史帶入 prompt 的上限（避免無限長）
  private readonly MESSAGE_HISTORY_LIMIT = 40;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
    this.model = this.config.get<string>('anthropic.model') || 'claude-sonnet-4-6';
  }

  private get db() { return this.supabase.getAdminClient(); }

  // ═══════════════════════════════════════════
  //  Session 管理
  // ═══════════════════════════════════════════

  /** 列出案件下所有 session（按時間倒序） */
  async listSessions(caseId: string) {
    await this.requireCase(caseId);
    const { data, error } = await this.db
      .from('supervisor_ai_sessions')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * 取得或建立 session。
   * 邏輯：同一輔導員在同一案，永遠用同一個 session（避免散落）。
   */
  async getOrCreateSession(caseId: string, supervisorIdentifier: string): Promise<any> {
    const caseRow = await this.requireCase(caseId);

    // 嘗試找既有
    const { data: existing } = await this.db
      .from('supervisor_ai_sessions')
      .select('*')
      .eq('case_id', caseId)
      .eq('supervisor_id', supervisorIdentifier)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing;

    // 查輔導員姓名（從 authorized_supervisors 用 identifier 找）
    const { data: sup } = await this.db
      .from('authorized_supervisors')
      .select('name, identifier, is_active')
      .eq('identifier', supervisorIdentifier)
      .maybeSingle();
    if (!sup || !sup.is_active) {
      throw new ForbiddenException('輔導員無權存取或帳號已停用');
    }

    // 建新 session
    const { data: created, error } = await this.db
      .from('supervisor_ai_sessions')
      .insert({
        case_id: caseId,
        supervisor_id: supervisorIdentifier,
        supervisor_name: sup.name,
        employee_id: caseRow.employee_id,
        employee_app_number: caseRow.employee_app_number,
        employee_name: caseRow.employee_name,
        ai_type: 'claude',
        title: `案件討論：${caseRow.employee_name} / ${caseRow.goal.slice(0, 30)}`,
        message_count: 0,
      })
      .select()
      .single();
    if (error) throw error;
    return created;
  }

  /** 取得 session 的訊息清單（含 system 訊息，前端可決定要不要顯示） */
  async getMessages(sessionId: string, supervisorIdentifier: string) {
    await this.requireSessionAccess(sessionId, supervisorIdentifier);
    const { data, error } = await this.db
      .from('supervisor_ai_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  // ═══════════════════════════════════════════
  //  發送訊息（核心）
  // ═══════════════════════════════════════════

  async sendMessage(sessionId: string, supervisorIdentifier: string, userContent: string): Promise<{
    user_message: any;
    assistant_message: any;
  }> {
    if (!userContent || !userContent.trim()) {
      throw new BadRequestException('訊息不能為空');
    }
    const session = await this.requireSessionAccess(sessionId, supervisorIdentifier);
    if (!session.case_id) {
      throw new BadRequestException('此 session 非案件 session');
    }

    // 1. 存使用者訊息
    const { data: userMsg, error: userErr } = await this.db
      .from('supervisor_ai_messages')
      .insert({ session_id: sessionId, role: 'user', content: userContent.trim() })
      .select()
      .single();
    if (userErr) throw userErr;

    // 2. 組系統 prompt + 歷史訊息
    const systemPrompt = await this.buildSystemPrompt(session.case_id);
    const history = await this.getRecentMessagesForClaude(sessionId);

    // 3. call Claude
    let assistantText = '';
    let usage: { input_tokens?: number; output_tokens?: number } = {};
    try {
      const resp = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: history,
      });
      const block = resp.content[0];
      assistantText = block.type === 'text' ? block.text : '';
      usage = { input_tokens: resp.usage?.input_tokens, output_tokens: resp.usage?.output_tokens };
    } catch (err: any) {
      this.logger.error(`Claude call failed for case session ${sessionId}: ${err?.message}`);
      // 把使用者訊息留下，但回報 AI 失敗
      throw new InternalServerErrorException('AI 暫時無法回應，您的訊息已保留');
    }

    // 4. 存 AI 回覆
    const { data: assistantMsg, error: aErr } = await this.db
      .from('supervisor_ai_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: assistantText,
        ai_type: 'claude',
        tokens_used: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
      })
      .select()
      .single();
    if (aErr) throw aErr;

    // 5. 更新 session message_count + updated_at
    await this.db
      .from('supervisor_ai_sessions')
      .update({
        message_count: (session.message_count ?? 0) + 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return { user_message: userMsg, assistant_message: assistantMsg };
  }

  // ═══════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════

  private async requireCase(caseId: string) {
    const { data, error } = await this.db
      .from('counseling_cases')
      .select('*')
      .eq('id', caseId)
      .single();
    if (error || !data) throw new NotFoundException(`Case ${caseId} not found`);
    return data;
  }

  private async requireSessionAccess(sessionId: string, supervisorIdentifier: string) {
    const { data, error } = await this.db
      .from('supervisor_ai_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (error || !data) throw new NotFoundException(`Session ${sessionId} not found`);
    if (data.supervisor_id !== supervisorIdentifier) {
      throw new ForbiddenException('無權存取此對話');
    }
    return data;
  }

  /** 把歷史訊息轉為 Claude messages 格式（過濾掉 system role，因為 system 是另傳） */
  private async getRecentMessagesForClaude(sessionId: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const { data, error } = await this.db
      .from('supervisor_ai_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(this.MESSAGE_HISTORY_LIMIT);
    if (error) throw error;
    return (data ?? []).map(m => ({ role: m.role as any, content: m.content }));
  }

  /** 組案件上下文的 system prompt */
  private async buildSystemPrompt(caseId: string): Promise<string> {
    const caseRow = await this.requireCase(caseId);

    // 拿狀態標籤 label 們
    const { data: tagRows } = await this.db
      .from('counseling_state_tags')
      .select('code, label, ai_prompt_hint, severity')
      .in('code', caseRow.state_tag_codes ?? []);

    // 拿最近執行紀錄
    const { data: execs } = await this.db
      .from('counseling_executions')
      .select('executed_at, actual_method, what_happened, employee_reaction, mood_score, next_action_hint')
      .eq('case_id', caseId)
      .order('executed_at', { ascending: false })
      .limit(this.RECENT_EXECUTIONS_LIMIT);

    // 拿未來 7 天內排程
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: upcoming } = await this.db
      .from('counseling_plan_items')
      .select('scheduled_date, sequence, method, objective')
      .eq('case_id', caseId)
      .eq('status', 'pending')
      .gte('scheduled_date', today)
      .lte('scheduled_date', sevenDaysOut)
      .order('scheduled_date');

    const tagBlock = (tagRows ?? []).map(t =>
      `- ${t.label} (嚴重度=${t.severity || 'moderate'}) — ${t.ai_prompt_hint || ''}`
    ).join('\n');

    const insightBlock = this.summarizeInsight(caseRow.initial_insight_snapshot?.summary);

    const recentExecBlock = (execs ?? []).length === 0
      ? '(尚無執行紀錄)'
      : (execs ?? []).map((e, i) =>
          `${i + 1}. ${e.executed_at?.slice(0, 10)} [${e.actual_method}] mood=${e.mood_score ?? '-'}\n   經過：${e.what_happened}\n   反應：${e.employee_reaction || '(未填)'}\n   下一步思考：${e.next_action_hint || '(未填)'}`
        ).join('\n\n');

    const upcomingBlock = (upcoming ?? []).length === 0
      ? '(未來 7 天無排程)'
      : (upcoming ?? []).map(u => `- ${u.scheduled_date} 第 ${u.sequence} 步 [${u.method}]：${u.objective}`).join('\n');

    return [
      '你是資深職場心理輔導督導，正在協助第一線輔導員處理一個正在進行中的案件。',
      '你的角色是「夥伴 + 顧問」：幫輔導員思考、提供具體建議、指出可能的盲點，但不取代輔導員的判斷。',
      '',
      '回應原則：',
      '- 言之有物，避免空泛安慰',
      '- 建議要具體可執行，給開場白 / 問題 / 觀察重點',
      '- 主動指出潛在風險（員工狀態惡化、輔導員可能的反移情、紀錄不足等）',
      '- 涉及員工隱私時提醒輔導員保密邊界',
      '- 回應控制在 200-400 字以內，必要時用條列',
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '【本案資料】',
      `員工：${caseRow.employee_name}（${caseRow.employee_app_number}）`,
      `輔導目標：${caseRow.goal}`,
      `期間：${caseRow.start_date} ~ ${caseRow.target_end_date}`,
      `狀態：${caseRow.status}`,
      caseRow.state_description ? `補充說明：${caseRow.state_description}` : '',
      '',
      '【主訴狀態標籤】',
      tagBlock || '(無)',
      '',
      '【員工背景 insight 摘要（建案當下快照）】',
      insightBlock,
      '',
      '【近期執行紀錄】',
      recentExecBlock,
      '',
      '【未來 7 天排程】',
      upcomingBlock,
      '━━━━━━━━━━━━━━━━━━━━',
      '',
      '請以上面的案件脈絡為基礎回應輔導員。',
    ].filter(Boolean).join('\n');
  }

  private summarizeInsight(summary: any): string {
    if (!summary || typeof summary !== 'object') return '(建案當下無 insight 資料)';
    const lines: string[] = [];
    if (summary.risk_level) lines.push(`風險：${summary.risk_level}`);
    if (summary.stress_level) lines.push(`壓力：${summary.stress_level}`);
    if (summary.trend) lines.push(`趨勢：${summary.trend}`);
    if (summary.overall_assessment) lines.push(`評估：${summary.overall_assessment}`);
    if (Array.isArray(summary.key_concerns) && summary.key_concerns.length) {
      lines.push(`關注：${summary.key_concerns.slice(0, 5).join(' / ')}`);
    }
    return lines.join('\n') || '(insight 為空)';
  }
}
