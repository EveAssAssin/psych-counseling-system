import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { EmployeeContextService } from '../conversations/employee-context.service';
import {
  GenerateAiSuggestionDto,
  SendReplyDto,
  SaveDraftDto,
  CreateGuidelineDto,
  UpdateGuidelineDto,
  UpdateAutoReplySettingsDto,
} from './line-assistant.dto';

@Injectable()
export class LineAssistantService {
  private readonly logger = new Logger(LineAssistantService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly employeesService: EmployeesService,
    private readonly employeeContext: EmployeeContextService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  private get db() { return this.supabase.getAdminClient(); }

  // ═══════════════════════════════════════════
  //  會話列表（從 official_channel_messages）
  // ═══════════════════════════════════════════

  async getConversationList(params: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{
    data: any[];
    total: number;
  }> {
    const limit = params.limit || 30;
    const offset = params.offset || 0;

    // 取最近有訊息的 thread，依最後訊息時間排序
    // channel = 'official-line'（員工透過 LINE 官方帳號發送的訊息）
    let query = this.db
      .from('official_channel_messages')
      .select('thread_id, employee_app_number, employee_name, message_time, message_text, direction', { count: 'exact' })
      .eq('channel', 'official-line')
      .order('message_time', { ascending: false });

    if (params.search) {
      query = query.or(`employee_name.ilike.%${params.search}%,employee_app_number.ilike.%${params.search}%,message_text.ilike.%${params.search}%`);
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      this.logger.error(`getConversationList error: ${error.message}`);
      return { data: [], total: 0 };
    }

    // 去重 by thread_id (keep first = latest)
    const seen = new Set<string>();
    const unique: any[] = [];
    for (const row of (data || [])) {
      if (!seen.has(row.thread_id)) {
        seen.add(row.thread_id);
        unique.push(row);
      }
    }

    // 為每個 thread 查詢是否有未回覆（最後一條是 inbound）
    const withStatus = await Promise.all(
      unique.map(async (row) => {
        const { data: lastMsg } = await this.db
          .from('official_channel_messages')
          .select('direction, message_text, message_time')
          .eq('thread_id', row.thread_id)
          .order('message_time', { ascending: false })
          .limit(1)
          .single();

        // 查是否有草稿
        const { data: draft } = await this.db
          .from('line_reply_log')
          .select('id, final_reply, status')
          .eq('thread_id', row.thread_id)
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...row,
          last_direction: lastMsg?.direction || row.direction,
          last_message: lastMsg?.message_text || row.message_text,
          last_message_time: lastMsg?.message_time || row.message_time,
          needs_reply: lastMsg?.direction === 'inbound',
          has_draft: !!draft,
          draft_content: draft?.final_reply || null,
          draft_id: draft?.id || null,
        };
      })
    );

    return { data: withStatus, total: count || 0 };
  }

  // ═══════════════════════════════════════════
  //  取得單一 thread 的訊息記錄
  // ═══════════════════════════════════════════

  async getThreadMessages(threadId: string): Promise<{
    messages: any[];
    employee: { app_number: string; name: string } | null;
    replyLog: any[];
  }> {
    const { data: messages } = await this.db
      .from('official_channel_messages')
      .select('*')
      .eq('thread_id', threadId)
      .in('channel', ['official-line'])
      .order('message_time', { ascending: true });

    const { data: replyLog } = await this.db
      .from('line_reply_log')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false });

    const firstMsg = (messages || [])[0];
    const employee = firstMsg
      ? { app_number: firstMsg.employee_app_number, name: firstMsg.employee_name }
      : null;

    return {
      messages: messages || [],
      employee,
      replyLog: replyLog || [],
    };
  }

  // ═══════════════════════════════════════════
  //  AI 建議生成
  // ═══════════════════════════════════════════

  async generateAiSuggestion(dto: GenerateAiSuggestionDto): Promise<{
    suggestion: string;
    model: string;
  }> {
    // 取公司規範
    const { data: guidelines } = await this.db
      .from('company_guidelines')
      .select('title, category, content')
      .eq('is_active', true)
      .order('sort_order');

    // 取最近幾筆對話歷史（排除系統訊息，減少 AI token 消耗）
    const { data: history } = await this.db
      .from('official_channel_messages')
      .select('direction, message_text, message_time, author_name, is_system_message')
      .eq('thread_id', dto.thread_id)
      .eq('is_system_message', false)
      .order('message_time', { ascending: false })
      .limit(10);

    const recentHistory = (history || []).reverse();

    // 組 system prompt
    const guidelineText = (guidelines || [])
      .map(g => `【${g.category}】${g.title}：${g.content}`)
      .join('\n');

    // 嘗試取得該員工最近的面談記錄上下文（讓 AI 知道員工心理狀態 + 主管應注意的議題）
    let employeeContextSection = '';
    if (dto.employee_app_number) {
      try {
        const emp = await this.employeesService.findByAppNumber(dto.employee_app_number);
        if (emp?.id) {
          const ctx = await this.employeeContext.buildConversationContext(emp.id, {
            recentFullCount: 1,         // 只放最近 1 筆完整對話（節省 token）
            olderSummaryCount: 3,       // 更早 3 筆只放分析摘要
            includeAnalysis: true,
            maxRawTextLength: 600,
          });
          if (ctx) {
            employeeContextSection = `\n\n## 該員工近期心理狀態（來自主管面談 AI 分析）\n${ctx}\n\n回覆時請務必參考員工的壓力等級、避雷話題、近期關切點，避免觸發風險議題。`;
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to load employee context for LINE assistant: ${e.message}`);
      }
    }

    const systemPrompt = `你是樂活眼鏡公司的 HR 主管助理，專門協助主管回覆員工透過 LINE 官方帳號發送的訊息。

## 公司規範
${guidelineText || '（無特定規範，請依一般 HR 禮儀回覆）'}

## 回覆原則
- 語氣：專業、溫暖，展現關懷
- 長度：精簡有力，避免冗長
- 若是請假、工作申請等事項，明確告知處理流程
- 若是情緒性訊息，優先同理再回應
- 直接輸出回覆內容，不要有任何前言或解釋${employeeContextSection}`;

    // 組 messages
    const messages: Anthropic.MessageParam[] = [];

    if (recentHistory.length > 0) {
      const historyText = recentHistory
        .map(m => `[${m.direction === 'inbound' ? '員工' : '主管'}] ${m.message_text}`)
        .join('\n');
      messages.push({
        role: 'user',
        content: `以下是對話歷史：\n${historyText}\n\n員工最新訊息：${dto.original_message}\n\n請生成一段適合的回覆。`,
      });
    } else {
      messages.push({
        role: 'user',
        content: `員工${dto.employee_name ? `（${dto.employee_name}）` : ''}傳來訊息：\n\n「${dto.original_message}」\n\n請生成一段適合的 HR 主管回覆。`,
      });
    }

    const model = this.config.get<string>('anthropic.model') || 'claude-sonnet-4-6';

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: 512,
      system: systemPrompt,
      messages,
    });

    const suggestion = response.content
      .filter(c => c.type === 'text')
      .map(c => (c as Anthropic.TextBlock).text)
      .join('');

    // 存入 DB（status=draft，等主管決定是否送出）
    await this.db.from('line_reply_log').insert({
      thread_id: dto.thread_id,
      employee_app_number: dto.employee_app_number || null,
      employee_name: dto.employee_name || null,
      original_message: dto.original_message,
      ai_suggestion: suggestion,
      final_reply: suggestion,
      status: 'draft',
      is_auto_reply: false,
    });

    return { suggestion, model };
  }

  // ═══════════════════════════════════════════
  //  送出回覆
  // ═══════════════════════════════════════════

  async sendReply(dto: SendReplyDto): Promise<{
    success: boolean;
    line_send_status: 'success' | 'failed' | 'manual';
    message: string;
    log_id: string;
  }> {
    const lineToken = this.config.get<string>('LINE_CHANNEL_ACCESS_TOKEN');
    let lineSendStatus: 'success' | 'failed' | 'manual' = 'manual';
    let errorMessage: string | null = null;

    // 嘗試透過 LINE API 送出
    if (lineToken && dto.thread_id) {
      try {
        const resp = await axios.post(
          'https://api.line.me/v2/bot/message/push',
          {
            to: dto.thread_id,
            messages: [{ type: 'text', text: dto.final_reply }],
          },
          {
            headers: {
              Authorization: `Bearer ${lineToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          },
        );
        lineSendStatus = 'success';
        this.logger.log(`LINE push sent to ${dto.thread_id}: ${resp.status}`);
      } catch (err: any) {
        lineSendStatus = 'failed';
        errorMessage = err?.response?.data?.message || err.message;
        this.logger.warn(`LINE push failed: ${errorMessage}`);
      }
    } else {
      this.logger.warn('LINE_CHANNEL_ACCESS_TOKEN not configured — skipping LINE send');
    }

    // 寫入回覆記錄
    const { data: log, error } = await this.db
      .from('line_reply_log')
      .insert({
        thread_id: dto.thread_id,
        employee_app_number: dto.employee_app_number || null,
        employee_name: dto.employee_name || null,
        original_message: dto.original_message || null,
        ai_suggestion: dto.ai_suggestion || null,
        final_reply: dto.final_reply,
        sent_by: dto.sent_by || null,
        sent_by_name: dto.sent_by_name || null,
        status: lineSendStatus === 'success' ? 'sent' : (lineSendStatus === 'manual' ? 'sent' : 'failed'),
        line_send_status: lineSendStatus,
        error_message: errorMessage,
        is_auto_reply: dto.is_auto_reply || false,
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      this.logger.error(`Insert reply log failed: ${error.message}`);
    }

    // 若LINE沒設定 → 讓前端知道要手動複製
    const isManual = lineSendStatus === 'manual';
    return {
      success: lineSendStatus !== 'failed',
      line_send_status: lineSendStatus,
      message: isManual
        ? '已記錄回覆，請手動複製至 LINE 發送（尚未設定 LINE API Token）'
        : lineSendStatus === 'success'
          ? '回覆已透過 LINE API 成功發送'
          : `LINE 發送失敗：${errorMessage}，請手動複製發送`,
      log_id: log?.id || '',
    };
  }

  // ═══════════════════════════════════════════
  //  儲存草稿
  // ═══════════════════════════════════════════

  async saveDraft(dto: SaveDraftDto): Promise<{ id: string }> {
    // 先看是否有同 thread 的草稿，有則更新
    const { data: existing } = await this.db
      .from('line_reply_log')
      .select('id')
      .eq('thread_id', dto.thread_id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing?.id) {
      await this.db
        .from('line_reply_log')
        .update({ final_reply: dto.final_reply, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      return { id: existing.id };
    }

    const { data, error } = await this.db
      .from('line_reply_log')
      .insert({
        thread_id: dto.thread_id,
        employee_app_number: dto.employee_app_number || null,
        employee_name: dto.employee_name || null,
        original_message: dto.original_message || null,
        ai_suggestion: dto.ai_suggestion || null,
        final_reply: dto.final_reply,
        sent_by: dto.sent_by || null,
        sent_by_name: dto.sent_by_name || null,
        status: 'draft',
        is_auto_reply: false,
      })
      .select('id')
      .single();

    if (error) throw error;
    return { id: data.id };
  }

  // ═══════════════════════════════════════════
  //  公司規範 CRUD
  // ═══════════════════════════════════════════

  async getGuidelines() {
    const { data, error } = await this.db
      .from('company_guidelines')
      .select('*')
      .order('sort_order')
      .order('created_at');
    if (error) throw error;
    return data;
  }

  async createGuideline(dto: CreateGuidelineDto) {
    this.logger.log(`createGuideline: ${JSON.stringify(dto)}`);
    const { data, error } = await this.db
      .from('company_guidelines')
      .insert({
        title: dto.title,
        category: dto.category || '一般',
        content: dto.content,
        sort_order: dto.sort_order ?? 0,
        is_active: dto.is_active !== false,
      })
      .select()
      .single();
    if (error) {
      this.logger.error(`createGuideline error: ${error.message} | code: ${error.code} | details: ${error.details}`);
      throw new Error(error.message);
    }
    return data;
  }

  async updateGuideline(id: string, dto: UpdateGuidelineDto) {
    const { data, error } = await this.db
      .from('company_guidelines')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteGuideline(id: string) {
    const { error } = await this.db
      .from('company_guidelines')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  }

  // ═══════════════════════════════════════════
  //  自動回覆設定
  // ═══════════════════════════════════════════

  async getAutoReplySettings() {
    const { data, error } = await this.db
      .from('line_auto_reply_settings')
      .select('*')
      .order('id')
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateAutoReplySettings(dto: UpdateAutoReplySettingsDto) {
    const existing = await this.getAutoReplySettings();
    const updates: any = {
      ...dto,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { data, error } = await this.db
        .from('line_auto_reply_settings')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await this.db
        .from('line_auto_reply_settings')
        .insert(updates)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  // ═══════════════════════════════════════════
  //  回覆記錄查詢
  // ═══════════════════════════════════════════

  async getReplyLogs(params: {
    thread_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = params.limit || 20;
    const offset = params.offset || 0;

    let query = this.db
      .from('line_reply_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.thread_id) query = query.eq('thread_id', params.thread_id);
    if (params.status) query = query.eq('status', params.status);

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return { data: data || [], total: count || 0 };
  }

  // ═══════════════════════════════════════════
  //  自動回覆 - 檢查是否在非辦公時間
  // ═══════════════════════════════════════════

  async isOffHours(): Promise<boolean> {
    const settings = await this.getAutoReplySettings();
    if (!settings?.is_enabled) return false;

    const now = new Date();
    const hour = now.getHours();
    const dow = now.getDay(); // 0=日 6=六

    const daysOfWeek: number[] = settings.days_of_week || [0, 6];
    if (daysOfWeek.includes(dow)) return true;

    const startHour: number = settings.start_hour ?? 18;
    const endHour: number = settings.end_hour ?? 9;

    // 跨日判斷（例如 18:00 ~ 隔天 09:00）
    if (startHour > endHour) {
      return hour >= startHour || hour < endHour;
    }
    return hour >= startHour && hour < endHour;
  }

  // ═══════════════════════════════════════════
  //  觸發自動回覆（供 webhook 或排程呼叫）
  // ═══════════════════════════════════════════

  async triggerAutoReply(threadId: string, message: string, employeeAppNumber?: string, employeeName?: string): Promise<void> {
    const shouldAutoReply = await this.isOffHours();
    if (!shouldAutoReply) return;

    // 確認 N 秒內沒有重複自動回覆
    const settings = await this.getAutoReplySettings();
    const delaySec = settings?.delay_seconds ?? 30;

    const cutoff = new Date(Date.now() - delaySec * 1000).toISOString();
    const { data: recent } = await this.db
      .from('line_reply_log')
      .select('id')
      .eq('thread_id', threadId)
      .eq('is_auto_reply', true)
      .gte('created_at', cutoff)
      .limit(1)
      .single();

    if (recent?.id) {
      this.logger.log(`Auto-reply throttled for thread ${threadId}`);
      return;
    }

    try {
      const { suggestion } = await this.generateAiSuggestion({
        thread_id: threadId,
        original_message: message,
        employee_app_number: employeeAppNumber,
        employee_name: employeeName,
      });

      await this.sendReply({
        thread_id: threadId,
        final_reply: suggestion,
        original_message: message,
        ai_suggestion: suggestion,
        employee_app_number: employeeAppNumber,
        employee_name: employeeName,
        is_auto_reply: true,
      });

      this.logger.log(`Auto-reply sent to thread ${threadId}`);
    } catch (err: any) {
      this.logger.error(`Auto-reply failed: ${err.message}`);
    }
  }

  // ═══════════════════════════════════════════
  //  補入歷史主管回覆
  // ═══════════════════════════════════════════

  async insertHistoricalMessage(dto: {
    thread_id: string;
    message_text: string;
    message_time: string;
    employee_app_number?: string;
    employee_name?: string;
    sent_by?: string;
    sent_by_name?: string;
  }): Promise<{ id: string }> {
    // 用 manual_ 前綴產生唯一 source_record_id，避免 unique constraint 衝突
    const sourceId = `manual_${dto.thread_id}_${Date.now()}`;

    const { data, error } = await this.db
      .from('official_channel_messages')
      .insert({
        source_record_id: sourceId,
        source_system: 'manual',
        thread_id: dto.thread_id,
        channel: 'official-line',
        direction: 'store',          // 主管方向
        message_text: dto.message_text,
        message_time: dto.message_time,
        employee_app_number: dto.employee_app_number || null,
        employee_name: dto.employee_name || null,
        author_name: dto.sent_by_name || null,
        is_manual_insert: true,
        is_system_message: false,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return { id: data.id };
  }

  // ═══════════════════════════════════════════
  //  切換系統訊息標記
  // ═══════════════════════════════════════════

  async toggleSystemMessage(id: string, isSystem: boolean): Promise<{ success: boolean }> {
    const { error } = await this.db
      .from('official_channel_messages')
      .update({ is_system_message: isSystem })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
  }
}
