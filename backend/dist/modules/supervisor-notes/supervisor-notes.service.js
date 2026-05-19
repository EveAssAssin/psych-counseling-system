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
var SupervisorNotesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupervisorNotesService = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const supabase_service_1 = require("../supabase/supabase.service");
let SupervisorNotesService = SupervisorNotesService_1 = class SupervisorNotesService {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = new common_1.Logger(SupervisorNotesService_1.name);
    }
    get db() {
        return this.supabase.getAdminClient();
    }
    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }
    async setPassword(supervisorId, password) {
        const hash = this.hashPassword(password);
        const { error } = await this.db
            .from('authorized_supervisors')
            .update({ password_hash: hash, updated_at: new Date().toISOString() })
            .eq('id', supervisorId);
        if (error)
            throw error;
        return { success: true };
    }
    async changeOwnPassword(identifier, currentPassword, newPassword) {
        const verify = await this.verifyLogin(identifier, currentPassword);
        if (!verify.success) {
            return { success: false, message: '目前密碼錯誤' };
        }
        const hash = this.hashPassword(newPassword);
        const { error } = await this.db
            .from('authorized_supervisors')
            .update({ password_hash: hash, updated_at: new Date().toISOString() })
            .eq('identifier', identifier);
        if (error)
            return { success: false, message: '密碼更新失敗' };
        return { success: true, message: '密碼已更新' };
    }
    async isSupervisorAuthorized(identifier) {
        const { data } = await this.db
            .from('authorized_supervisors')
            .select('id')
            .eq('identifier', identifier)
            .eq('is_active', true)
            .single();
        return !!data;
    }
    async verifyLogin(identifier, password) {
        const { data } = await this.db
            .from('authorized_supervisors')
            .select('id, name, role, password_hash')
            .eq('identifier', identifier)
            .eq('is_active', true)
            .limit(1);
        if (!data || data.length === 0)
            return { success: false };
        const sv = data[0];
        if (!sv.password_hash)
            return { success: false };
        const hash = this.hashPassword(password);
        if (hash !== sv.password_hash)
            return { success: false };
        return { success: true, info: { id: sv.id, name: sv.name, role: sv.role } };
    }
    async getSupervisorInfo(identifier) {
        const { data } = await this.db
            .from('authorized_supervisors')
            .select('id, name, role')
            .eq('identifier', identifier)
            .eq('is_active', true)
            .limit(1);
        return data && data.length > 0 ? data[0] : null;
    }
    async isAdmin(identifier) {
        const info = await this.getSupervisorInfo(identifier);
        return info?.role === 'admin';
    }
    async requireAuthorized(identifier) {
        const ok = await this.isSupervisorAuthorized(identifier);
        if (!ok)
            throw new common_1.ForbiddenException('您沒有使用此功能的權限，請聯繫系統管理員。');
    }
    async getSupervisors() {
        const { data, error } = await this.db
            .from('authorized_supervisors')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data;
    }
    async createSupervisor(dto) {
        const { data, error } = await this.db
            .from('authorized_supervisors')
            .insert({ ...dto, is_active: true })
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async updateSupervisor(id, updates) {
        const { data, error } = await this.db
            .from('authorized_supervisors')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async deleteSupervisor(id) {
        const { error } = await this.db
            .from('authorized_supervisors')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error)
            throw error;
        return { success: true };
    }
    async getCategories(supervisorId) {
        let query = this.db
            .from('note_categories')
            .select('*')
            .eq('is_active', true);
        if (supervisorId) {
            query = query.or(`supervisor_id.is.null,supervisor_id.eq.${supervisorId}`);
        }
        else {
            query = query.is('supervisor_id', null);
        }
        const { data, error } = await query.order('sort_order').order('created_at');
        if (error)
            throw error;
        if (!supervisorId || !data)
            return data;
        const { data: svData } = await this.db
            .from('authorized_supervisors')
            .select('category_order')
            .eq('identifier', supervisorId)
            .limit(1);
        const order = svData?.[0]?.category_order || [];
        if (order.length === 0)
            return data;
        const orderMap = {};
        order.forEach((id, i) => { orderMap[id] = i; });
        return [...data].sort((a, b) => {
            const ai = orderMap[a.id] ?? 9999;
            const bi = orderMap[b.id] ?? 9999;
            return ai - bi;
        });
    }
    async updateCategoryOrder(supervisorId, orderedIds) {
        const { error } = await this.db
            .from('authorized_supervisors')
            .update({ category_order: orderedIds, updated_at: new Date().toISOString() })
            .eq('identifier', supervisorId);
        if (error)
            throw error;
        return { success: true };
    }
    async createCategory(dto, createdBy, supervisorId) {
        const { data, error } = await this.db
            .from('note_categories')
            .insert({ ...dto, created_by: createdBy, supervisor_id: supervisorId || null })
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async updateCategory(id, dto) {
        const { data, error } = await this.db
            .from('note_categories')
            .update({ ...dto, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async deleteCategory(id) {
        const { error } = await this.db
            .from('note_categories')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error)
            throw error;
        return { success: true };
    }
    async createNote(dto) {
        await this.requireAuthorized(dto.supervisor_id);
        let category_name = dto.category_name;
        if (dto.category_id && !category_name) {
            const { data: cat } = await this.db
                .from('note_categories')
                .select('name')
                .eq('id', dto.category_id)
                .single();
            category_name = cat?.name;
        }
        const { data, error } = await this.db
            .from('supervisor_notes')
            .insert({ ...dto, category_name, is_deleted: false })
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async getNotes(filters) {
        const page = parseInt(String(filters.page ?? 1), 10) || 1;
        const limit = Math.min(parseInt(String(filters.limit ?? 20), 10) || 20, 100);
        const offset = (page - 1) * limit;
        let query = this.db
            .from('supervisor_notes')
            .select('*, note_categories(name, color)', { count: 'exact' })
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });
        if (filters.supervisor_id)
            query = query.eq('supervisor_id', filters.supervisor_id);
        if (filters.employee_id)
            query = query.eq('employee_id', filters.employee_id);
        if (filters.employee_app_number)
            query = query.eq('employee_app_number', filters.employee_app_number);
        if (filters.category_id)
            query = query.eq('category_id', filters.category_id);
        if (filters.search) {
            query = query.or(`content.ilike.%${filters.search}%,supervisor_name.ilike.%${filters.search}%,non_employee_name.ilike.%${filters.search}%`);
        }
        query = query.range(offset, offset + limit - 1);
        const { data: rawData, error, count } = await query;
        if (error)
            throw error;
        let data = rawData || [];
        const appNumbers = [...new Set(data.filter(n => n.employee_app_number).map(n => n.employee_app_number))];
        if (appNumbers.length > 0) {
            const { data: emps } = await this.db
                .from('employees')
                .select('employeeappnumber, name')
                .in('employeeappnumber', appNumbers);
            const empMap = {};
            (emps || []).forEach((e) => { if (e.employeeappnumber)
                empMap[e.employeeappnumber] = e.name; });
            data = data.map(n => ({ ...n, employee_name: n.employee_app_number ? (empMap[n.employee_app_number] || null) : null }));
        }
        return { data, total: count, page, limit };
    }
    async getNoteById(id) {
        const { data, error } = await this.db
            .from('supervisor_notes')
            .select('*, note_categories(name, color)')
            .eq('id', id)
            .eq('is_deleted', false)
            .single();
        if (error || !data)
            throw new common_1.NotFoundException('找不到該筆記錄');
        return data;
    }
    async updateNote(id, supervisorId, dto) {
        await this.requireAuthorized(supervisorId);
        const note = await this.getNoteById(id);
        const admin = await this.isAdmin(supervisorId);
        if (!admin && note.supervisor_id !== supervisorId) {
            throw new common_1.ForbiddenException('您只能編輯自己的記錄');
        }
        let category_name = dto.category_name;
        if (dto.category_id && !category_name) {
            const { data: cat } = await this.db
                .from('note_categories')
                .select('name')
                .eq('id', dto.category_id)
                .single();
            category_name = cat?.name;
        }
        const { data, error } = await this.db
            .from('supervisor_notes')
            .update({ ...dto, category_name, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async deleteNote(id, supervisorId) {
        await this.requireAuthorized(supervisorId);
        const note = await this.getNoteById(id);
        const admin = await this.isAdmin(supervisorId);
        if (!admin && note.supervisor_id !== supervisorId) {
            throw new common_1.ForbiddenException('您只能刪除自己的記錄');
        }
        const { error } = await this.db
            .from('supervisor_notes')
            .update({ is_deleted: true, deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error)
            throw error;
        return { success: true };
    }
    async searchEmployees(keyword, storeId) {
        let query = this.db
            .from('employees')
            .select('employeeappnumber, name, store_name, title, is_active')
            .eq('is_active', true)
            .limit(30);
        if (storeId) {
            query = query.eq('store_name', storeId);
        }
        if (keyword && keyword.trim().length > 0) {
            query = query.or(`name.ilike.%${keyword}%,employeeappnumber.ilike.%${keyword}%`);
        }
        query = query.order('name', { ascending: true });
        const { data, error } = await query;
        if (error)
            throw error;
        return (data || []).map(e => ({
            app_number: e.employeeappnumber,
            name: e.name,
            store_name: e.store_name,
            position: e.title,
        }));
    }
    async getStores() {
        const { data, error } = await this.db
            .from('employees')
            .select('store_name')
            .eq('is_active', true)
            .not('store_name', 'is', null);
        if (error)
            throw error;
        const stores = [...new Set((data || []).map((e) => e.store_name))].filter(Boolean).sort();
        return stores.map(s => ({ store_name: s }));
    }
    async getConfidentialList() {
        const { data, error } = await this.db
            .from('ai_confidential_list')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data;
    }
    async addToConfidential(dto) {
        const { data, error } = await this.db
            .from('ai_confidential_list')
            .upsert(dto, { onConflict: 'employee_app_number' })
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async removeFromConfidential(id) {
        const { error } = await this.db
            .from('ai_confidential_list')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        return { success: true };
    }
    async isConfidential(employeeAppNumber) {
        const { data } = await this.db
            .from('ai_confidential_list')
            .select('id')
            .eq('employee_app_number', employeeAppNumber)
            .single();
        return !!data;
    }
    async getReviewRecords(filters) {
        const page = parseInt(String(filters.page ?? 1), 10) || 1;
        const limit = Math.min(parseInt(String(filters.limit ?? 20), 10) || 20, 100);
        const offset = (page - 1) * limit;
        let query = this.db
            .from('personnel_review_records')
            .select('*', { count: 'exact' })
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });
        if (filters.employee_app_number)
            query = query.eq('employee_app_number', filters.employee_app_number);
        if (filters.search) {
            query = query.or(`content.ilike.%${filters.search}%,employee_name.ilike.%${filters.search}%`);
        }
        query = query.range(offset, offset + limit - 1);
        const { data, error, count } = await query;
        if (error)
            throw error;
        return { data, total: count, page, limit };
    }
    async createReviewRecord(dto) {
        await this.requireAuthorized(dto.created_by || '');
        const { data, error } = await this.db
            .from('personnel_review_records')
            .insert({ ...dto, is_deleted: false })
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async updateReviewRecord(id, supervisorId, dto) {
        await this.requireAuthorized(supervisorId);
        const { data, error } = await this.db
            .from('personnel_review_records')
            .update({ ...dto, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return data;
    }
    async deleteReviewRecord(id, supervisorId) {
        await this.requireAuthorized(supervisorId);
        const { error } = await this.db
            .from('personnel_review_records')
            .update({ is_deleted: true, deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error)
            throw error;
        return { success: true };
    }
    async getReviewRecordsByEmployee(employeeAppNumber) {
        const { data, error } = await this.db
            .from('personnel_review_records')
            .select('*')
            .eq('employee_app_number', employeeAppNumber)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    async getNotesByEmployee(employeeAppNumber, supervisorId) {
        let query = this.db
            .from('supervisor_notes')
            .select('*, note_categories(name)')
            .eq('employee_app_number', employeeAppNumber)
            .eq('is_deleted', false);
        if (supervisorId) {
            query = query.eq('supervisor_id', supervisorId);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
};
exports.SupervisorNotesService = SupervisorNotesService;
exports.SupervisorNotesService = SupervisorNotesService = SupervisorNotesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], SupervisorNotesService);
//# sourceMappingURL=supervisor-notes.service.js.map