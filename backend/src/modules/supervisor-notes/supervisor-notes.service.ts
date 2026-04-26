import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateNoteDto, UpdateNoteDto,
  CreateCategoryDto, UpdateCategoryDto,
  CreateSupervisorDto, AddConfidentialDto,
} from './supervisor-notes.dto';

@Injectable()
export class SupervisorNotesService {
  private readonly logger = new Logger(SupervisorNotesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.getAdminClient();
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  async setPassword(supervisorId: string, password: string) {
    const hash = this.hashPassword(password);
    const { error } = await this.db
      .from('authorized_supervisors')
      .update({ password_hash: hash, updated_at: new Date().toISOString() })
      .eq('id', supervisorId);
    if (error) throw error;
    return { success: true };
  }

  // ═══════════════════════════════════════════
  //  主管驗證
  // ═══════════════════════════════════════════

  async isSupervisorAuthorized(identifier: string): Promise<boolean> {
    const { data } = await this.db
      .from('authorized_supervisors')
      .select('id')
      .eq('identifier', identifier)
      .eq('is_active', true)
      .single();
    return !!data;
  }

  async verifyLogin(identifier: string, password: string): Promise<{ success: boolean; info?: { id: string; name: string; role: string } }> {
    const { data } = await this.db
      .from('authorized_supervisors')
      .select('id, name, role, password_hash')
      .eq('identifier', identifier)
      .eq('is_active', true)
      .limit(1);
    if (!data || data.length === 0) return { success: false };
    const sv = data[0];
    if (!sv.password_hash) return { success: false };
    const hash = this.hashPassword(password);
    if (hash !== sv.password_hash) return { success: false };
    return { success: true, info: { id: sv.id, name: sv.name, role: sv.role } };
  }

  async getSupervisorInfo(identifier: string): Promise<{ id: string; name: string; role: string } | null> {
    const { data } = await this.db
      .from('authorized_supervisors')
      .select('id, name, role')
      .eq('identifier', identifier)
      .eq('is_active', true)
      .limit(1);
    return data && data.length > 0 ? data[0] : null;
  }

  async isAdmin(identifier: string): Promise<boolean> {
    const info = await this.getSupervisorInfo(identifier);
    return info?.role === 'admin';
  }

  async requireAuthorized(identifier: string) {
    const ok = await this.isSupervisorAuthorized(identifier);
    if (!ok) throw new ForbiddenException('您沒有使用此功能的權限，請聯繫系統管理員。');
  }

  // ═══════════════════════════════════════════
  //  有權主管 CRUD
  // ═══════════════════════════════════════════

  async getSupervisors() {
    const { data, error } = await this.db
      .from('authorized_supervisors')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async createSupervisor(dto: CreateSupervisorDto) {
    const { data, error } = await this.db
      .from('authorized_supervisors')
      .insert({ ...dto, is_active: true })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateSupervisor(id: string, updates: Partial<CreateSupervisorDto> & { is_active?: boolean }) {
    const { data, error } = await this.db
      .from('authorized_supervisors')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteSupervisor(id: string) {
    const { error } = await this.db
      .from('authorized_supervisors')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  }

  // ═══════════════════════════════════════════
  //  紀錄分類 CRUD
  // ═══════════════════════════════════════════

  async getCategories() {
    const { data, error } = await this.db
      .from('note_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data;
  }

  async createCategory(dto: CreateCategoryDto, createdBy?: string) {
    const { data, error } = await this.db
      .from('note_categories')
      .insert({ ...dto, created_by: createdBy })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const { data, error } = await this.db
      .from('note_categories')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteCategory(id: string) {
    const { error } = await this.db
      .from('note_categories')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  }

  // ═══════════════════════════════════════════
  //  隨手記 CRUD
  // ═══════════════════════════════════════════

  async createNote(dto: CreateNoteDto) {
    await this.requireAuthorized(dto.supervisor_id);

    // 若提供 category_id，自動抓分類名稱 snapshot
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
    if (error) throw error;
    return data;
  }

  async getNotes(filters: {
    supervisor_id?: string;
    employee_id?: string;
    employee_app_number?: string;
    search?: string;
    category_id?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    let query = this.db
      .from('supervisor_notes')
      .select('*, note_categories(name, color)', { count: 'exact' })
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters.supervisor_id) query = query.eq('supervisor_id', filters.supervisor_id);
    if (filters.employee_id)   query = query.eq('employee_id', filters.employee_id);
    if (filters.employee_app_number) query = query.eq('employee_app_number', filters.employee_app_number);
    if (filters.category_id)   query = query.eq('category_id', filters.category_id);
    if (filters.search) {
      query = query.or(
        `content.ilike.%${filters.search}%,supervisor_name.ilike.%${filters.search}%,non_employee_name.ilike.%${filters.search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { data, total: count, page, limit };
  }

  async getNoteById(id: string) {
    const { data, error } = await this.db
      .from('supervisor_notes')
      .select('*, note_categories(name, color)')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();
    if (error || !data) throw new NotFoundException('找不到該筆記錄');
    return data;
  }

  async updateNote(id: string, supervisorId: string, dto: UpdateNoteDto) {
    await this.requireAuthorized(supervisorId);

    // 確認這筆記錄屬於該主管（admin 可跨主管編輯）
    const note = await this.getNoteById(id);
    const admin = await this.isAdmin(supervisorId);
    if (!admin && note.supervisor_id !== supervisorId) {
      throw new ForbiddenException('您只能編輯自己的記錄');
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
    if (error) throw error;
    return data;
  }

  async deleteNote(id: string, supervisorId: string) {
    await this.requireAuthorized(supervisorId);

    const note = await this.getNoteById(id);
    const admin = await this.isAdmin(supervisorId);
    if (!admin && note.supervisor_id !== supervisorId) {
      throw new ForbiddenException('您只能刪除自己的記錄');
    }

    const { error } = await this.db
      .from('supervisor_notes')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  }

  // 搜尋人員（從 employees_cache 表）
  async searchEmployees(keyword: string, storeId?: string) {
    let query = this.db
      .from('employees_cache')
      .select('app_number, name, store_name, position, status')
      .eq('status', 'active')
      .limit(20);

    if (storeId) {
      query = query.eq('store_id', storeId);
    } else if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,app_number.ilike.%${keyword}%`);
    }

    const { data, error } = await query;
    if (error) {
      // fallback to employees table
      let q2 = this.db
        .from('employees')
        .select('id, app_number, name, store_name, position')
        .limit(20);
      if (keyword) q2 = q2.or(`name.ilike.%${keyword}%,app_number.ilike.%${keyword}%`);
      const { data: d2, error: e2 } = await q2;
      if (e2) throw e2;
      return d2;
    }
    return data;
  }

  // 取得店家清單
  async getStores() {
    const { data, error } = await this.db
      .from('employees_cache')
      .select('store_id, store_name')
      .eq('status', 'active')
      .not('store_name', 'is', null);
    if (error) {
      const { data: d2 } = await this.db
        .from('employees')
        .select('store_name')
        .not('store_name', 'is', null);
      const stores = [...new Set((d2 || []).map(e => e.store_name))].filter(Boolean);
      return stores.map(s => ({ store_name: s }));
    }
    const unique: Record<string, any> = {};
    (data || []).forEach(e => {
      if (e.store_id && !unique[e.store_id]) unique[e.store_id] = e;
    });
    return Object.values(unique);
  }

  // ═══════════════════════════════════════════
  //  AI 機密名單
  // ═══════════════════════════════════════════

  async getConfidentialList() {
    const { data, error } = await this.db
      .from('ai_confidential_list')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async addToConfidential(dto: AddConfidentialDto) {
    const { data, error } = await this.db
      .from('ai_confidential_list')
      .upsert(dto, { onConflict: 'employee_app_number' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async removeFromConfidential(id: string) {
    const { error } = await this.db
      .from('ai_confidential_list')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  }

  async isConfidential(employeeAppNumber: string): Promise<boolean> {
    const { data } = await this.db
      .from('ai_confidential_list')
      .select('id')
      .eq('employee_app_number', employeeAppNumber)
      .single();
    return !!data;
  }

  // ═══════════════════════════════════════════
  //  取得某人員的所有隨手記（供 AI 分析使用）
  // ═══════════════════════════════════════════

  async getNotesByEmployee(employeeAppNumber: string) {
    const { data, error } = await this.db
      .from('supervisor_notes')
      .select('*, note_categories(name)')
      .eq('employee_app_number', employeeAppNumber)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
}
