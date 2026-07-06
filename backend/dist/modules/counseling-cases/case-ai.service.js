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
var CaseAiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseAiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = require("@anthropic-ai/sdk");
const supabase_service_1 = require("../supabase/supabase.service");
let CaseAiService = CaseAiService_1 = class CaseAiService {
    constructor(supabase, config) {
        this.supabase = supabase;
        this.config = config;
        this.logger = new common_1.Logger(CaseAiService_1.name);
        this.RECENT_EXECUTIONS_LIMIT = 8;
        this.MESSAGE_HISTORY_LIMIT = 40;
        this.anthropic = new sdk_1.default({
            apiKey: this.config.get('ANTHROPIC_API_KEY'),
        });
        this.model = this.config.get('anthropic.model') || 'claude-sonnet-4-6';
    }
    get db() { return this.supabase.getAdminClient(); }
    async listSessions(caseId) {
        await this.requireCase(caseId);
        const { data, error } = await this.db
            .from('supervisor_ai_sessions')
            .select('*')
            .eq('case_id', caseId)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data ?? [];
    }
    async getOrCreateSession(caseId, supervisorIdentifier) {
        const caseRow = await this.requireCase(caseId);
        const { data: existing } = await this.db
            .from('supervisor_ai_sessions')
            .select('*')
            .eq('case_id', caseId)
            .eq('supervisor_id', supervisorIdentifier)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (existing)
            return existing;
        const { data: sup } = await this.db
            .from('authorized_supervisors')
            .select('name, identifier, is_active')
            .eq('identifier', supervisorIdentifier)
            .maybeSingle();
        if (!sup || !sup.is_active) {
            throw new common_1.ForbiddenException('輔導員無權存取或帳號已停用');
        }
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
        if (error)
            throw error;
        return created;
    }
    async getMessages(sessionId, supervisorIdentifier) {
        await this.requireSessionAccess(sessionId, supervisorIdentifier);
        const { data, error } = await this.db
            .from('supervisor_ai_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });
        if (error)
            throw error;
        return data ?? [];
    }
    async sendMessage(sessionId, supervisorIdentifier, userContent) {
        if (!userContent || !userContent.trim()) {
            throw new common_1.BadRequestException('訊息不能為空');
        }
        const session = await this.requireSessionAccess(sessionId, supervisorIdentifier);
        if (!session.case_id) {
            throw new common_1.BadRequestException('此 session 非案件 session');
        }
        const { data: userMsg, error: userErr } = await this.db
            .from('supervisor_ai_messages')
            .insert({ session_id: sessionId, role: 'user', content: userContent.trim() })
            .select()
            .single();
        if (userErr)
            throw userErr;
        const systemPrompt = await this.buildSystemPrompt(session.case_id);
        const history = await this.getRecentMessagesForClaude(sessionId);
        let assistantText = '';
        let usage = {};
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
        }
        catch (err) {
            this.logger.error(`Claude call failed for case session ${sessionId}: ${err?.message}`);
            throw new common_1.InternalServerErrorException('AI 暫時無法回應，您的訊息已保留');
        }
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
        if (aErr)
            throw aErr;
        await this.db
            .from('supervisor_ai_sessions')
            .update({
            message_count: (session.message_count ?? 0) + 2,
            updated_at: new Date().toISOString(),
        })
            .eq('id', sessionId);
        return { user_message: userMsg, assistant_message: assistantMsg };
    }
    async requireCase(caseId) {
        const { data, error } = await this.db
            .from('counseling_cases')
            .select('*')
            .eq('id', caseId)
            .single();
        if (error || !data)
            throw new common_1.NotFoundException(`Case ${caseId} not found`);
        return data;
    }
    async requireSessionAccess(sessionId, supervisorIdentifier) {
        const { data, error } = await this.db
            .from('supervisor_ai_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
        if (error || !data)
            throw new common_1.NotFoundException(`Session ${sessionId} not found`);
        if (data.supervisor_id !== supervisorIdentifier) {
            throw new common_1.ForbiddenException('無權存取此對話');
        }
        return data;
    }
    async getRecentMessagesForClaude(sessionId) {
        const { data, error } = await this.db
            .from('supervisor_ai_messages')
            .select('role, content, created_at')
            .eq('session_id', sessionId)
            .in('role', ['user', 'assistant'])
            .order('created_at', { ascending: true })
            .limit(this.MESSAGE_HISTORY_LIMIT);
        if (error)
            throw error;
        return (data ?? []).map(m => ({ role: m.role, content: m.content }));
    }
    async buildSystemPrompt(caseId) {
        const caseRow = await this.requireCase(caseId);
        const { data: tagRows } = await this.db
            .from('counseling_state_tags')
            .select('code, label, ai_prompt_hint, severity')
            .in('code', caseRow.state_tag_codes ?? []);
        const { data: execs } = await this.db
            .from('counseling_executions')
            .select('executed_at, actual_method, what_happened, employee_reaction, mood_score, next_action_hint')
            .eq('case_id', caseId)
            .order('executed_at', { ascending: false })
            .limit(this.RECENT_EXECUTIONS_LIMIT);
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
        const tagBlock = (tagRows ?? []).map(t => `- ${t.label} (嚴重度=${t.severity || 'moderate'}) — ${t.ai_prompt_hint || ''}`).join('\n');
        const insightBlock = this.summarizeInsight(caseRow.initial_insight_snapshot?.summary);
        const recentExecBlock = (execs ?? []).length === 0
            ? '(尚無執行紀錄)'
            : (execs ?? []).map((e, i) => `${i + 1}. ${e.executed_at?.slice(0, 10)} [${e.actual_method}] mood=${e.mood_score ?? '-'}\n   經過：${e.what_happened}\n   反應：${e.employee_reaction || '(未填)'}\n   下一步思考：${e.next_action_hint || '(未填)'}`).join('\n\n');
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
    summarizeInsight(summary) {
        if (!summary || typeof summary !== 'object')
            return '(建案當下無 insight 資料)';
        const lines = [];
        if (summary.risk_level)
            lines.push(`風險：${summary.risk_level}`);
        if (summary.stress_level)
            lines.push(`壓力：${summary.stress_level}`);
        if (summary.trend)
            lines.push(`趨勢：${summary.trend}`);
        if (summary.overall_assessment)
            lines.push(`評估：${summary.overall_assessment}`);
        if (Array.isArray(summary.key_concerns) && summary.key_concerns.length) {
            lines.push(`關注：${summary.key_concerns.slice(0, 5).join(' / ')}`);
        }
        return lines.join('\n') || '(insight 為空)';
    }
};
exports.CaseAiService = CaseAiService;
exports.CaseAiService = CaseAiService = CaseAiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        config_1.ConfigService])
], CaseAiService);
//# sourceMappingURL=case-ai.service.js.map