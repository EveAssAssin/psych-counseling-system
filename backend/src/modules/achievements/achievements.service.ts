import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAchievementDto, UpdateAchievementDto } from './achievements.dto';

@Injectable()
export class AchievementsService {
  constructor(private readonly supabase: SupabaseService) {}
  private get db() { return this.supabase.getAdminClient(); }

  /** 列出某員工的事蹟紀錄（新到舊） */
  async listByEmployee(employeeId: string) {
    if (!employeeId) throw new BadRequestException('缺少 employee_id');
    const { data, error } = await this.db
      .from('achievement_records')
      .select('*')
      .eq('employee_id', employeeId)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message || '查詢失敗');
    return data ?? [];
  }

  async create(dto: CreateAchievementDto) {
    // 冗餘帶入員工顯示欄位
    const { data: emp } = await this.db
      .from('employees')
      .select('employeeappnumber, name')
      .eq('id', dto.employee_id)
      .single();

    const { data, error } = await this.db
      .from('achievement_records')
      .insert({
        employee_id: dto.employee_id,
        employee_app_number: emp?.employeeappnumber || null,
        employee_name: emp?.name || null,
        title: dto.title,
        content: dto.content,
        record_date: dto.record_date,
        category: dto.category || null,
        created_by: dto.created_by || null,
      })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message || '建立失敗');
    return data;
  }

  async update(id: string, dto: UpdateAchievementDto) {
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.content !== undefined) patch.content = dto.content;
    if (dto.record_date !== undefined) patch.record_date = dto.record_date;
    if (dto.category !== undefined) patch.category = dto.category;

    const { data, error } = await this.db
      .from('achievement_records')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message || '更新失敗');
    if (!data) throw new NotFoundException('找不到事蹟紀錄');
    return data;
  }

  async remove(id: string) {
    const { error } = await this.db.from('achievement_records').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message || '刪除失敗');
    return { success: true };
  }
}
