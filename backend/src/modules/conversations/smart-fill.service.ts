import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { EmployeesService } from '../employees/employees.service';

export interface SmartFillSuggestions {
  /** 從稿子中辨識的員工資訊（若有對應到資料庫，附 employee_id） */
  employee_match: {
    detected_name: string;
    employee_id: string | null;
    employee_name: string | null;
    employeeappnumber: string | null;
    confidence: 'high' | 'medium' | 'low';
    note?: string;        // 例如「資料庫中找到多筆同名員工，請手動確認」
  } | null;

  /** 訪談者姓名（從稿子中辨識） */
  interviewer_name: string | null;

  /** 自動產生的背景說明 */
  background_note: string;

  /** 清理過、標註發言者的對話稿 */
  cleaned_text: string;

  /** 發言者對照表（原始名字 → 角色標籤） */
  speakers: Array<{
    original_label: string;     // 原稿中的標籤（例如 "林翰" 或 "Speaker A"）
    role: 'supervisor' | 'employee' | 'unknown';
    name?: string;              // 識別出的真實姓名
  }>;

  /** AI 對全段對話的初判風險訊號（給主管預警，不取代正式 analysis） */
  preliminary_risk_signals: string[];

  /** AI 在清理過程注意到的辨識錯誤候選（給人工複核參考） */
  potential_transcription_errors: Array<{
    suspicious_text: string;
    likely_correct: string;
    reason: string;
  }>;

  /** 信心分數 0-1 */
  confidence_score: number;
}

const SMART_FILL_SYSTEM_PROMPT = `你是一個專業的訪談稿整理助手，協助 HR 主管處理「主管與員工面談」的逐字稿。

## 你的任務
給你一份語音轉文字後的訪談逐字稿（可能含時間戳、辨識錯字、口語贅字、發言者切換），請輸出以下結構化結果：

1. **發言者識別**：根據對話內容（誰問誰答、誰在介紹自己、誰提到「我們公司/門市」等）判斷每個說話者是「主管 (supervisor)」還是「員工 (employee)」。
2. **員工姓名辨識**：從對話中找出「員工」的真實姓名（可能在開場自我介紹、被主管叫到名字時出現）。
3. **訪談者（主管）姓名辨識**：從對話中找出「主管」的真實姓名。
4. **背景說明萃取**：總結這次面談的目的或主題（2-3 句話）。
5. **清理對話稿**：
   - 去掉時間戳（保留發言者結構）
   - 合併同一說話者的連續多段發言成一段
   - 修正明顯的語音辨識錯字（例如人名前後不一致時，以後出現的較正確版本為準；常見錯字如「課券」誤辨為「客券」「科訓」等）
   - 保留口語感但去除無意義贅詞（嗯、啊、那個那個...）
   - 用「[主管] ...」「[員工] ...」標註每段
6. **初判風險訊號**：列出 0-5 個值得主管後續關注的訊號（例如員工提到的壓力源、抱怨、離職意圖、人際衝突）— 不需做完整心理分析。
7. **可疑辨識錯誤**：列出 0-5 個你修正的明顯辨識錯字，給人工複核參考。

## 重要原則
- 必須輸出純 JSON，**不要**包在 markdown code block 中、**不要**加任何前言後語。
- 信心分數要實事求是：辨識不到員工名字時設低分。
- 若無法判斷發言者角色，role 設為 "unknown"。
- cleaned_text 必須是正體中文。`;

const OUTPUT_SCHEMA_HINT = `{
  "employee_detected_name": string | null,
  "interviewer_name": string | null,
  "background_note": string,
  "cleaned_text": string,
  "speakers": [
    { "original_label": string, "role": "supervisor" | "employee" | "unknown", "name": string | null }
  ],
  "preliminary_risk_signals": [string],
  "potential_transcription_errors": [
    { "suspicious_text": string, "likely_correct": string, "reason": string }
  ],
  "confidence_score": number
}`;

@Injectable()
export class SmartFillService {
  private readonly logger = new Logger(SmartFillService.name);
  private readonly anthropic: Anthropic | null;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly employeesService: EmployeesService,
  ) {
    const apiKey = this.config.get<string>('anthropic.apiKey');
    this.model = this.config.get<string>('anthropic.model') || 'claude-sonnet-4-20250514';
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not set — smart-fill disabled');
      this.anthropic = null;
    } else {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  /**
   * 處理逐字稿 → 結構化建議
   */
  async processTranscript(
    rawTranscript: string,
    options?: {
      hintInterviewerName?: string;     // 登入者名字，作為主管姓名提示
      hintEmployeeName?: string;        // 若使用者已選了員工，傳過來幫忙比對
    },
  ): Promise<SmartFillSuggestions> {
    if (!this.anthropic) {
      return this.fallbackSuggestions(rawTranscript);
    }

    const hint = this.buildHints(options);

    const userPrompt = `${hint}
## 逐字稿

${rawTranscript}

---

請依下列 JSON schema 回傳結果（純 JSON，不要 markdown code block）：

${OUTPUT_SCHEMA_HINT}`;

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SMART_FILL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected Claude response type');
      }

      const parsed = this.parseJsonResponse(content.text);

      // 嘗試把辨識到的員工名字對應到資料庫
      const employeeMatch = await this.matchEmployee(
        parsed.employee_detected_name,
        options?.hintEmployeeName,
      );

      const result: SmartFillSuggestions = {
        employee_match: employeeMatch,
        interviewer_name: parsed.interviewer_name || options?.hintInterviewerName || null,
        background_note: parsed.background_note || '',
        cleaned_text: parsed.cleaned_text || rawTranscript,
        speakers: Array.isArray(parsed.speakers) ? parsed.speakers : [],
        preliminary_risk_signals: Array.isArray(parsed.preliminary_risk_signals)
          ? parsed.preliminary_risk_signals
          : [],
        potential_transcription_errors: Array.isArray(parsed.potential_transcription_errors)
          ? parsed.potential_transcription_errors
          : [],
        confidence_score:
          typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0.5,
      };

      this.logger.log(
        `Smart-fill done: employee=${result.employee_match?.detected_name || 'none'}, ` +
          `interviewer=${result.interviewer_name || 'none'}, ` +
          `signals=${result.preliminary_risk_signals.length}, ` +
          `confidence=${result.confidence_score}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Smart-fill failed: ${error.message}`, error.stack);
      return this.fallbackSuggestions(rawTranscript);
    }
  }

  private buildHints(options?: { hintInterviewerName?: string; hintEmployeeName?: string }): string {
    if (!options) return '';
    const lines: string[] = ['## 額外提示'];
    if (options.hintInterviewerName) {
      lines.push(`- 訪談者（主管）通常是「${options.hintInterviewerName}」，但若稿子中明確出現別人名字，以稿子為準。`);
    }
    if (options.hintEmployeeName) {
      lines.push(`- 主管已預先指定員工為「${options.hintEmployeeName}」，請確認稿子中是否相符。`);
    }
    if (lines.length === 1) return '';
    return lines.join('\n') + '\n\n';
  }

  private parseJsonResponse(text: string): any {
    let json = text.trim();
    if (json.startsWith('```json')) {
      json = json.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (json.startsWith('```')) {
      json = json.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(json);
  }

  /**
   * 把 AI 辨識的員工姓名 → 員工 DB 對應
   */
  private async matchEmployee(
    detectedName: string | null,
    hintName?: string,
  ): Promise<SmartFillSuggestions['employee_match']> {
    const candidate = (detectedName || hintName || '').trim();
    if (!candidate) return null;

    try {
      const { data: matches } = await this.employeesService.search({
        q: candidate,
        limit: 5,
      });

      const exactMatches = matches.filter((m: any) => m.name === candidate);

      if (exactMatches.length === 1) {
        return {
          detected_name: candidate,
          employee_id: exactMatches[0].id,
          employee_name: exactMatches[0].name,
          employeeappnumber: exactMatches[0].employeeappnumber,
          confidence: 'high',
        };
      }

      if (exactMatches.length > 1) {
        return {
          detected_name: candidate,
          employee_id: null,
          employee_name: null,
          employeeappnumber: null,
          confidence: 'medium',
          note: `資料庫中找到 ${exactMatches.length} 筆同名員工「${candidate}」，請手動確認`,
        };
      }

      // 沒有 exact match，看模糊
      if (matches.length > 0) {
        const top = matches[0];
        return {
          detected_name: candidate,
          employee_id: null,
          employee_name: top.name,
          employeeappnumber: top.employeeappnumber,
          confidence: 'low',
          note: `辨識為「${candidate}」，資料庫中最接近的是「${top.name}」（${top.employeeappnumber}），請手動確認`,
        };
      }

      return {
        detected_name: candidate,
        employee_id: null,
        employee_name: null,
        employeeappnumber: null,
        confidence: 'low',
        note: `辨識為「${candidate}」，但資料庫中找不到符合的員工`,
      };
    } catch (error) {
      this.logger.warn(`Employee match failed: ${error.message}`);
      return null;
    }
  }

  /** AI 不可用時的 fallback */
  private fallbackSuggestions(rawTranscript: string): SmartFillSuggestions {
    return {
      employee_match: null,
      interviewer_name: null,
      background_note: '',
      cleaned_text: rawTranscript,
      speakers: [],
      preliminary_risk_signals: [],
      potential_transcription_errors: [],
      confidence_score: 0,
    };
  }
}
