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
var AiPlannerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiPlannerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = require("@anthropic-ai/sdk");
let AiPlannerService = AiPlannerService_1 = class AiPlannerService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(AiPlannerService_1.name);
        this.anthropic = new sdk_1.default({
            apiKey: this.config.get('ANTHROPIC_API_KEY'),
        });
        this.model = this.config.get('anthropic.model') || 'claude-sonnet-4-6';
    }
    async generateDraft(input) {
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(input);
        let raw;
        let usage = {};
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
        }
        catch (err) {
            this.logger.error(`Claude call failed: ${err?.message}`, err?.stack);
            throw new common_1.InternalServerErrorException('AI 排程生成失敗，請稍後重試');
        }
        let parsed;
        try {
            parsed = this.extractJson(raw);
        }
        catch (err) {
            this.logger.error(`Claude output was not valid JSON: ${err?.message}\nRaw: ${raw.slice(0, 500)}`);
            throw new common_1.InternalServerErrorException('AI 回傳格式不正確，請重試');
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
    buildSystemPrompt() {
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
    buildUserPrompt(input) {
        const stateTagBlock = input.state_tags.map(t => `- ${t.label} (${t.code}, 嚴重度=${t.severity || 'moderate'})\n  說明：${t.description || '(無)'}\n  輔導要點：${t.ai_prompt_hint || '(無)'}`).join('\n');
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
    summarizeInsight(insight) {
        if (!insight || typeof insight !== 'object')
            return '(無有效 insight)';
        const lines = [];
        if (insight.risk_level)
            lines.push(`風險等級：${insight.risk_level}`);
        if (insight.stress_level)
            lines.push(`壓力等級：${insight.stress_level}`);
        if (insight.trend)
            lines.push(`趨勢：${insight.trend}`);
        if (insight.overall_assessment)
            lines.push(`整體評估：${insight.overall_assessment}`);
        if (Array.isArray(insight.key_concerns) && insight.key_concerns.length) {
            lines.push(`主要關注：${insight.key_concerns.slice(0, 5).join(' / ')}`);
        }
        if (Array.isArray(insight.positive_signals) && insight.positive_signals.length) {
            lines.push(`正向訊號：${insight.positive_signals.slice(0, 3).join(' / ')}`);
        }
        return lines.join('\n') || '(insight 內容為空)';
    }
    extractJson(raw) {
        let t = raw.trim();
        if (t.startsWith('```')) {
            t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        }
        const parsed = JSON.parse(t);
        if (typeof parsed !== 'object' || !parsed)
            throw new Error('not an object');
        if (!Array.isArray(parsed.items))
            throw new Error('items not array');
        return parsed;
    }
    validateAndNormalizeItems(items, input) {
        const allowed = new Set(input.allowed_methods);
        const maxOffset = Math.max(0, input.workday_count - 1);
        return items
            .map((it, idx) => {
            const sequence = Number.isFinite(it.sequence) ? Math.floor(it.sequence) : idx + 1;
            let offset = Number.isFinite(it.workday_offset) ? Math.floor(it.workday_offset) : 0;
            offset = Math.max(0, Math.min(offset, maxOffset));
            let method = String(it.method || '').trim();
            if (!allowed.has(method)) {
                method = input.allowed_methods[0];
            }
            const objective = String(it.objective || '').trim();
            if (!objective)
                return null;
            const recommended_actions = it.recommended_actions && typeof it.recommended_actions === 'object'
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
            .filter((x) => x !== null)
            .sort((a, b) => a.workday_offset - b.workday_offset || a.sequence - b.sequence)
            .map((x, i) => ({ ...x, sequence: i + 1 }));
    }
};
exports.AiPlannerService = AiPlannerService;
exports.AiPlannerService = AiPlannerService = AiPlannerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiPlannerService);
//# sourceMappingURL=ai-planner.service.js.map