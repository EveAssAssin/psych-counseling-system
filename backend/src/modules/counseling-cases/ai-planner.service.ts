import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface PlannerInput {
  employee: {
    name: string;
    app_number: string;
    department?: string;
    store_name?: string;
    title?: string;
  };
  state_tags: Array<{
    code: string;
    label: string;
    description?: string;
    ai_prompt_hint?: string;
    severity?: string;
  }>;
  state_description?: string;
  goal: string;
  allowed_methods: string[];     // ['phone','face_to_face',...]
  workday_count: number;          // 期間內有多少工作日可用
  start_date: string;
  target_end_date: string;
  insight_summary?: any;          // EmployeeInsight 中的 summary block（風險、key concerns…）
}

export interface PlannerOutput {
  summary: string;
  items: Array<{
    sequence: number;
    workday_offset: number;       // 0-indexed，0 = 第一個工作日，N-1 = 最後一個工作日
    method: string;
    objective: string;
    recommended_actions: Record<string, any>;
    estimated_minutes: number;
  }>;
  meta: {
    model: string;
    input_tokens?: number;
    output_tokens?: number;
    generated_at: string;
  };
}

/**
 * 把員工狀況、輔導目標、可用方法、工作日數量丟給 Claude，
 * 要求產出排程計畫。Claude 必須回傳 JSON，由本 service 解析、驗證。
 *
 * 不寫 DB、不算日期，只負責「給結構化建議」。日期對齊在 caller 端做。
 */
@Injectable()
export class AiPlannerService {
  private readonly logger = new Logger(AiPlannerService.name);
  private readonly anthropic: Anthropic;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
    this.model = this.config.get<string>('anthropic.model') || 'claude-sonnet-4-20250514';
  }

  async generateDraft(input: PlannerInput): Promise<PlannerOutput> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    let raw: string;
    let usage: { input_tokens?: number; output_tokens?: number } = {};
    try {
      const resp = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const block = resp.content[0];
      raw = block.type === 'text' ? block.text : '';
      usage = { input_tokens: resp.usage?.input_tokens, output_tokens: resp.usage?.output_tokens };
    } catch (err: any) {
      this.logger.error(`Claude call failed: ${err?.message}`, err?.stack);
      throw new InternalServerErrorException('AI 排程生成失敗，請稍後重試');
    }

    let parsed: { summary: string; items: any[] };
    try {
      parsed = this.extractJson(raw);
    } catch (err: any) {
      this.logger.error(`Claude output was not valid JSON: ${err?.message}\nRaw: ${raw.slice(0, 500)}`);
      throw new InternalServerErrorException('AI 回傳格式不正確，請重試');
    }

    const items = this.validateAndNormalizeItems(parsed.items, input);

    return {
      summary: parsed.summary || '',
      items,
      meta: {
        model: this.model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        generated_at: new Date().toISOString(),
      },
    };
  }

  // ─────────────────────────────────────────
  //  Prompt 組裝
  // ─────────────────────────────────────────

  private buildSystemPrompt(): string {
    return [
      '你是資深的職場心理輔導督導，協助第一線輔導員規劃完整的個案輔導排程。',
      '',
      '你的任務：根據員工狀態、輔導目標、可用方法與工作日數量，產出一份具體可執行的輔導排程。',
      '',
      '輸出原則：',
      '1. 排程節點數量視案件嚴重度與時程而定，通常 3-8 個節點最有效。節點太密集會給員工壓力，太鬆散會失去連續性。',
      '2. 每個節點都必須有明確的「這次要達成什麼」(objective)，避免泛泛的「關心一下」。',
      '3. recommended_actions 應包含：開場切入點、可問的關鍵問題、要觀察的訊號、注意事項。',
      '4. 前期重在建立信任與蒐集資訊，中期切入核心議題，後期評估與收尾。',
      '5. 只使用 allowed_methods 中列出的方法；不要建議未授權的方法。',
      '6. workday_offset 從 0 開始（0 = 第一個工作日），最大不超過 workday_count - 1。',
      '7. 避免規劃在離結束日太近（例如最後一天才第一次面談），給雙方時間消化。',
      '',
      '輸出格式：只回傳 JSON，不要任何說明文字、不要 markdown code block。schema：',
      '{',
      '  "summary": "string，整體計畫的 2-3 句話摘要，說明會分幾階段做什麼",',
      '  "items": [',
      '    {',
      '      "sequence": 1,',
      '      "workday_offset": 0,',
      '      "method": "phone|face_to_face|line_text|observation|group|written",',
      '      "objective": "string，這次要達成什麼",',
      '      "recommended_actions": {',
      '        "opening": "string，開場切入點",',
      '        "key_questions": ["string", ...],',
      '        "observe": ["string，要觀察的訊號", ...],',
      '        "cautions": ["string，注意事項", ...]',
      '      },',
      '      "estimated_minutes": 30',
      '    }',
      '  ]',
      '}',
    ].join('\n');
  }

  private buildUserPrompt(input: PlannerInput): string {
    const stateTagBlock = input.state_tags.map(t =>
      `- ${t.label} (${t.code}, 嚴重度=${t.severity || 'moderate'})\n  說明：${t.description || '(無)'}\n  輔導要點：${t.ai_prompt_hint || '(無)'}`
    ).join('\n');

    const insightBlock = input.insight_summary
      ? this.summarizeInsight(input.insight_summary)
      : '(無歷史 insight 資料)';

    return [
      '【員工資訊】',
      `姓名：${input.employee.name}`,
      `工號：${input.employee.app_number}`,
      `部門：${input.employee.department || '(未提供)'}`,
      `門市：${input.employee.store_name || '(未提供)'}`,
      `職稱：${input.employee.title || '(未提供)'}`,
      '',
      '【目前狀態（可多選）】',
      stateTagBlock,
      input.state_description ? `\n輔導員補充說明：${input.state_description}` : '',
      '',
      '【歷史資料快照】',
      insightBlock,
      '',
      '【輔導設定】',
      `目標：${input.goal}`,
      `期間：${input.start_date} ~ ${input.target_end_date}`,
      `可用工作日數：${input.workday_count} 天（已扣除假日 / 週末）`,
      `允許的方法：${input.allowed_methods.join(', ')}`,
      '',
      '請依以上資訊規劃排程，直接回傳 JSON。',
    ].filter(Boolean).join('\n');
  }

  private summarizeInsight(insight: any): string {
    if (!insight || typeof insight !== 'object') return '(無有效 insight)';
    const lines: string[] = [];
    if (insight.risk_level) lines.push(`風險等級：${insight.risk_level}`);
    if (insight.stress_level) lines.push(`壓力等級：${insight.stress_level}`);
    if (insight.trend) lines.push(`趨勢：${insight.trend}`);
    if (insight.overall_assessment) lines.push(`整體評估：${insight.overall_assessment}`);
    if (Array.isArray(insight.key_concerns) && insight.key_concerns.length) {
      lines.push(`主要關注：${insight.key_concerns.slice(0, 5).join(' / ')}`);
    }
    if (Array.isArray(insight.positive_signals) && insight.positive_signals.length) {
      lines.push(`正向訊號：${insight.positive_signals.slice(0, 3).join(' / ')}`);
    }
    return lines.join('\n') || '(insight 內容為空)';
  }

  // ─────────────────────────────────────────
  //  輸出解析與驗證
  // ─────────────────────────────────────────

  private extractJson(raw: string): { summary: string; items: any[] } {
    // Claude 偶爾會用 ```json ... ``` 包住，剝掉
    let t = raw.trim();
    if (t.startsWith('```')) {
      t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    }
    const parsed = JSON.parse(t);
    if (typeof parsed !== 'object' || !parsed) throw new Error('not an object');
    if (!Array.isArray(parsed.items)) throw new Error('items not array');
    return parsed;
  }

  private validateAndNormalizeItems(items: any[], input: PlannerInput): PlannerOutput['items'] {
    const allowed = new Set(input.allowed_methods);
    const maxOffset = Math.max(0, input.workday_count - 1);

    return items
      .map((it, idx) => {
        const sequence = Number.isFinite(it.sequence) ? Math.floor(it.sequence) : idx + 1;
        let offset = Number.isFinite(it.workday_offset) ? Math.floor(it.workday_offset) : 0;
        offset = Math.max(0, Math.min(offset, maxOffset));

        let method = String(it.method || '').trim();
        if (!allowed.has(method)) {
          // fallback：選 allowed 第一個，避免直接丟棄
          method = input.allowed_methods[0];
        }

        const objective = String(it.objective || '').trim();
        if (!objective) return null;

        const recommended_actions =
          it.recommended_actions && typeof it.recommended_actions === 'object'
            ? it.recommended_actions
            : {};

        const minutes = Number.isFinite(it.estimated_minutes)
          ? Math.max(5, Math.min(180, Math.floor(it.estimated_minutes)))
          : 30;

        return {
          sequence,
          workday_offset: offset,
          method,
          objective,
          recommended_actions,
          estimated_minutes: minutes,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.workday_offset - b.workday_offset || a.sequence - b.sequence)
      .map((x, i) => ({ ...x, sequence: i + 1 })); // 重新編號
  }
}
