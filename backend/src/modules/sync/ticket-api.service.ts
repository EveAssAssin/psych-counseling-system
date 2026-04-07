import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

// API 回傳的訊息格式
export interface OfficialChannelMessage {
  id: number;
  source_record_id: string;
  employee_app_number: string;
  employee_erp_id: string;
  employee_name: string;
  group_name: string | null;
  channel: string;
  thread_id: string;
  direction: string;
  message_time: string;
  message_text: string;
  message_type?: string;
  agent_type?: string;
  // 工單留言特有欄位
  ticket_no?: string;
  author_name?: string;
  author_role?: string;
  updated_at: string;
}

export interface ApiResponse {
  success: boolean;
  source_system: string;
  fetched_at: string;
  total: number;
  page: number;
  page_size: number;
  next_cursor: number | null;
  records: OfficialChannelMessage[];
}

@Injectable()
export class TicketApiService {
  private readonly logger = new Logger(TicketApiService.name);
  private readonly BASE_URL = 'https://ticket.ruki-ai.com';

  /**
   * 取得 LINE 官方帳號訊息
   */
  async getOfficialChannelMessages(params: {
    updated_after?: string;
    updated_before?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse> {
    try {
      const response = await axios.get(
        `${this.BASE_URL}/api/v1/person-data/official-channel-messages`,
        {
          params: {
            updated_after: params.updated_after,
            updated_before: params.updated_before,
            page: params.page || 1,
            page_size: params.page_size || 100,
          },
          timeout: 30000,
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch official channel messages:', error.message);
      throw error;
    }
  }

  /**
   * 取得工單留言紀錄
   */
  async getTicketComments(params: {
    updated_after?: string;
    updated_before?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiResponse> {
    try {
      const response = await axios.get(
        `${this.BASE_URL}/api/v1/person-data/ticket-comments`,
        {
          params: {
            updated_after: params.updated_after,
            updated_before: params.updated_before,
            page: params.page || 1,
            page_size: params.page_size || 100,
          },
          timeout: 30000,
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch ticket comments:', error.message);
      throw error;
    }
  }

  /**
   * 取得所有分頁資料（自動處理分頁）
   */
  async getAllMessages(
    fetchFn: (params: any) => Promise<ApiResponse>,
    params: { updated_after?: string; updated_before?: string },
  ): Promise<OfficialChannelMessage[]> {
    const allRecords: OfficialChannelMessage[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetchFn({
        ...params,
        page,
        page_size: 100,
      });

      allRecords.push(...response.records);
      this.logger.log(`Fetched page ${page}: ${response.records.length} records (total so far: ${allRecords.length})`);

      if (response.next_cursor) {
        page = response.next_cursor;
      } else {
        hasMore = false;
      }

      // 避免 API 過載
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return allRecords;
  }

  /**
   * 取得所有 LINE 訊息（自動分頁）
   */
  async getAllOfficialChannelMessages(params: {
    updated_after?: string;
    updated_before?: string;
  }): Promise<OfficialChannelMessage[]> {
    return this.getAllMessages(
      (p) => this.getOfficialChannelMessages(p),
      params,
    );
  }

  /**
   * 取得所有工單留言（自動分頁）
   */
  async getAllTicketComments(params: {
    updated_after?: string;
    updated_before?: string;
  }): Promise<OfficialChannelMessage[]> {
    return this.getAllMessages(
      (p) => this.getTicketComments(p),
      params,
    );
  }

  // ============================================
  // 員工工單歷史 API
  // ============================================

  /**
   * 工單歷史 API 回傳格式
   */
  async getEmployeeTicketHistory(params: {
    app_number: string;
    updated_after?: string;
    updated_before?: string;
    page?: number;
    page_size?: number;
  }): Promise<TicketHistoryApiResponse> {
    try {
      const response = await axios.get(
        `${this.BASE_URL}/api/v1/person-data/employee-ticket-history`,
        {
          params: {
            app_number: params.app_number,
            updated_after: params.updated_after,
            updated_before: params.updated_before,
            page: params.page || 1,
            page_size: params.page_size || 50,
          },
          timeout: 30000,
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch ticket history for ${params.app_number}:`, error.message);
      throw error;
    }
  }

  /**
   * 取得某員工所有工單（自動分頁）
   */
  async getAllEmployeeTicketHistory(params: {
    app_number: string;
    updated_after?: string;
    updated_before?: string;
  }): Promise<TicketHistoryRecord[]> {
    const allRecords: TicketHistoryRecord[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getEmployeeTicketHistory({
        ...params,
        page,
        page_size: 50,
      });

      if (!response.success) break;

      allRecords.push(...response.records);
      this.logger.log(
        `Fetched ticket history page ${page} for ${params.app_number}: ${response.records.length} records`,
      );

      hasMore = page < response.pagination.total_pages;
      page++;

      // 避免 API 過載
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return allRecords;
  }
}

// ============================================
// 工單歷史 API 回傳型別
// ============================================

export interface TicketHistoryApiResponse {
  success: boolean;
  source_system: string;
  fetched_at: string;
  app_number: string;
  employee_info: {
    app_number: string;
    erp_id: string;
    name: string;
    job_title: string;
    store_name: string;
    store_erp_id: string;
    line_uid: string;
  } | null;
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
  summary: {
    total_tickets: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    by_category: { category: string; count: number }[];
  };
  records: TicketHistoryRecord[];
}

export interface TicketHistoryRecord {
  ticket_id: number;
  ticket_no: string;
  issue_title: string;
  issue_desc: string;
  category: string;
  parent_category: string;
  sub_category: string;
  status: string;
  review_status: string;
  priority: string;
  store_name: string;
  staff_name: string;
  customer_name: string;
  customer_code: string;
  assigned_engineer: string;
  attachment_count: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  conversation_count: number;
  conversation: TicketConversationEvent[];
}

export interface TicketConversationEvent {
  event_type: string;
  actor_name: string;
  actor_role: string;
  content: string;
  created_at: string;
}
