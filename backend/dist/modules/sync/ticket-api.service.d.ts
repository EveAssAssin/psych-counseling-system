import { ConfigService } from '@nestjs/config';
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
export interface ExternalReview {
    id: string | number;
    employee_app_number: string;
    employee_erp_id?: string;
    employee_name?: string;
    review_type: 'positive' | 'negative' | 'other';
    source: string;
    urgency?: string;
    content?: string;
    event_date?: string;
    status: string;
    is_proxy?: boolean;
    actual_employee_app_number?: string;
    response_speed_hours?: number;
    responded_at?: string;
    closed_at?: string;
    deleted_at?: string | null;
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
export declare class TicketApiService {
    private readonly configService;
    private readonly logger;
    private readonly BASE_URL;
    constructor(configService: ConfigService);
    getOfficialChannelMessages(params: {
        updated_after?: string;
        updated_before?: string;
        page?: number;
        page_size?: number;
    }): Promise<ApiResponse>;
    getTicketComments(params: {
        updated_after?: string;
        updated_before?: string;
        page?: number;
        page_size?: number;
    }): Promise<ApiResponse>;
    getAllMessages(fetchFn: (params: any) => Promise<ApiResponse>, params: {
        updated_after?: string;
        updated_before?: string;
    }): Promise<OfficialChannelMessage[]>;
    getAllOfficialChannelMessages(params: {
        updated_after?: string;
        updated_before?: string;
    }): Promise<OfficialChannelMessage[]>;
    getAllTicketComments(params: {
        updated_after?: string;
        updated_before?: string;
    }): Promise<OfficialChannelMessage[]>;
    getEmployeeTicketHistory(params: {
        app_number: string;
        updated_after?: string;
        updated_before?: string;
        page?: number;
        page_size?: number;
    }): Promise<TicketHistoryApiResponse>;
    getAllEmployeeTicketHistory(params: {
        app_number: string;
        updated_after?: string;
        updated_before?: string;
    }): Promise<TicketHistoryRecord[]>;
    getReviewsSince(updatedAfter: string): Promise<ExternalReview[]>;
}
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
        by_category: {
            category: string;
            count: number;
        }[];
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
