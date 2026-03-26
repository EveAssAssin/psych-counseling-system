import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface Store {
  id: string;
  store_code?: string;
  store_erp_id?: string;
  name: string;
  region?: string;
  address?: string;
  is_active: boolean;
  source_payload?: Record<string, any>;
  synced_at?: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);
  private readonly TABLE = 'stores';

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(): Promise<Store[]> {
    return this.supabase.findMany<Store>(this.TABLE, {
      filters: { is_active: true },
      orderBy: { column: 'name', ascending: true },
      useAdmin: true,
    });
  }

  async findById(id: string): Promise<Store | null> {
    return this.supabase.findOne<Store>(this.TABLE, { id }, { useAdmin: true });
  }

  async findByCode(store_code: string): Promise<Store | null> {
    return this.supabase.findOne<Store>(this.TABLE, { store_code }, { useAdmin: true });
  }

  async upsert(data: Partial<Store>): Promise<Store> {
    return this.supabase.upsert<Store>(this.TABLE, data, {
      onConflict: 'store_code',
      useAdmin: true,
    });
  }

  async upsertByErpId(data: Partial<Store>): Promise<Store> {
    // 先檢查是否已存在
    const existing = await this.supabase.findOne<Store>(
      this.TABLE,
      { store_erp_id: data.store_erp_id },
      { useAdmin: true },
    );

    if (existing) {
      // 更新現有記錄
      const updated = await this.supabase.update<Store>(
        this.TABLE,
        { id: existing.id },
        {
          ...data,
          synced_at: new Date().toISOString(),
        },
        { useAdmin: true },
      );
      return updated || existing;
    } else {
      // 建立新記錄
      return this.supabase.create<Store>(
        this.TABLE,
        {
          ...data,
          synced_at: new Date().toISOString(),
        },
        { useAdmin: true },
      );
    }
  }
}
