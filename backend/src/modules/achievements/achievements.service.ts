import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAchievementDto, UpdateAchievementDto } from './achievements.dto';

/** 內容是否含數據（半形/全形數字） */
function hasData(text: string): boolean {
  return /[0-9０-９]/.test(text || '');
}

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
    const content = (dto.content || '').trim();
    // 事實防呆：內容需含數據
    if (dto.record_type === '事實' && !hasData(content)) {
      throw new BadRequestException('「事實」需要數據佐證：內容必須包含具體數據（數字）。');
    }
    // 感受：自訂標籤存進字典（可重用）
    if (dto.record_type === '感受' && dto.category) {
      await this.ensureFeelingTag(dto.category);
    }

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
        record_type: dto.record_type,
        title: dto.title,
        content,
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
    const { data: cur } = await this.db.from('achievement_records').select('*').eq('id', id).single();
    if (!cur) throw new NotFoundException('找不到事蹟紀錄');

    const recordType = dto.record_type ?? cur.record_type;
    const content = (dto.content ?? cur.content ?? '').trim();
    if (recordType === '事實' && !hasData(content)) {
      throw new BadRequestException('「事實」需要數據佐證：內容必須包含具體數據（數字）。');
    }
    if (recordType === '感受' && (dto.category ?? cur.category)) {
      await this.ensureFeelingTag((dto.category ?? cur.category) as string);
    }

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (dto.record_type !== undefined) patch.record_type = dto.record_type;
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.content !== undefined) patch.content = content;
    if (dto.record_date !== undefined) patch.record_date = dto.record_date;
    if (dto.category !== undefined) patch.category = dto.category;

    const { data, error } = await this.db
      .from('achievement_records')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message || '更新失敗');
    return data;
  }

  async remove(id: string) {
    const { error } = await this.db.from('achievement_records').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message || '刪除失敗');
    return { success: true };
  }

  // ── 感受標籤字典 ──
  async listFeelingTags() {
    const { data, error } = await this.db
      .from('achievement_feeling_tags')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw new BadRequestException(error.message || '查詢失敗');
    return data ?? [];
  }

  async createFeelingTag(name: string) {
    const clean = (name || '').trim();
    if (!clean) throw new BadRequestException('標籤不可為空白');
    if (clean.length > 20) throw new BadRequestException('標籤不可超過 20 字');
    const existing = await this.db
      .from('achievement_feeling_tags')
      .select('*')
      .eq('name', clean)
      .maybeSingle();
    if (existing.data) return existing.data;
    const { data, error } = await this.db
      .from('achievement_feeling_tags')
      .insert({ name: clean })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message || '新增失敗');
    return data;
  }

  /** 建立事蹟時若感受標籤不存在則自動建入字典 */
  private async ensureFeelingTag(name: string) {
    const clean = (name || '').trim();
    if (!clean) return;
    const { data: exist } = await this.db
      .from('achievement_feeling_tags')
      .select('id')
      .eq('name', clean)
      .maybeSingle();
    if (exist) return;
    await this.db.from('achievement_feeling_tags').insert({ name: clean });
  }
}
