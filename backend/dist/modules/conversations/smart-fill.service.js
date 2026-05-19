"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SmartFillService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartFillService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = require("@anthropic-ai/sdk");
const employees_service_1 = require("../employees/employees.service");
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
let SmartFillService = SmartFillService_1 = class SmartFillService {
    constructor(config, employeesService) {
        this.config = config;
        this.employeesService = employeesService;
        this.logger = new common_1.Logger(SmartFillService_1.name);
        const apiKey = this.config.get('anthropic.apiKey');
        this.model = this.config.get('anthropic.model') || 'claude-sonnet-4-20250514';
        if (!apiKey) {
            this.logger.warn('ANTHROPIC_API_KEY not set — smart-fill disabled');
            this.anthropic = null;
        }
        else {
            this.anthropic = new sdk_1.default({ apiKey });
        }
    }
    async processTranscript(rawTranscript, options) {
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
            const employeeMatch = await this.matchEmployee(parsed.employee_detected_name, options?.hintEmployeeName);
            const result = {
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
                confidence_score: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0.5,
            };
            this.logger.log(`Smart-fill done: employee=${result.employee_match?.detected_name || 'none'}, ` +
                `interviewer=${result.interviewer_name || 'none'}, ` +
                `signals=${result.preliminary_risk_signals.length}, ` +
                `confidence=${result.confidence_score}`);
            return result;
        }
        catch (error) {
            this.logger.error(`Smart-fill failed: ${error.message}`, error.stack);
            return this.fallbackSuggestions(rawTranscript);
        }
    }
    buildHints(options) {
        if (!options)
            return '';
        const lines = ['## 額外提示'];
        if (options.hintInterviewerName) {
            lines.push(`- 訪談者（主管）通常是「${options.hintInterviewerName}」，但若稿子中明確出現別人名字，以稿子為準。`);
        }
        if (options.hintEmployeeName) {
            lines.push(`- 主管已預先指定員工為「${options.hintEmployeeName}」，請確認稿子中是否相符。`);
        }
        if (lines.length === 1)
            return '';
        return lines.join('\n') + '\n\n';
    }
    parseJsonResponse(text) {
        let json = text.trim();
        if (json.startsWith('```json')) {
            json = json.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        }
        else if (json.startsWith('```')) {
            json = json.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        return JSON.parse(json);
    }
    async matchEmployee(detectedName, hintName) {
        const candidate = (detectedName || hintName || '').trim();
        if (!candidate)
            return null;
        try {
            const { data: matches } = await this.employeesService.search({
                q: candidate,
                limit: 5,
            });
            const exactMatches = matches.filter((m) => m.name === candidate);
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
        }
        catch (error) {
            this.logger.warn(`Employee match failed: ${error.message}`);
            return null;
        }
    }
    fallbackSuggestions(rawTranscript) {
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
};
exports.SmartFillService = SmartFillService;
exports.SmartFillService = SmartFillService = SmartFillService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        employees_service_1.EmployeesService])
], SmartFillService);
//# sourceMappingURL=smart-fill.service.js.map