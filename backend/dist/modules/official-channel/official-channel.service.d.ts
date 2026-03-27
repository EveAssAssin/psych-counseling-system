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
export declare class OfficialChannelService {
    private readonly supabase;
    private readonly logger;
    private readonly TABLE;
    constructor(supabase: SupabaseService);
    getByEmployeeId(employeeId: string, limit?: number): Promise<OfficialChannelMessage[]>;
    getByEmployeeAppNumber(appNumber: string, limit?: number): Promise<OfficialChannelMessage[]>;
    search(params: {
        employee_id?: string;
        employee_app_number?: string;
        channel?: string;
        date_from?: string;
        date_to?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: OfficialChannelMessage[];
        total: number;
    }>;
    getById(id: string): Promise<OfficialChannelMessage | null>;
    getStats(): Promise<{
        total: number;
        by_channel: Record<string, number>;
        recent_count: number;
    }>;
}
