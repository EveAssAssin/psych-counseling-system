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
var EmployeeContextService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeContextService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
const conversations_service_1 = require("./conversations.service");
let EmployeeContextService = EmployeeContextService_1 = class EmployeeContextService {
    constructor(supabase, conversations) {
        this.supabase = supabase;
        this.conversations = conversations;
        this.logger = new common_1.Logger(EmployeeContextService_1.name);
    }
    async buildConversationContext(employeeId, options) {
        const recentFullCount = options?.recentFullCount ?? 5;
        const olderSummaryCount = options?.olderSummaryCount ?? 5;
        const includeAnalysis = options?.includeAnalysis ?? true;
        const maxRawTextLength = options?.maxRawTextLength ?? 1500;
        const includeBackgroundNote = options?.includeBackgroundNote ?? true;
        try {
            const allConversations = await this.conversations.findByEmployee(employeeId);
            if (!allConversations || allConversations.length === 0) {
                return '';
            }
            const recentConvs = allConversations.slice(0, recentFullCount);
            const olderConvs = allConversations.slice(recentFullCount, recentFullCount + olderSummaryCount);
            const allIds = [...recentConvs, ...olderConvs].map((c) => c.id);
            const analysesByConvId = includeAnalysis
                ? await this.fetchAnalysesByConversationIds(allIds)
                : new Map();
            const lines = [];
            if (recentConvs.length > 0) {
                lines.push(`【主管面談記錄（近 ${recentConvs.length} 筆，含完整對話與 AI 心理分析）】`);
                recentConvs.forEach((conv, idx) => {
                    const date = conv.conversation_date
                        ? new Date(conv.conversation_date).toLocaleDateString('zh-TW')
                        : '日期不明';
                    const type = conv.conversation_type || '一般面談';
                    const interviewer = conv.interviewer_name || '未知';
                    lines.push(`\n▶ 第 ${idx + 1} 筆 ｜ ${date} ｜ 類型：${type} ｜ 訪談者：${interviewer}`);
                    if (includeBackgroundNote && conv.background_note) {
                        lines.push(`  背景：${conv.background_note}`);
                    }
                    const text = conv.extracted_text || conv.raw_text || '';
                    if (text) {
                        const truncated = text.length > maxRawTextLength
                            ? `${text.substring(0, maxRawTextLength)}…（已截斷，原文共 ${text.length} 字）`
                            : text;
                        lines.push(`  對話內容：\n${this.indentLines(truncated, '    ')}`);
                    }
                    else {
                        lines.push(`  對話內容：（未抽取或為空）`);
                    }
                    if (includeAnalysis) {
                        const analysis = analysesByConvId.get(conv.id);
                        if (analysis) {
                            lines.push(this.formatAnalysisSection(analysis, '  '));
                        }
                        else {
                            lines.push(`  AI 分析：尚未產生`);
                        }
                    }
                });
            }
            if (olderConvs.length > 0) {
                lines.push(`\n【更早面談摘要（第 ${recentFullCount + 1} ~ ${recentFullCount + olderConvs.length} 筆）】`);
                olderConvs.forEach((conv, idx) => {
                    const date = conv.conversation_date
                        ? new Date(conv.conversation_date).toLocaleDateString('zh-TW')
                        : '日期不明';
                    const interviewer = conv.interviewer_name || '未知';
                    const analysis = includeAnalysis ? analysesByConvId.get(conv.id) : null;
                    if (analysis) {
                        const riskTag = this.riskTag(analysis.risk_level, analysis.stress_level);
                        lines.push(`・[${recentFullCount + idx + 1}] ${date} ｜ ${interviewer} ${riskTag}` +
                            ` ｜ ${analysis.summary || analysis.current_psychological_state || '（無摘要）'}`);
                    }
                    else {
                        const text = conv.extracted_text || conv.raw_text || '';
                        const preview = text.substring(0, 100);
                        lines.push(`・[${recentFullCount + idx + 1}] ${date} ｜ ${interviewer} ｜ ${preview}${text.length > 100 ? '…' : ''}`);
                    }
                });
            }
            const totalCount = allConversations.length;
            const shownCount = recentConvs.length + olderConvs.length;
            if (totalCount > shownCount) {
                lines.push(`\n（員工另有 ${totalCount - shownCount} 筆更早的面談記錄未列入本次上下文）`);
            }
            return lines.join('\n');
        }
        catch (error) {
            this.logger.error(`Failed to build conversation context for employee ${employeeId}: ${error.message}`);
            return '';
        }
    }
    async fetchAnalysesByConversationIds(conversationIds) {
        const map = new Map();
        if (conversationIds.length === 0)
            return map;
        try {
            const client = this.supabase.getAdminClient();
            const { data, error } = await client
                .from('analysis_results')
                .select('*')
                .in('conversation_intake_id', conversationIds)
                .order('created_at', { ascending: false });
            if (error) {
                this.logger.warn(`Failed to fetch analyses: ${error.message}`);
                return map;
            }
            for (const a of data || []) {
                if (!map.has(a.conversation_intake_id)) {
                    map.set(a.conversation_intake_id, a);
                }
            }
        }
        catch (error) {
            this.logger.warn(`Failed to fetch analyses: ${error.message}`);
        }
        return map;
    }
    formatAnalysisSection(analysis, indent) {
        const lines = [`${indent}AI 心理分析：`];
        const riskTag = this.riskTag(analysis.risk_level, analysis.stress_level);
        lines.push(`${indent}  狀態：${analysis.current_psychological_state || '（未填）'} ${riskTag}`);
        if (analysis.summary) {
            lines.push(`${indent}  摘要：${analysis.summary}`);
        }
        if (Array.isArray(analysis.key_topics) && analysis.key_topics.length > 0) {
            lines.push(`${indent}  關鍵議題：${analysis.key_topics.join('、')}`);
        }
        if (Array.isArray(analysis.observations) && analysis.observations.length > 0) {
            lines.push(`${indent}  觀察：${analysis.observations.slice(0, 3).join('；')}`);
        }
        if (Array.isArray(analysis.suggested_actions) && analysis.suggested_actions.length > 0) {
            lines.push(`${indent}  建議行動：${analysis.suggested_actions.slice(0, 3).join('；')}`);
        }
        if (Array.isArray(analysis.taboo_topics) && analysis.taboo_topics.length > 0) {
            lines.push(`${indent}  避雷話題：${analysis.taboo_topics.join('、')}`);
        }
        if (analysis.next_talk_focus) {
            lines.push(`${indent}  下次重點：${analysis.next_talk_focus}`);
        }
        return lines.join('\n');
    }
    riskTag(risk, stress) {
        const tags = [];
        const riskMap = {
            critical: '🔴極高風險',
            high: '🟠高風險',
            moderate: '🟡中等風險',
            low: '🟢低風險',
        };
        const stressMap = {
            critical: '🔴極高壓力',
            high: '🟠高壓力',
            moderate: '🟡中等壓力',
            low: '🟢低壓力',
        };
        if (risk && riskMap[risk])
            tags.push(riskMap[risk]);
        if (stress && stressMap[stress])
            tags.push(stressMap[stress]);
        return tags.length > 0 ? `[${tags.join(' / ')}]` : '';
    }
    indentLines(text, indent) {
        return text
            .split('\n')
            .map((line) => indent + line)
            .join('\n');
    }
};
exports.EmployeeContextService = EmployeeContextService;
exports.EmployeeContextService = EmployeeContextService = EmployeeContextService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        conversations_service_1.ConversationsService])
], EmployeeContextService);
//# sourceMappingURL=employee-context.service.js.map