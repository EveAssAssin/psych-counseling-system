import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface OfficialChannelMessage {
  id: string;
  source_record_id: string;
  source_system: string;
  employee_id: string;
  employee_app_number: string;
  employee_erp_id: string;
  employee_name: string;
  group_name: string;
  channel: string;
  thread_id: string;
  direction: string;
  message_time: string;
  message_text: string;
  message_type: string;
  ticket_no?: string;
  author_name?: string;
  author_role?: string;
  agent_type: string;
  source_updated_at: string;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class OfficialChannelService {
  private readonly logger = new Logger(OfficialChannelService.name);
  private readonly TABLE = 'official_channel_messages';

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 依員工 ID 取得官方頻道訊息
   */
  async getByEmployeeId(employeeId: string, limit: number = 50): Promise<OfficialChannelMessage[]> {
    return this.supabase.findMany<OfficialChannelMessage>(this.TABLE, {
      filters: { employee_id: employeeId },
      orderBy: { column: 'message_time', ascending: false },
      limit,
      useAdmin: true,
    });
  }

  /**
   * 依員工 APP Number 取得官方頻道訊息
   */
  async getByEmployeeAppNumber(appNumber: string, limit: number = 50): Promise<OfficialChannelMessage[]> {
    return this.supabase.findMany<OfficialChannelMessage>(this.TABLE, {
      filters: { employee_app_number: appNumber },
      orderBy: { column: 'message_time', ascending: false },
      limit,
      useAdmin: true,
    });
  }

  /**
   * 搜尋訊息
   */
  async search(params: {
    employee_id?: string;
    employee_app_number?: string;
    channel?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: OfficialChannelMessage[]; total: number }> {
    const filters: Record<string, any> = {};
    
    if (params.employee_id) filters.employee_id = params.employee_id;
    if (params.employee_app_number) filters.employee_app_number = params.employee_app_number;
    if (params.channel) filters.channel = params.channel;

    const data = await this.supabase.findMany<OfficialChannelMessage>(this.TABLE, {
      filters,
      orderBy: { column: 'message_time', ascending: false },
      limit: params.limit || 50,
      offset: params.offset || 0,
      useAdmin: true,
    });

    // 簡化：假設總數等於取得的數量（實際應該用 count 查詢）
    return { data, total: data.length };
  }

  /**
   * 取得單一訊息
   */
  async getById(id: string): Promise<OfficialChannelMessage | null> {
    return this.supabase.findOne<OfficialChannelMessage>(this.TABLE, { id }, { useAdmin: true });
  }

  /**
   * 取得統計資料
   */
  async getStats(): Promise<{
    total: number;
    by_channel: Record<string, number>;
    recent_count: number;
  }> {
    const allMessages = await this.supabase.findMany<OfficialChannelMessage>(this.TABLE, {
      useAdmin: true,
    });

    const byChannel: Record<string, number> = {};
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let recentCount = 0;

    for (const msg of allMessages) {
      byChannel[msg.channel] = (byChannel[msg.channel] || 0) + 1;
      if (new Date(msg.message_time) > sevenDaysAgo) {
        recentCount++;
      }
    }

    return {
      total: allMessages.length,
      by_channel: byChannel,
      recent_count: recentCount,
    };
  }
}
