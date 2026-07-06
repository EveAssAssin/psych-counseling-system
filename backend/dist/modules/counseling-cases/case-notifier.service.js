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
var CaseNotifierService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseNotifierService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const axios_1 = require("axios");
const supabase_service_1 = require("../supabase/supabase.service");
let CaseNotifierService = CaseNotifierService_1 = class CaseNotifierService {
    constructor(supabase, config) {
        this.supabase = supabase;
        this.config = config;
        this.logger = new common_1.Logger(CaseNotifierService_1.name);
        this.LINE_PUSH_API = 'https://api.line.me/v2/bot/message/push';
    }
    get db() { return this.supabase.getAdminClient(); }
    get lineToken() {
        return this.config.get('LINE_CHANNEL_ACCESS_TOKEN');
    }
    async dailyMorningPush() {
        this.logger.log('[Cron] 開始推送今日輔導排程...');
        try {
            const result = await this.pushTodayTasksToAll();
            this.logger.log(`[Cron] 推送完成：sent=${result.sent}, skipped=${result.skipped}, failed=${result.failed}`);
        }
        catch (err) {
            this.logger.error(`[Cron] 推送失敗：${err?.message}`, err?.stack);
        }
    }
    async bindLineUserId(identifier, lineUserId) {
        if (!lineUserId || !lineUserId.startsWith('U') || lineUserId.length < 30) {
            throw new common_1.BadRequestException('LINE userId 格式不正確（應為 U 開頭的長字串）');
        }
        const { data: updated, error: updErr } = await this.db
            .from('authorized_supervisors')
            .update({ line_user_id: lineUserId, updated_at: new Date().toISOString() })
            .eq('identifier', identifier)
            .select('id, identifier, name, line_user_id, role, is_active')
            .maybeSingle();
        if (updErr)
            throw updErr;
        if (updated)
            return updated;
        const { data: emp } = await this.db
            .from('employees')
            .select('name, employeeappnumber')
            .eq('employeeappnumber', identifier)
            .maybeSingle();
        if (!emp) {
            throw new common_1.NotFoundException(`員工 ${identifier} 不存在，無法綁定`);
        }
        const { data: inserted, error: insErr } = await this.db
            .from('authorized_supervisors')
            .insert({
            identifier,
            name: emp.name,
            role: 'counselor',
            is_active: true,
            line_user_id: lineUserId,
        })
            .select('id, identifier, name, line_user_id, role, is_active')
            .single();
        if (insErr)
            throw insErr;
        this.logger.log(`Auto-created authorized_supervisor for ${identifier} (${emp.name}) with LINE binding`);
        return inserted;
    }
    async unbindLineUserId(identifier) {
        const { data, error } = await this.db
            .from('authorized_supervisors')
            .update({ line_user_id: null, updated_at: new Date().toISOString() })
            .eq('identifier', identifier)
            .select('id, identifier, name')
            .single();
        if (error || !data)
            throw new common_1.NotFoundException(`找不到輔導員 ${identifier}`);
        return data;
    }
    async pushTodayTasksToAll() {
        if (!this.lineToken) {
            this.logger.warn('LINE_CHANNEL_ACCESS_TOKEN 未設定，跳過推播');
            return { sent: 0, skipped: 0, failed: 0, details: [{ reason: 'no_token' }] };
        }
        const { data: supervisors, error } = await this.db
            .from('authorized_supervisors')
            .select('id, identifier, name, line_user_id')
            .eq('is_active', true)
            .not('line_user_id', 'is', null);
        if (error)
            throw error;
        let sent = 0, skipped = 0, failed = 0;
        const details = [];
        for (const sup of supervisors ?? []) {
            try {
                const res = await this.pushTodayTasksToSupervisor(sup.id);
                if (res.pushed)
                    sent++;
                else
                    skipped++;
                details.push({ supervisor_id: sup.id, name: sup.name, ...res });
            }
            catch (err) {
                failed++;
                details.push({ supervisor_id: sup.id, name: sup.name, error: err?.message });
                this.logger.warn(`Push to ${sup.identifier} failed: ${err?.message}`);
            }
        }
        return { sent, skipped, failed, details };
    }
    async pushTodayTasksToSupervisor(supervisorId) {
        const { data: sup } = await this.db
            .from('authorized_supervisors')
            .select('id, identifier, name, line_user_id, is_active')
            .eq('id', supervisorId)
            .single();
        if (!sup)
            return { pushed: false, reason: 'supervisor_not_found' };
        if (!sup.is_active)
            return { pushed: false, reason: 'supervisor_inactive' };
        if (!sup.line_user_id)
            return { pushed: false, reason: 'no_line_binding' };
        const today = this.todayInTaipei();
        const { data: todayTasks } = await this.db
            .from('v_counseling_today').select('*')
            .eq('supervisor_id', supervisorId)
            .eq('scheduled_date', today)
            .order('case_id').order('sequence');
        const { data: overdueTasks } = await this.db
            .from('v_counseling_today').select('*')
            .eq('supervisor_id', supervisorId)
            .lt('scheduled_date', today);
        const todayCount = todayTasks?.length ?? 0;
        const overdueCount = overdueTasks?.length ?? 0;
        if (todayCount === 0 && overdueCount === 0) {
            return { pushed: false, reason: 'no_tasks', today_count: 0, overdue_count: 0 };
        }
        const message = this.buildMessage(sup.name, today, todayTasks ?? [], overdueTasks ?? []);
        await this.pushLineText(sup.line_user_id, message);
        return { pushed: true, today_count: todayCount, overdue_count: overdueCount };
    }
    buildMessage(supervisorName, today, todayTasks, overdueTasks) {
        const methodLabel = {
            phone: '電話',
            face_to_face: '面談',
            line_text: 'LINE 文字',
            observation: '實地觀察',
            group: '小組',
            written: '書面',
        };
        const lines = [];
        lines.push(`🗓 ${supervisorName} 的今日輔導排程`);
        lines.push(`📅 ${today}`);
        lines.push('');
        if (todayTasks.length > 0) {
            lines.push(`【今日 ${todayTasks.length} 項】`);
            const byCase = new Map();
            for (const t of todayTasks) {
                const key = t.case_id;
                if (!byCase.has(key))
                    byCase.set(key, []);
                byCase.get(key).push(t);
            }
            let idx = 1;
            for (const [, tasks] of byCase) {
                const first = tasks[0];
                lines.push(`${idx}. ${first.employee_name}`);
                lines.push(`   目標：${this.truncate(first.case_goal, 40)}`);
                for (const t of tasks) {
                    const m = methodLabel[t.method] || t.method;
                    lines.push(`   • [${m}] ${this.truncate(t.objective, 50)}`);
                }
                idx++;
            }
        }
        else {
            lines.push('【今日】無排定任務');
        }
        if (overdueTasks.length > 0) {
            lines.push('');
            lines.push(`⚠️ 過期未完成：${overdueTasks.length} 項`);
            for (const t of overdueTasks.slice(0, 3)) {
                const m = methodLabel[t.method] || t.method;
                lines.push(`  ${t.scheduled_date} ${t.employee_name} [${m}]`);
            }
            if (overdueTasks.length > 3) {
                lines.push(`  ... 還有 ${overdueTasks.length - 3} 項`);
            }
        }
        lines.push('');
        lines.push('—— 樂活心理輔導系統');
        return lines.join('\n');
    }
    truncate(s, n) {
        if (!s)
            return '';
        return s.length <= n ? s : s.slice(0, n - 1) + '…';
    }
    todayInTaipei() {
        const tw = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
        const y = tw.getFullYear();
        const m = String(tw.getMonth() + 1).padStart(2, '0');
        const d = String(tw.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    async pushLineText(userId, text) {
        const token = this.lineToken;
        if (!token)
            throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured');
        const safeText = text.length > 4900 ? text.slice(0, 4900) + '\n…(訊息過長已截斷)' : text;
        await axios_1.default.post(this.LINE_PUSH_API, {
            to: userId,
            messages: [{ type: 'text', text: safeText }],
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
    }
};
exports.CaseNotifierService = CaseNotifierService;
__decorate([
    (0, schedule_1.Cron)('30 8 * * 1-5', { timeZone: 'Asia/Taipei' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CaseNotifierService.prototype, "dailyMorningPush", null);
exports.CaseNotifierService = CaseNotifierService = CaseNotifierService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        config_1.ConfigService])
], CaseNotifierService);
//# sourceMappingURL=case-notifier.service.js.map