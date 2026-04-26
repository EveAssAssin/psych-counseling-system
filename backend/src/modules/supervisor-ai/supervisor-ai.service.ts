import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { SupervisorNotesService } from '../supervisor-notes/supervisor-notes.service';

export type AiType = 'claude' | 'openai' | 'gemini';

@Injectable()
export class SupervisorAiService {
  private readonly logger = new Logger(SupervisorAiService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly notesService: SupervisorNotesService,
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
        .eq('app_number', dto.employee_app_number)
        .single();
      employee_id = emp?.id;
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
  //  建立系統提示（彙整人員資料）
  // ═══════════════════════════════════════════

  private async buildSystemPrompt(session: any): Promise<string> {
    const persona = await this.getPersona(session.ai_type as AiType);
    let prompt = persona?.system_prompt || '你是一位專業的職場心理顧問。';

    if (session.employee_app_number) {
      // 收集該人員相關資料
      const [notes, empData] = await Promise.all([
        this.notesService.getNotesByEmployee(session.employee_app_number),
        this.getEmployeeData(session.employee_app_number),
      ]);

      if (empData) {
        prompt += `\n\n【員工基本資料】\n`;
        prompt += `姓名：${empData.name || session.employee_name}\n`;
        if (empData.store_name) prompt += `所屬店家：${empData.store_name}\n`;
        if (empData.position)   prompt += `職位：${empData.position}\n`;
        if (empData.hire_date)  prompt += `到職日：${empData.hire_date}\n`;
      }

      if (notes.length > 0) {
        prompt += `\n\n【主管隨手記（最近 ${notes.length} 筆）】\n`;
        notes.slice(0, 20).forEach((n: any, i: number) => {
          const date = new Date(n.created_at).toLocaleDateString('zh-TW');
          prompt += `\n[${i + 1}] ${date} ｜ ${n.category_name || '未分類'} ｜ 記錄者：${n.supervisor_name}\n`;
          prompt += `${n.content}\n`;
        });
      } else {
        prompt += `\n\n【目前尚無該員工的隨手記紀錄】\n`;
      }

      prompt += `\n\n請根據以上資料，協助主管了解員工狀況。`;
    }

    return prompt;
  }

  private async getEmployeeData(appNumber: string) {
    const { data } = await this.db
      .from('employees')
      .select('name, store_name, position, hire_date, status')
      .eq('app_number', appNumber)
      .single();
    return data;
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
