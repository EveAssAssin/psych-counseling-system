import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { SupervisorNotesService } from '../supervisor-notes/supervisor-notes.service';
import { OrderStatsService } from '../sync/order-stats.service';

export type AiType = 'claude' | 'openai' | 'gemini';

@Injectable()
export class SupervisorAiService {
  private readonly logger = new Logger(SupervisorAiService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly notesService: SupervisorNotesService,
    private readonly orderStatsService: OrderStatsService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  private get db() { return this.supabase.getAdminClient(); }

  // ═══════════════════════════════════════════
  //  AI 人格設定
  // ═══════════════════════════════════════════

  async getPersonas() {
    const { data, error } = await this.db
      .from('ai_personas')
      .select('*')
      .eq('is_active', true)
      .order('ai_type');
    if (error) throw error;
    return data;
  }

  async getPersona(aiType: AiType) {
    const { data } = await this.db
      .from('ai_personas')
      .select('*')
      .eq('ai_type', aiType)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();
    return data;
  }

  async updatePersona(id: string, updates: {
    persona_name?: string;
    system_prompt?: string;
    model?: string;
    is_active?: boolean;
    is_default?: boolean;
  }) {
    const { data, error } = await this.db
      .from('ai_personas')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════
  //  對話 Session
  // ═══════════════════════════════════════════

  async getSessions(supervisorId: string) {
    const { data, error } = await this.db
      .from('supervisor_ai_sessions')
      .select('*')
      .eq('supervisor_id', supervisorId)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  }

  async createSession(dto: {
    supervisor_id: string;
    supervisor_name: string;
    employee_app_number?: string;
    employee_name?: string;
    ai_type: AiType;
  }) {
    // 驗證主管權限
    await this.notesService.requireAuthorized(dto.supervisor_id);

    // 如果有指定人員，檢查是否在機密名單
    if (dto.employee_app_number) {
      const isConfidential = await this.notesService.isConfidential(dto.employee_app_number);
      if (isConfidential) {
        throw new ForbiddenException('該人員已列入 AI 機密名單，無法進行 AI 討論。');
      }
    }

    // 取得人員 UUID
    let employee_id: string | undefined;
    if (dto.employee_app_number) {
      const { data: emp } = await this.db
        .from('employees')
        .select('id')
        .eq('employeeappnumber', dto.employee_app_number)
        .limit(1);
      employee_id = emp?.[0]?.id;
    }

    const title = dto.employee_name
      ? `關於 ${dto.employee_name} 的討論`
      : '新對話';

    const persona = await this.getPersona(dto.ai_type);

    const { data, error } = await this.db
      .from('supervisor_ai_sessions')
      .insert({
        supervisor_id: dto.supervisor_id,
        supervisor_name: dto.supervisor_name,
        employee_id,
        employee_app_number: dto.employee_app_number,
        employee_name: dto.employee_name,
        ai_type: dto.ai_type,
        persona_id: persona?.id,
        title,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getSessionMessages(sessionId: string) {
    const { data, error } = await this.db
      .from('supervisor_ai_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at');
    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════
  //  傳送訊息 & AI 回應
  // ═══════════════════════════════════════════

  async sendMessage(dto: {
    session_id: string;
    supervisor_id: string;
    content: string;
  }) {
    await this.notesService.requireAuthorized(dto.supervisor_id);

    // 取得 session
    const { data: session, error: sErr } = await this.db
      .from('supervisor_ai_sessions')
      .select('*')
      .eq('id', dto.session_id)
      .single();
    if (sErr || !session) throw new BadRequestException('找不到對話 session');

    // 確認 session 屬於該主管
    if (session.supervisor_id !== dto.supervisor_id) {
      throw new ForbiddenException('無權存取此對話');
    }

    // 存入用戶訊息
    await this.db.from('supervisor_ai_messages').insert({
      session_id: dto.session_id,
      role: 'user',
      content: dto.content,
    });

    // 取得歷史訊息
    const { data: history } = await this.db
      .from('supervisor_ai_messages')
      .select('role, content')
      .eq('session_id', dto.session_id)
      .neq('role', 'system')
      .order('created_at');

    // 建立系統提示（含人員資料彙整）
    const systemPrompt = await this.buildSystemPrompt(session);

    // 呼叫 AI
    let aiResponse: string;
    let tokensUsed: number | undefined;

    try {
      const result = await this.callAI(session.ai_type, systemPrompt, history || []);
      aiResponse = result.content;
      tokensUsed = result.tokens;
    } catch (err) {
      this.logger.error(`AI call failed: ${err.message}`);
      throw new BadRequestException(`AI 回應失敗：${err.message}`);
    }

    // 存入 AI 回應
    await this.db.from('supervisor_ai_messages').insert({
      session_id: dto.session_id,
      role: 'assistant',
      content: aiResponse,
      ai_type: session.ai_type,
      tokens_used: tokensUsed,
    });

    // 更新 session
    await this.db
      .from('supervisor_ai_sessions')
      .update({
        message_count: (session.message_count || 0) + 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dto.session_id);

    return { role: 'assistant', content: aiResponse };
  }

  // ═══════════════════════════════════════════
  //  取得人員完整資料彙整（供前端顯示 + AI 分析）
  // ═══════════════════════════════════════════

  async getEmployeeSummary(appNumber: string) {
    // 1. 員工基本資料
    const { data: empRows } = await this.db
      .from('employees')
      .select('id, name, store_name, title, hire_date, is_active, is_leave, leave_type, department, email')
      .eq('employeeappnumber', appNumber)
      .order('synced_at', { ascending: false })
      .limit(1);

    const emp = empRows?.[0] || null;
    const employeeUUID = emp?.id;

    // 2. 主管隨手記
    const notes = await this.notesService.getNotesByEmployee(appNumber);

    // 3. 對話記錄（conversation_intakes）
    let conversations: any[] = [];
    if (employeeUUID) {
      const { data: convs } = await this.db
        .from('conversation_intakes')
        .select('id, conversation_date, conversation_type, interviewer_name, extracted_text, raw_text, priority, need_followup, intake_status, tags, created_at')
        .eq('employee_id', employeeUUID)
        .order('conversation_date', { ascending: false })
        .limit(20);
      conversations = convs || [];
    }

    // 4. 評價記錄（reviews）
    let reviews: any[] = [];
    if (employeeUUID) {
      const { data: revs } = await this.db
        .from('reviews')
        .select('id, review_type, urgency, event_date, content, status, source, created_at')
        .eq('employee_id', employeeUUID)
        .order('event_date', { ascending: false })
        .limit(20);
      reviews = revs || [];
    }

    // 5. 風險標記（risk_flags）
    let riskFlags: any[] = [];
    if (employeeUUID) {
      const { data: flags } = await this.db
        .from('risk_flags')
        .select('id, risk_type, severity, title, description, evidence_text, status, created_at')
        .eq('employee_id', employeeUUID)
        .order('created_at', { ascending: false })
        .limit(20);
      riskFlags = flags || [];
    }

    // 6. 官方頻道訊息（official_channel_messages）- 員工發出的 LINE 訊息
    let channelMessages: any[] = [];
    {
      let q = this.db
        .from('official_channel_messages')
        .select('id, channel, direction, message_time, message_text, ticket_no, author_name, author_role, group_name')
        .order('message_time', { ascending: false })
        .limit(30);
      if (employeeUUID) {
        q = q.eq('employee_id', employeeUUID);
      } else {
        q = q.eq('employee_app_number', appNumber);
      }
      const { data: msgs } = await q;
      channelMessages = msgs || [];
    }

    // 7. 工單回報歷史（employee_ticket_history）
    let ticketHistory: any[] = [];
    {
      const { data: tickets } = await this.db
        .from('employee_ticket_history')
        .select('id, ticket_no, issue_title, issue_desc, category, parent_category, sub_category, status, priority, ticket_created_at, ticket_closed_at')
        .eq('employee_app_number', appNumber)
        .order('ticket_created_at', { ascending: false })
        .limit(20);
      ticketHistory = tickets || [];
    }

    // 8. 訂單業績趨勢
    const orderTrend = await this.orderStatsService.getEmployeeOrderTrend(appNumber);

    return {
      employee: emp,
      notes,
      conversations,
      reviews,
      riskFlags,
      channelMessages,
      ticketHistory,
      orderTrend,
    };
  }

  // ═══════════════════════════════════════════
  //  建立系統提示（彙整所有人員資料）
  // ═══════════════════════════════════════════

  private async buildSystemPrompt(session: any): Promise<string> {
    const persona = await this.getPersona(session.ai_type as AiType);
    let prompt = persona?.system_prompt || '你是一位專業的職場心理顧問。';

    if (session.employee_app_number) {
      const summary = await this.getEmployeeSummary(session.employee_app_number);
      const { employee: emp, notes, conversations, reviews, riskFlags, channelMessages, ticketHistory, orderTrend } = summary;

      // ── 員工基本資料 ──
      prompt += `\n\n【員工基本資料】\n`;
      prompt += `姓名：${emp?.name || session.employee_name}\n`;
      prompt += `員工編號：${session.employee_app_number}\n`;
      if (emp?.store_name)  prompt += `所屬店家：${emp.store_name}\n`;
      if (emp?.title)       prompt += `職位：${emp.title}\n`;
      if (emp?.department)  prompt += `部門：${emp.department}\n`;
      if (emp?.hire_date)   prompt += `到職日：${emp.hire_date}\n`;
      if (emp?.is_leave)    prompt += `⚠️ 目前請假中（${emp.leave_type || '未知假別'}）\n`;
      if (emp && !emp.is_active) prompt += `⚠️ 員工狀態：已離職或停用\n`;

      // ── 風險標記 ──
      const openFlags = riskFlags.filter((f: any) => ['open', 'acknowledged', 'in_progress'].includes(f.status));
      if (openFlags.length > 0) {
        prompt += `\n\n【⚠️ 風險標記（進行中 ${openFlags.length} 筆）】\n`;
        openFlags.forEach((f: any) => {
          const date = new Date(f.created_at).toLocaleDateString('zh-TW');
          const severityLabel = ({ critical: '🔴 嚴重', high: '🟠 高', medium: '🟡 中', low: '🟢 低' } as Record<string, string>)[f.severity] || f.severity;
          prompt += `\n[${date}] ${severityLabel} ｜ ${f.risk_type} ｜ ${f.title}\n`;
          if (f.description) prompt += `說明：${f.description}\n`;
          if (f.evidence_text) prompt += `依據：${f.evidence_text.slice(0, 200)}\n`;
        });
      }

      // ── 主管隨手記 ──
      if (notes.length > 0) {
        prompt += `\n\n【主管隨手記（共 ${notes.length} 筆，最近 20 筆）】\n`;
        notes.slice(0, 20).forEach((n: any, i: number) => {
          const date = new Date(n.created_at).toLocaleDateString('zh-TW');
          prompt += `\n[${i + 1}] ${date} ｜ ${n.category_name || '未分類'} ｜ 記錄者：${n.supervisor_name}\n`;
          prompt += `${n.content}\n`;
        });
      } else {
        prompt += `\n\n【主管隨手記：尚無記錄】\n`;
      }

      // ── 對話記錄 ──
      if (conversations.length > 0) {
        prompt += `\n\n【心理輔導對話記錄（共 ${conversations.length} 筆，最近 10 筆）】\n`;
        conversations.slice(0, 10).forEach((c: any, i: number) => {
          const date = c.conversation_date
            ? new Date(c.conversation_date).toLocaleDateString('zh-TW')
            : new Date(c.created_at).toLocaleDateString('zh-TW');
          const text = c.extracted_text || c.raw_text || '';
          prompt += `\n[${i + 1}] ${date} ｜ 類型：${c.conversation_type || '一般'} ｜ 訪談者：${c.interviewer_name || '未知'}\n`;
          if (c.priority && c.priority !== 'normal') prompt += `優先級：${c.priority}\n`;
          if (c.need_followup) prompt += `⚠️ 需要後續追蹤\n`;
          if (text) prompt += `內容摘要：${text.slice(0, 300)}${text.length > 300 ? '...' : ''}\n`;
        });
      }

      // ── 評價記錄 ──
      if (reviews.length > 0) {
        const negRevs = reviews.filter((r: any) => r.review_type === 'negative' || r.review_type === 'complaint');
        const posRevs = reviews.filter((r: any) => r.review_type === 'positive' || r.review_type === 'praise');
        prompt += `\n\n【評價記錄（共 ${reviews.length} 筆：${posRevs.length} 正面 / ${negRevs.length} 負面）】\n`;
        reviews.slice(0, 10).forEach((r: any, i: number) => {
          const date = r.event_date
            ? new Date(r.event_date).toLocaleDateString('zh-TW')
            : new Date(r.created_at).toLocaleDateString('zh-TW');
          const typeLabel = ({ positive: '✅ 正面', negative: '❌ 負面', complaint: '⚠️ 投訴', praise: '🌟 表揚', other: '📝 其他' } as Record<string, string>)[r.review_type] || r.review_type;
          prompt += `\n[${i + 1}] ${date} ｜ ${typeLabel} ｜ 急迫度：${r.urgency || 'normal'} ｜ 狀態：${r.status || '未知'}\n`;
          prompt += `${(r.content || '').slice(0, 200)}${(r.content || '').length > 200 ? '...' : ''}\n`;
        });
      }

      // ── 官方頻道訊息 ──
      if (channelMessages.length > 0) {
        const inbound = channelMessages.filter((m: any) => m.direction === 'inbound');
        prompt += `\n\n【官方頻道訊息（共 ${channelMessages.length} 筆，其中員工發出 ${inbound.length} 筆，最近 15 筆）】\n`;
        channelMessages.slice(0, 15).forEach((m: any, i: number) => {
          const time = m.message_time
            ? new Date(m.message_time).toLocaleDateString('zh-TW')
            : '未知時間';
          const channelLabel = m.channel === 'official-line' ? '📱 LINE' : '🎫 工單留言';
          const dirLabel = ({ inbound: '👤 員工', store: '🏪 門市', engineer: '🔧 工程師', reviewer: '📋 審核' } as Record<string, string>)[m.direction] || m.direction;
          prompt += `\n[${i + 1}] ${time} ｜ ${channelLabel} ｜ 發送方：${dirLabel}`;
          if (m.ticket_no) prompt += ` ｜ 工單：${m.ticket_no}`;
          prompt += '\n';
          if (m.message_text) prompt += `${m.message_text.slice(0, 200)}${m.message_text.length > 200 ? '...' : ''}\n`;
        });
      }

      // ── 工單回報歷史 ──
      if (ticketHistory.length > 0) {
        const openTickets = ticketHistory.filter((t: any) => !['closed', 'resolved', 'cancelled'].includes(t.status));
        prompt += `\n\n【工單回報歷史（共 ${ticketHistory.length} 筆，進行中 ${openTickets.length} 筆）】\n`;
        ticketHistory.slice(0, 15).forEach((t: any, i: number) => {
          const date = t.ticket_created_at
            ? new Date(t.ticket_created_at).toLocaleDateString('zh-TW')
            : '未知日期';
          const statusLabel: Record<string, string> = {
            pending: '⏳ 待處理', open: '🔓 處理中', in_progress: '🔧 進行中',
            resolved: '✅ 已解決', closed: '🔒 已關閉', cancelled: '❌ 已取消',
          };
          const priorityLabel: Record<string, string> = { high: '🔴 高', medium: '🟡 中', low: '🟢 低', urgent: '🚨 緊急' };
          prompt += `\n[${i + 1}] ${date} ｜ ${t.ticket_no} ｜ ${statusLabel[t.status] || t.status} ｜ ${priorityLabel[t.priority] || t.priority}\n`;
          if (t.parent_category || t.category) prompt += `分類：${[t.parent_category, t.category, t.sub_category].filter(Boolean).join(' > ')}\n`;
          if (t.issue_title) prompt += `標題：${t.issue_title}\n`;
          if (t.issue_desc) prompt += `描述：${t.issue_desc.slice(0, 150)}${t.issue_desc.length > 150 ? '...' : ''}\n`;
        });
      }

      // ── 訂單業績趨勢 ──
      if (orderTrend?.hasData) {
        const { totalTrend, byLabel } = orderTrend;
        const trendEmoji = { up:'📈', down:'📉', stable:'➡️', new:'🆕' };
        prompt += `\n\n【接單業績趨勢（近6個月，以月為單位）】\n`;
        prompt += `整體：${trendEmoji[totalTrend.trend]} 近3月平均 ${totalTrend.recentAvg} 單 / 前3月平均 ${totalTrend.prevAvg} 單`;
        if (totalTrend.changePercent !== null) {
          prompt += `（${totalTrend.changePercent > 0 ? '+' : ''}${totalTrend.changePercent}%）`;
        }
        prompt += '\n';

        // 月份明細
        if (totalTrend.months.length > 0) {
          prompt += '月份明細：' + totalTrend.months.map(m => `${m.year}/${m.month}=${m.count}單`).join('、') + '\n';
        }

        // 各標籤趨勢（只列有接單的標籤）
        const activeLabelTrends = byLabel.filter(t => t.recentAvg > 0 || t.prevAvg > 0);
        if (activeLabelTrends.length > 0) {
          prompt += '\n各訂單類型趨勢：\n';
          activeLabelTrends.forEach(t => {
            prompt += `  ${trendEmoji[t.trend]} ${t.label}：近3月均 ${t.recentAvg} 單`;
            if (t.changePercent !== null) prompt += `（${t.changePercent > 0 ? '+' : ''}${t.changePercent}%）`;
            prompt += '\n';
          });
        }

        const trendDesc = { up:'明顯上升', down:'明顯下滑', stable:'基本持平', new:'近期新出現' };
        prompt += `\n整體接單趨勢判斷：${trendDesc[totalTrend.trend]}。`;
        if (totalTrend.trend === 'down') {
          prompt += '⚠️ 建議主管關注是否有狀態或業績問題。';
        }
      } else {
        prompt += `\n\n【接單業績趨勢：尚無同步資料，需先執行訂單同步】\n`;
      }

      prompt += `\n\n以上為系統中關於「${emp?.name || session.employee_name}」的所有相關資料，請根據這些資料協助主管分析員工狀況。`;
    }

    return prompt;
  }

  // ═══════════════════════════════════════════
  //  呼叫各 AI
  // ═══════════════════════════════════════════

  private async callAI(
    aiType: AiType,
    systemPrompt: string,
    history: Array<{ role: string; content: string }>,
  ): Promise<{ content: string; tokens?: number }> {
    switch (aiType) {
      case 'claude':  return this.callClaude(systemPrompt, history);
      case 'openai':  return this.callOpenAI(systemPrompt, history);
      case 'gemini':  return this.callGemini(systemPrompt, history);
      default:        throw new BadRequestException(`不支援的 AI 類型：${aiType}`);
    }
  }

  private async callClaude(
    systemPrompt: string,
    history: Array<{ role: string; content: string }>,
  ): Promise<{ content: string; tokens?: number }> {
    const persona = await this.getPersona('claude');
    const model = persona?.model || 'claude-opus-4-6';

    const messages = history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const content = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    return { content, tokens: response.usage?.input_tokens + response.usage?.output_tokens };
  }

  private async callOpenAI(
    systemPrompt: string,
    history: Array<{ role: string; content: string }>,
  ): Promise<{ content: string; tokens?: number }> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new BadRequestException('OpenAI API Key 未設定，請在 Render 環境變數中設定 OPENAI_API_KEY');

    const persona = await this.getPersona('openai');
    const model = persona?.model || 'gpt-4o';

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content })),
    ];

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      { model, messages, max_tokens: 2048 },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 },
    );

    const content = response.data.choices?.[0]?.message?.content || '';
    const tokens = response.data.usage?.total_tokens;
    return { content, tokens };
  }

  private async callGemini(
    systemPrompt: string,
    history: Array<{ role: string; content: string }>,
  ): Promise<{ content: string; tokens?: number }> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new BadRequestException('Gemini API Key 未設定，請在 Render 環境變數中設定 GEMINI_API_KEY');

    const persona = await this.getPersona('gemini');
    const model = persona?.model || 'gemini-1.5-pro';

    // Gemini 格式：history 中 user/model 交替，system 放第一則
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: '我了解，請問有什麼我可以幫助您的？' }] },
      ...history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    ];

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { contents, generationConfig: { maxOutputTokens: 2048 } },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 },
    );

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { content };
  }
}
