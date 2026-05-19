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
var PermissionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsService = exports.APP_ROLE_LABELS = exports.APP_ROLES = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
const employees_service_1 = require("../employees/employees.service");
exports.APP_ROLES = ['admin', 'counselor'];
exports.APP_ROLE_LABELS = {
    admin: '超級管理者',
    counselor: '輔導人員',
};
let PermissionsService = PermissionsService_1 = class PermissionsService {
    constructor(supabase, employeesService) {
        this.supabase = supabase;
        this.employeesService = employeesService;
        this.logger = new common_1.Logger(PermissionsService_1.name);
    }
    async list(options) {
        const client = this.supabase.getAdminClient();
        let rolesQuery = client
            .from('user_roles')
            .select('*')
            .in('role', exports.APP_ROLES)
            .order('created_at', { ascending: false });
        if (options?.onlyActive) {
            rolesQuery = rolesQuery.eq('is_active', true);
        }
        if (options?.role) {
            rolesQuery = rolesQuery.eq('role', options.role);
        }
        const { data: roles, error: rolesErr } = await rolesQuery;
        if (rolesErr) {
            this.logger.error(`Failed to list user_roles: ${rolesErr.message}`);
            throw new common_1.BadRequestException(`查詢失敗：${rolesErr.message}`);
        }
        if (!roles || roles.length === 0)
            return [];
        const userIds = [...new Set(roles.map((r) => r.user_id))];
        const { data: users } = await client.from('users').select('*').in('id', userIds);
        const userMap = new Map((users || []).map((u) => [u.id, u]));
        const employeeIds = [...new Set((users || []).map((u) => u.employee_id).filter(Boolean))];
        const employeeMap = new Map();
        if (employeeIds.length > 0) {
            const { data: employees } = await client.from('employees').select('*').in('id', employeeIds);
            for (const e of employees || []) {
                employeeMap.set(e.id, e);
            }
        }
        const records = roles.map((r) => {
            const u = userMap.get(r.user_id) || {};
            const e = u.employee_id ? employeeMap.get(u.employee_id) : null;
            return {
                user_role_id: r.id,
                user_id: r.user_id,
                email: u.email ?? null,
                user_name: u.name ?? null,
                user_is_active: u.is_active ?? false,
                last_login_at: u.last_login_at ?? null,
                employee_id: e?.id ?? null,
                app_number: e?.employeeappnumber ?? null,
                erp_id: e?.employeeerpid ?? null,
                employee_name: e?.name ?? null,
                department: e?.department ?? null,
                store_name: e?.store_name ?? null,
                title: e?.title ?? null,
                employee_is_active: e?.is_active ?? null,
                role: r.role,
                scope_type: r.scope_type ?? null,
                scope_value: r.scope_value ?? null,
                granted_by: r.granted_by ?? null,
                role_is_active: r.is_active ?? false,
                granted_at: r.created_at,
                expires_at: r.expires_at ?? null,
            };
        });
        return records;
    }
    async grant(params, grantedBy) {
        if (!exports.APP_ROLES.includes(params.role)) {
            throw new common_1.BadRequestException(`不支援的角色：${params.role}（允許值：${exports.APP_ROLES.join(', ')}）`);
        }
        const employee = await this.employeesService.findByAppNumber(params.app_number);
        if (!employee) {
            throw new common_1.NotFoundException(`找不到員工編號「${params.app_number}」`);
        }
        const client = this.supabase.getAdminClient();
        let userId;
        const { data: existingUser } = await client
            .from('users')
            .select('id, is_active')
            .eq('employee_id', employee.id)
            .limit(1)
            .maybeSingle();
        if (existingUser) {
            userId = existingUser.id;
            if (!existingUser.is_active) {
                await client.from('users').update({ is_active: true }).eq('id', userId);
            }
        }
        else {
            const dummyEmail = `${params.app_number}@psych.internal`;
            const { data: newUser, error: userErr } = await client
                .from('users')
                .insert({
                email: dummyEmail,
                name: employee.name,
                employee_id: employee.id,
                is_active: true,
            })
                .select('id')
                .single();
            if (userErr) {
                if (userErr.code === '23505') {
                    const { data: retry } = await client
                        .from('users')
                        .select('id')
                        .eq('email', dummyEmail)
                        .single();
                    if (retry) {
                        userId = retry.id;
                    }
                    else {
                        throw new common_1.ConflictException(`建立使用者失敗：${userErr.message}`);
                    }
                }
                else {
                    throw new common_1.BadRequestException(`建立使用者失敗：${userErr.message}`);
                }
            }
            else {
                userId = newUser.id;
            }
        }
        const scopeType = params.scope_type ?? 'all';
        const { data: existingRole } = await client
            .from('user_roles')
            .select('id, is_active')
            .eq('user_id', userId)
            .eq('role', params.role)
            .eq('scope_type', scopeType)
            .limit(1)
            .maybeSingle();
        let userRoleId;
        if (existingRole) {
            const { error } = await client
                .from('user_roles')
                .update({
                is_active: true,
                scope_value: params.scope_value,
                granted_by: grantedBy,
            })
                .eq('id', existingRole.id);
            if (error)
                throw new common_1.BadRequestException(`更新角色失敗：${error.message}`);
            userRoleId = existingRole.id;
        }
        else {
            const { data: newRole, error } = await client
                .from('user_roles')
                .insert({
                user_id: userId,
                role: params.role,
                scope_type: scopeType,
                scope_value: params.scope_value,
                granted_by: grantedBy,
                is_active: true,
            })
                .select('id')
                .single();
            if (error)
                throw new common_1.BadRequestException(`新增角色失敗：${error.message}`);
            userRoleId = newRole.id;
        }
        this.logger.log(`Granted role '${params.role}' to ${employee.name} (${params.app_number}) by ${grantedBy || 'system'}`);
        const list = await this.list();
        const rec = list.find((r) => r.user_role_id === userRoleId);
        if (!rec) {
            throw new common_1.NotFoundException('指派完成但找不到對應記錄');
        }
        return rec;
    }
    async update(userRoleId, updates) {
        if (updates.role && !exports.APP_ROLES.includes(updates.role)) {
            throw new common_1.BadRequestException(`不支援的角色：${updates.role}`);
        }
        const client = this.supabase.getAdminClient();
        const { error } = await client.from('user_roles').update(updates).eq('id', userRoleId);
        if (error)
            throw new common_1.BadRequestException(`更新失敗：${error.message}`);
        const list = await this.list();
        const rec = list.find((r) => r.user_role_id === userRoleId);
        if (!rec)
            throw new common_1.NotFoundException('找不到該權限記錄');
        return rec;
    }
    async revoke(userRoleId) {
        const client = this.supabase.getAdminClient();
        const { error } = await client.from('user_roles').update({ is_active: false }).eq('id', userRoleId);
        if (error)
            throw new common_1.BadRequestException(`撤銷失敗：${error.message}`);
        this.logger.log(`Revoked user_role ${userRoleId}`);
        return { success: true };
    }
    getAvailableRoles() {
        return exports.APP_ROLES.map((r) => ({ value: r, label: exports.APP_ROLE_LABELS[r] }));
    }
};
exports.PermissionsService = PermissionsService;
exports.PermissionsService = PermissionsService = PermissionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        employees_service_1.EmployeesService])
], PermissionsService);
//# sourceMappingURL=permissions.service.js.map