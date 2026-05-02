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
export declare class TicketHistoryService {
    private readonly supabase;
    private readonly logger;
    private readonly TABLE;
    private readonly CONV_TABLE;
    constructor(supabase: SupabaseService);
    getByEmployeeId(employeeId: string, limit?: number): Promise<TicketHistory[]>;
    getByEmployeeAppNumber(appNumber: string, limit?: number): Promise<TicketHistory[]>;
    getByTicketId(ticketId: number): Promise<TicketHistory | null>;
    getConversationsByTicketId(ticketId: number): Promise<TicketConversation[]>;
    getStatsByEmployeeAppNumber(appNumber: string): Promise<{
        total: number;
        by_status: Record<string, number>;
        by_priority: Record<string, number>;
        by_category: {
            category: string;
            count: number;
        }[];
    }>;
    search(params: {
        employee_id?: string;
        employee_app_number?: string;
        status?: string;
        priority?: string;
        parent_category?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: TicketHistory[];
        total: number;
    }>;
}
