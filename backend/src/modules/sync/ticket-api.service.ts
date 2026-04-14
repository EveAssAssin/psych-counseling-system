import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

// ============================================
// Review System API 回傳格式（舊式 /api/reviews/since 端點）
// ============================================
export interface ExternalReview {
  id: string | number;          // review-system 的原始 ID
  employee_app_number: string;  // 人員編號
  employee_erp_id?: string;
  employee_name?: string;
  review_type: 'positive' | 'negative' | 'other';
  source: string;               // google_map / facebook / phone / app / other
  urgency?: string;             // urgent_plus / urgent / normal
  content?: string;
  event_date?: string;
  status: string;               // pending / responded / closed
  is_proxy?: boolean;
  actual_employee_app_number?: string;
  response_speed_hours?: number;
  responded_at?: string;
  closed_at?: string;
  deleted_at?: string | null;   // 軟刪除時間，null = 正常
  created_at: string;
  updated_at: string;
  responses?: ExternalReviewResponse[];
}

export interface ExternalReviewResponse {
  id: string | number;
  responder_type: 'employee' | 'reviewer';
  responder_name?: string;
  content?: string;
  created_at: string;
}

export interface ExternalReviewApiResponse {
  success: boolean;
  total: number;
  records: ExternalReview[];
}

// ============================================
// Psych-Sync API 回傳格式（官方 /psych-sync/reviews 端點）
// 用 x-api-key header 驗證，回傳每位員工的客訴/回報統計摘要
// ============================================
export interface PsychSyncFeedbackStats {
  app_number: string;
  employee_name?: string;
  store_name?: string;
  total_feedbacks: number;
  pending_count: number;
  processing_count: number;
  resolved_count: number;
  closed_count: number;
  by_type?: {
    complaint?: number;
    suggestion?: number;
    praise?: number;
    inquiry?: number;
    other?: number;
  };
  by_urgency?: {
    urgent_plus?: number;
    urgent?: number;
    normal?: number;
  };
  latest_feedback_at?: string | null;
  [key: string]: any; // 預留彈性欄位
}

export interface PsychSyncReviewsResponse {
  success: boolean;
  total_employees?: number;
  generated_at?: string;
  employees?: PsychSyncFeedbackStats[];
  data?: PsychSyncFeedbackStats[];     // 相容不同回傳格式
  records?: PsychSyncFeedbackStats[];  // 相容不同回傳格式
  [key: string]: any;
}

@Injectable()
export class TicketApiService {
  private readonly logger = new Logger(TicketApiService.name);
  private readonly BASE_URL = 'https://ticket.ruki-ai.com';

  constructor(private readonly configService: ConfigService) {}

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

  /**
   * 從 review-system 取得指定時間後更新的評價（增量同步）
   * 支援兩種 API 格式：
   *   GET /api/reviews/since/{timestamp}
   *   GET /api/reviews/since/placeholder?updated_after={timestamp}
   * 驗證方式：x-api-key header（REVIEW_SYSTEM_API_KEY / PSYCH_SYNC_API_KEY）
   */
  async getReviewsSince(updatedAfter: string): Promise<ExternalReview[]> {
    const baseUrl = this.configService.get<string>('externalApis.reviewSystem.url');
    const apiKey = this.configService.get<string>('externalApis.reviewSystem.apiKey');

    if (!baseUrl) {
      this.logger.warn('REVIEW_SYSTEM_API_URL not configured, skipping review sync');
      return [];
    }

    const authHeaders = apiKey ? { 'x-api-key': apiKey } : {};

    try {
      // 優先嘗試 query param 格式
      const url = `${baseUrl}/api/reviews/since/placeholder`;
      this.logger.log(`Fetching reviews since ${updatedAfter} from ${baseUrl}`);

      const response = await axios.get<ExternalReviewApiResponse>(url, {
        params: { updated_after: updatedAfter },
        headers: authHeaders,
        timeout: 30000,
      });

      const data = response.data;
      this.logger.log(`Fetched ${data.records?.length || 0} reviews from review-system`);
      return data.records || [];
    } catch (err: any) {
      // fallback：嘗試路徑格式 /api/reviews/since/{timestamp}
      try {
        const encodedTs = encodeURIComponent(updatedAfter);
        const url2 = `${baseUrl}/api/reviews/since/${encodedTs}`;

        const response2 = await axios.get<ExternalReviewApiResponse>(url2, {
          headers: authHeaders,
          timeout: 30000,
        });

        const data2 = response2.data;
        this.logger.log(`Fetched ${data2.records?.length || 0} reviews (fallback path format)`);
        return data2.records || [];
      } catch (err2: any) {
        this.logger.error('Failed to fetch reviews from review-system:', err2.message);
        throw err2;
      }
    }
  }

  /**
   * 呼叫 review-system 官方同步端點
   * GET /psych-sync/reviews
   * 驗證：x-api-key header（文件中 PSYCH_SYNC_API_KEY = lohas-psych-sync-2026-secret）
   * 回傳每位員工的客戶回報統計摘要（投訴數、評分、待處理案件數等）
   */
  async getPsychSyncReviews(): Promise<PsychSyncFeedbackStats[]> {
    const baseUrl = this.configService.get<string>('externalApis.reviewSystem.url');
    const apiKey = this.configService.get<string>('externalApis.reviewSystem.apiKey');

    if (!baseUrl) {
      this.logger.warn('REVIEW_SYSTEM_API_URL not configured, skipping psych-sync');
      return [];
    }

    try {
      const url = `${baseUrl}/psych-sync/reviews`;
      this.logger.log(`Fetching psych-sync reviews from ${url}`);

      const response = await axios.get<PsychSyncReviewsResponse>(url, {
        headers: apiKey ? { 'x-api-key': apiKey } : {},
        timeout: 45000, // Render 免費方案可能有冷啟動延遲
      });

      const data = response.data;
      // 相容多種回傳格式
      const employees =
        data.employees ||
        data.data ||
        data.records ||
        (Array.isArray(data) ? data : []);

      this.logger.log(`Fetched psych-sync stats for ${employees.length} employees`);
      return employees;
    } catch (err: any) {
      this.logger.error('Failed to fetch psych-sync reviews:', err.message);
      throw err;
    }
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
