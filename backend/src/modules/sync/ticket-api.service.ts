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
}
