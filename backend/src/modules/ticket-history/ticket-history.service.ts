import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface TicketHistory {
  id: string;
  ticket_id: number;
  ticket_no: string;
  employee_id: string;
  employee_app_number: string;
  employee_erp_id: string;
  employee_name: string;
  store_name: string;
  issue_title: string;
  issue_desc: string;
  category: string;
  parent_category: string;
  sub_category: string;
  status: string;
  review_status: string;
  priority: string;
  customer_name: string;
  customer_code: string;
  assigned_engineer: string;
  attachment_count: number;
  conversation_count: number;
  ticket_created_at: string;
  ticket_updated_at: string;
  ticket_closed_at: string;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface TicketConversation {
  id: string;
  ticket_history_id: string;
  ticket_id: number;
  event_type: string;
  actor_name: string;
  actor_role: string;
  content: string;
  event_created_at: string;
  created_at: string;
}

@Injectable()
export class TicketHistoryService {
  private readonly logger = new Logger(TicketHistoryService.name);
  private readonly TABLE = 'employee_ticket_history';
  private readonly CONV_TABLE = 'ticket_conversations';

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 依員工 ID 取得工單歷史
   */
  async getByEmployeeId(employeeId: string, limit: number = 50): Promise<TicketHistory[]> {
    return this.supabase.findMany<TicketHistory>(this.TABLE, {
      filters: { employee_id: employeeId },
      orderBy: { column: 'ticket_created_at', ascending: false },
      limit,
      useAdmin: true,
    });
  }

  /**
   * 依員工 APP Number 取得工單歷史
   */
  async getByEmployeeAppNumber(appNumber: string, limit: number = 50): Promise<TicketHistory[]> {
    return this.supabase.findMany<TicketHistory>(this.TABLE, {
      filters: { employee_app_number: appNumber },
      orderBy: { column: 'ticket_created_at', ascending: false },
      limit,
      useAdmin: true,
    });
  }

  /**
   * 依工單 ID 取得單張工單
   */
  async getByTicketId(ticketId: number): Promise<TicketHistory | null> {
    return this.supabase.findOne<TicketHistory>(this.TABLE, { ticket_id: ticketId }, { useAdmin: true });
  }

  /**
   * 依工單 ID 取得對話時間軸
   */
  async getConversationsByTicketId(ticketId: number): Promise<TicketConversation[]> {
    return this.supabase.findMany<TicketConversation>(this.CONV_TABLE, {
      filters: { ticket_id: ticketId },
      orderBy: { column: 'event_created_at', ascending: true },
      useAdmin: true,
    });
  }

  /**
   * 取得員工工單統計摘要
   */
  async getStatsByEmployeeAppNumber(appNumber: string): Promise<{
    total: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    by_category: { category: string; count: number }[];
  }> {
    const tickets = await this.getByEmployeeAppNumber(appNumber, 9999);

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const categoryMap: Record<string, number> = {};

    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      if (t.parent_category) {
        categoryMap[t.parent_category] = (categoryMap[t.parent_category] || 0) + 1;
      }
    }

    const byCategory = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));

    return {
      total: tickets.length,
      by_status: byStatus,
      by_priority: byPriority,
      by_category: byCategory,
    };
  }

  /**
   * 搜尋工單
   */
  async search(params: {
    employee_id?: string;
    employee_app_number?: string;
    status?: string;
    priority?: string;
    parent_category?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: TicketHistory[]; total: number }> {
    const filters: Record<string, any> = {};

    if (params.employee_id) filters.employee_id = params.employee_id;
    if (params.employee_app_number) filters.employee_app_number = params.employee_app_number;
    if (params.status) filters.status = params.status;
    if (params.priority) filters.priority = params.priority;
    if (params.parent_category) filters.parent_category = params.parent_category;

    const data = await this.supabase.findMany<TicketHistory>(this.TABLE, {
      filters,
      orderBy: { column: 'ticket_created_at', ascending: false },
      limit: params.limit || 50,
      offset: params.offset || 0,
      useAdmin: true,
    });

    return { data, total: data.length };
  }
}
