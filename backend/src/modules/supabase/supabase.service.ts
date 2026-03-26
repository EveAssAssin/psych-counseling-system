import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;
  private supabaseAdmin: SupabaseClient;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('supabase.url');
    const anonKey = this.configService.get<string>('supabase.anonKey');
    const serviceRoleKey = this.configService.get<string>('supabase.serviceRoleKey');

    if (!url || !anonKey) {
      throw new Error('Supabase URL and anon key are required');
    }

    // 一般客戶端（使用 anon key，受 RLS 限制）
    this.supabase = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
    });

    // 管理員客戶端（使用 service role key，繞過 RLS）
    if (serviceRoleKey) {
      this.supabaseAdmin = createClient(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      this.logger.log('Supabase admin client initialized');
    } else {
      this.logger.warn('Supabase service role key not provided, using anon key for admin operations');
      this.supabaseAdmin = this.supabase;
    }

    this.logger.log('Supabase client initialized');
  }

  /**
   * 取得一般 Supabase 客戶端
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * 取得管理員 Supabase 客戶端（繞過 RLS）
   */
  getAdminClient(): SupabaseClient {
    return this.supabaseAdmin;
  }

  // ============================================
  // 通用查詢方法
  // ============================================

  /**
   * 取得單一記錄
   */
  async findOne<T>(
    table: string,
    filters: Record<string, any>,
    options?: { select?: string; useAdmin?: boolean },
  ): Promise<T | null> {
    const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;
    const select = options?.select || '*';

    let query = client.from(table).select(select);

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Error finding ${table}:`, error);
      throw error;
    }

    return data as T | null;
  }

  /**
   * 取得多筆記錄
   */
  async findMany<T>(
    table: string,
    options?: {
      filters?: Record<string, any>;
      select?: string;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      offset?: number;
      useAdmin?: boolean;
    },
  ): Promise<T[]> {
    const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;
    const select = options?.select || '*';

    let query = client.from(table).select(select);

    // 套用篩選
    if (options?.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    // 排序
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }

    // 分頁
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Error finding many ${table}:`, error);
      throw error;
    }

    return (data || []) as T[];
  }

  /**
   * 建立記錄
   */
  async create<T>(
    table: string,
    data: Partial<T>,
    options?: { useAdmin?: boolean; returning?: string },
  ): Promise<T> {
    const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;

    const { data: created, error } = await client
      .from(table)
      .insert(data)
      .select(options?.returning || '*')
      .single();

    if (error) {
      this.logger.error(`Error creating ${table}:`, error);
      throw error;
    }

    return created as T;
  }

  /**
   * 批量建立
   */
  async createMany<T>(
    table: string,
    records: Partial<T>[],
    options?: { useAdmin?: boolean; onConflict?: string },
  ): Promise<T[]> {
    const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;

    let query;
    
    if (options?.onConflict) {
      query = client.from(table).upsert(records, { onConflict: options.onConflict });
    } else {
      query = client.from(table).insert(records);
    }

    const { data, error } = await query.select();

    if (error) {
      this.logger.error(`Error creating many ${table}:`, error);
      throw error;
    }

    return (data || []) as T[];
  }

  /**
   * 更新記錄
   */
  async update<T>(
    table: string,
    filters: Record<string, any>,
    data: Partial<T>,
    options?: { useAdmin?: boolean },
  ): Promise<T | null> {
    const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;

    let query = client.from(table).update(data);

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data: updated, error } = await query.select().single();

    if (error) {
      this.logger.error(`Error updating ${table}:`, error);
      throw error;
    }

    return updated as T;
  }

  /**
   * Upsert（存在則更新，不存在則建立）
   */
  async upsert<T>(
    table: string,
    data: Partial<T>,
    options?: { onConflict: string; useAdmin?: boolean },
  ): Promise<T> {
    const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;

    const { data: upserted, error } = await client
      .from(table)
      .upsert(data, { onConflict: options?.onConflict })
      .select()
      .single();

    if (error) {
      this.logger.error(`Error upserting ${table}:`, error);
      throw error;
    }

    return upserted as T;
  }

  /**
   * 刪除記錄
   */
  async delete(
    table: string,
    filters: Record<string, any>,
    options?: { useAdmin?: boolean },
  ): Promise<void> {
    const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;

    let query = client.from(table).delete();

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { error } = await query;

    if (error) {
      this.logger.error(`Error deleting ${table}:`, error);
      throw error;
    }
  }

  /**
   * 計數
   */
  async count(
    table: string,
    filters?: Record<string, any>,
    options?: { useAdmin?: boolean },
  ): Promise<number> {
    const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;

    let query = client.from(table).select('*', { count: 'exact', head: true });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    const { count, error } = await query;

    if (error) {
      this.logger.error(`Error counting ${table}:`, error);
      throw error;
    }

    return count || 0;
  }

  // ============================================
  // Storage 方法
  // ============================================

  /**
   * 上傳檔案
   */
  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<string> {
    const { data, error } = await this.supabaseAdmin.storage
      .from(bucket)
      .upload(path, file, {
        contentType: options?.contentType,
        upsert: options?.upsert ?? false,
      });

    if (error) {
      this.logger.error(`Error uploading file to ${bucket}/${path}:`, error);
      throw error;
    }

    return data.path;
  }

  /**
   * 取得檔案公開 URL
   */
  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * 取得簽名 URL（私有檔案）
   */
  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      this.logger.error(`Error getting signed URL:`, error);
      throw error;
    }

    return data.signedUrl;
  }

  /**
   * 刪除檔案
   */
  async deleteFile(bucket: string, paths: string[]): Promise<void> {
    const { error } = await this.supabaseAdmin.storage.from(bucket).remove(paths);

    if (error) {
      this.logger.error(`Error deleting files:`, error);
      throw error;
    }
  }
}
