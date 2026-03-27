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
export declare class TicketApiService {
    private readonly logger;
    private readonly BASE_URL;
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
}
