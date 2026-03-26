import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseService } from '../supabase/supabase.service';
import { ConversationsService } from '../conversations/conversations.service';
import { IntakeStatus } from '../conversations/conversations.dto';
import {
  AnalysisResult,
  AIAnalysisOutput,
  StressLevel,
  RiskLevel,
} from './analysis.dto';

const ANALYSIS_PROMPT_VERSION = '2.0.0';

const ANALYSIS_SYSTEM_PROMPT = `你是一位專業的職場心理分析師，專門協助企業主管理解員工的心理狀態與風險。

你的任務是分析主管與員工的對話內容，提供以下分析：

1. **目前心理狀態** (current_psychological_state)
   - 簡述員工目前的心理狀態，用 2-3 句話描述

2. **壓力等級** (stress_level)
   - low: 壓力正常，情緒穩定
   - moderate: 有一定壓力，但仍可處理
   - high: 壓力明顯，需要關注
   - critical: 壓力極大，需要立即介入

3. **風險等級** (risk_level)
   - low: 無明顯風險
   - moderate: 需持續觀察
   - high: 需要主動關心
   - critical: 需要立即處理（含自傷暗示、崩潰、強烈離職意向）

4. **摘要** (summary)
   - 50-100 字的對話重點摘要

5. **關鍵議題** (key_topics)
   - 列出 3-5 個員工提到的關鍵議題

6. **觀察發現** (observations)
   - 列出 3-5 個你觀察到的重要發現

7. **建議行動** (suggested_actions)
   - 給主管的 3-5 個具體建議

8. **避雷議題** (taboo_topics)
   - 下次對話應避免或小心處理的議題

9. **建議提問** (interviewer_question_suggestions)
   - 給主管下次對話的 3-5 個建議問題

10. **是否需要追蹤** (followup_needed)
    - true/false

11. **建議追蹤天數** (followup_suggested_days)
    - 如果需要追蹤，建議幾天後再次關心

12. **主管介入程度** (supervisor_involvement)
    - 例如：「持續觀察」、「主動關心」、「立即約談」、「通報 HR」

13. **下次談話重點** (next_talk_focus)
    - 下次談話應該聚焦的主題

14. **信心分數** (confidence_score)
    - 0-1 之間，表示分析的信心程度

15. **風險標記** (risk_flags) - 如果有高風險情況
    - type: 風險類型（self_harm, resignation, conflict, burnout, breakdown）
    - severity: 嚴重程度
    - title: 標題
    - description: 描述
    - evidence: 對話中的依據

重要原則：
- 以「風險判讀」表述，不是「醫療診斷」
- 結論必須基於對話內容，不可無依據臆測
- 高風險判定標準：自傷暗示、明顯崩潰、強烈離職意向、嚴重職場衝突、長期壓力失衡
- 回答必須是正體中文

請以 JSON 格式輸出，不要包含任何其他文字。`;

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly anthropic: Anthropic;
  private readonly TABLE = 'analysis_results';

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly conversationsService: ConversationsService,
  ) {
    const apiKey = this.configService.get<string>('anthropic.apiKey');
    if (!apiKey) {
      this.logger.warn('Anthropic API key not configured');
    } else {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Anthropic client initialized');
    }
  }

  /**
   * 執行 AI 分析
   */
  async analyze(conversationId: string, force: boolean = false): Promise<AnalysisResult> {
    this.logger.log(`Starting analysis for conversation: ${conversationId}`);

    // 取得對話
    const conversation = await this.conversationsService.findById(conversationId);

    if (!conversation.extracted_text && !conversation.raw_text) {
      throw new Error('No text content to analyze');
    }

    // 檢查是否已有分析結果
    if (!force) {
      const existing = await this.findByConversationId(conversationId);
      if (existing) {
        this.logger.log(`Using existing analysis: ${existing.id}`);
        return existing;
      }
    }

    // 更新狀態為分析中
    await this.conversationsService.updateStatus(conversationId, IntakeStatus.ANALYZING);

    try {
      // 執行 AI 分析
      const textToAnalyze = conversation.extracted_text || conversation.raw_text;
      const aiOutput = await this.callClaudeAnalysis(textToAnalyze!, conversation.background_note);

      // 儲存分析結果
      const result = await this.saveAnalysisResult(conversation.id, conversation.employee_id, aiOutput);

      // 更新對話狀態為完成
      await this.conversationsService.updateStatus(conversationId, IntakeStatus.COMPLETED);

      // 如果有高風險標記，建立 risk_flags
      if (aiOutput.risk_flags && aiOutput.risk_flags.length > 0) {
        await this.createRiskFlags(result.id, conversation.employee_id, aiOutput.risk_flags);
      }

      // 更新員工目前狀態快照
      await this.updateEmployeeCurrentStatus(conversation.employee_id, result);

      this.logger.log(`Analysis completed: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Analysis failed: ${error.message}`);
      await this.conversationsService.updateStatus(conversationId, IntakeStatus.FAILED, error.message);
      throw error;
    }
  }

  /**
   * 呼叫 Claude API 進行分析
   */
  private async callClaudeAnalysis(text: string, backgroundNote?: string): Promise<AIAnalysisOutput> {
    if (!this.anthropic) {
      throw new Error('Anthropic API not configured');
    }

    const userPrompt = `請分析以下對話內容：

${backgroundNote ? `【背景說明】\n${backgroundNote}\n\n` : ''}【對話內容】
${text}

請依照指定格式輸出 JSON 分析結果。`;

    this.logger.debug('Calling Claude API for analysis');

    const response = await this.anthropic.messages.create({
      model: this.configService.get<string>('anthropic.model') || 'claude-sonnet-4-20250514',
      max_tokens: this.configService.get<number>('anthropic.maxTokens') || 4096,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // 解析回應
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    try {
      // 嘗試解析 JSON
      let jsonText = content.text.trim();
      
      // 移除可能的 markdown code block
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const output = JSON.parse(jsonText) as AIAnalysisOutput;
      
      // 驗證必要欄位
      if (!output.current_psychological_state || !output.stress_level || !output.risk_level) {
        throw new Error('Missing required fields in AI output');
      }

      return output;
    } catch (parseError) {
      this.logger.error('Failed to parse AI response:', content.text);
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }
  }

  /**
   * 儲存分析結果
   */
  private async saveAnalysisResult(
    conversationId: string,
    employeeId: string,
    output: AIAnalysisOutput,
  ): Promise<AnalysisResult> {
    const followupSuggestedAt = output.followup_needed && output.followup_suggested_days
      ? new Date(Date.now() + output.followup_suggested_days * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    return this.supabase.create<AnalysisResult>(
      this.TABLE,
      {
        conversation_intake_id: conversationId,
        employee_id: employeeId,
        current_psychological_state: output.current_psychological_state,
        stress_level: output.stress_level,
        risk_level: output.risk_level,
        summary: output.summary,
        key_topics: output.key_topics,
        observations: output.observations,
        suggested_actions: output.suggested_actions,
        taboo_topics: output.taboo_topics,
        interviewer_question_suggestions: output.interviewer_question_suggestions,
        followup_needed: output.followup_needed,
        followup_suggested_at: followupSuggestedAt,
        supervisor_involvement: output.supervisor_involvement,
        next_talk_focus: output.next_talk_focus,
        model_name: this.configService.get<string>('anthropic.model') || 'claude-sonnet-4-20250514',
        analysis_prompt_version: ANALYSIS_PROMPT_VERSION,
        raw_response: output as any,
        confidence_score: output.confidence_score,
      },
      { useAdmin: true },
    );
  }

  /**
   * 建立風險標記
   */
  private async createRiskFlags(
    analysisResultId: string,
    employeeId: string,
    riskFlags: AIAnalysisOutput['risk_flags'],
  ): Promise<void> {
    if (!riskFlags || riskFlags.length === 0) return;

    for (const flag of riskFlags) {
      await this.supabase.create(
        'risk_flags',
        {
          analysis_result_id: analysisResultId,
          employee_id: employeeId,
          risk_type: flag.type,
          severity: flag.severity,
          title: flag.title,
          description: flag.description,
          evidence_text: flag.evidence,
          status: 'open',
        },
        { useAdmin: true },
      );
    }

    this.logger.log(`Created ${riskFlags.length} risk flags for employee ${employeeId}`);
  }

  /**
   * 更新員工目前狀態快照
   */
  private async updateEmployeeCurrentStatus(
    employeeId: string,
    analysis: AnalysisResult,
  ): Promise<void> {
    // 計算開放的風險標記數
    const openRiskFlags = await this.supabase.count(
      'risk_flags',
      { employee_id: employeeId, status: 'open' },
      { useAdmin: true },
    );

    // 計算總對話數
    const totalConversations = await this.supabase.count(
      'conversation_intakes',
      { employee_id: employeeId },
      { useAdmin: true },
    );

    await this.supabase.upsert(
      'employee_current_status',
      {
        employee_id: employeeId,
        latest_analysis_id: analysis.id,
        latest_intake_id: analysis.conversation_intake_id,
        latest_analysis_at: analysis.created_at,
        current_psychological_state: analysis.current_psychological_state,
        current_stress_level: analysis.stress_level,
        current_risk_level: analysis.risk_level,
        total_conversations: totalConversations,
        open_risk_flags: openRiskFlags,
        needs_followup: analysis.followup_needed,
        next_suggested_contact: analysis.followup_suggested_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'employee_id', useAdmin: true },
    );
  }

  /**
   * 取得分析結果（by ID）
   */
  async findById(id: string): Promise<AnalysisResult> {
    const result = await this.supabase.findOne<AnalysisResult>(
      this.TABLE,
      { id },
      { useAdmin: true },
    );

    if (!result) {
      throw new NotFoundException(`Analysis result not found: ${id}`);
    }

    return result;
  }

  /**
   * 取得分析結果（by conversation ID）
   */
  async findByConversationId(conversationId: string): Promise<AnalysisResult | null> {
    return this.supabase.findOne<AnalysisResult>(
      this.TABLE,
      { conversation_intake_id: conversationId },
      { useAdmin: true },
    );
  }

  /**
   * 取得員工的所有分析結果
   */
  async findByEmployee(employeeId: string): Promise<AnalysisResult[]> {
    return this.supabase.findMany<AnalysisResult>(this.TABLE, {
      filters: { employee_id: employeeId },
      orderBy: { column: 'created_at', ascending: false },
      useAdmin: true,
    });
  }

  /**
   * 取得員工最新分析結果
   */
  async getLatestByEmployee(employeeId: string): Promise<AnalysisResult | null> {
    const results = await this.supabase.findMany<AnalysisResult>(this.TABLE, {
      filters: { employee_id: employeeId },
      orderBy: { column: 'created_at', ascending: false },
      limit: 1,
      useAdmin: true,
    });

    return results[0] || null;
  }

  /**
   * 搜尋分析結果
   */
  async search(options: {
    employee_id?: string;
    risk_level?: RiskLevel;
    stress_level?: StressLevel;
    followup_needed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    data: AnalysisResult[];
    total: number;
  }> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const client = this.supabase.getAdminClient();
    let query = client.from(this.TABLE).select('*', { count: 'exact' });

    if (options.employee_id) {
      query = query.eq('employee_id', options.employee_id);
    }
    if (options.risk_level) {
      query = query.eq('risk_level', options.risk_level);
    }
    if (options.stress_level) {
      query = query.eq('stress_level', options.stress_level);
    }
    if (options.followup_needed !== undefined) {
      query = query.eq('followup_needed', options.followup_needed);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: data || [],
      total: count || 0,
    };
  }

  /**
   * 取得高風險分析列表
   */
  async getHighRiskAnalyses(limit: number = 20): Promise<AnalysisResult[]> {
    const client = this.supabase.getAdminClient();

    const { data, error } = await client
      .from(this.TABLE)
      .select('*')
      .in('risk_level', ['high', 'critical'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  }
}
