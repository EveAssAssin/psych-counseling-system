import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { SupervisorNotesService } from '../supervisor-notes/supervisor-notes.service';
import { OrderStatsService } from '../sync/order-stats.service';
import { EmployeeContextService } from '../conversations/employee-context.service';
export type AiType = 'claude' | 'openai' | 'gemini';
export declare class SupervisorAiService {
    private readonly supabase;
    private readonly config;
    private readonly notesService;
    private readonly orderStatsService;
    private readonly employeeContext;
    private readonly logger;
    private readonly anthropic;
    constructor(supabase: SupabaseService, config: ConfigService, notesService: SupervisorNotesService, orderStatsService: OrderStatsService, employeeContext: EmployeeContextService);
    private get db();
    getPersonas(): Promise<any[]>;
    getPersona(aiType: AiType): Promise<any>;
    updatePersona(id: string, updates: {
        persona_name?: string;
        system_prompt?: string;
        model?: string;
        is_active?: boolean;
        is_default?: boolean;
    }): Promise<any>;
    getSessions(supervisorId: string): Promise<any[]>;
    createSession(dto: {
        supervisor_id: string;
        supervisor_name: string;
        employee_app_number?: string;
        employee_name?: string;
        ai_type: AiType;
    }): Promise<any>;
    getSessionMessages(sessionId: string): Promise<any[]>;
    sendMessage(dto: {
        session_id: string;
        supervisor_id: string;
        content: string;
    }): Promise<{
        role: string;
        content: string;
    }>;
    getEmployeeSummary(appNumber: string, supervisorId?: string): Promise<{
        employee: {
            id: any;
            name: any;
            store_name: any;
            title: any;
            hire_date: any;
            is_active: any;
            is_leave: any;
            leave_type: any;
            department: any;
            email: any;
        } | null;
        notes: any[];
        conversations: any[];
        reviews: any[];
        riskFlags: any[];
        channelMessages: any[];
        ticketHistory: any[];
        orderTrend: import("../sync/order-stats.service").EmployeeOrderTrend;
        storeTrend: any;
        reviewRecords: any[];
        feedbackStats: {
            total_feedbacks: any;
            pending_count: any;
            processing_count: any;
            resolved_count: any;
            closed_count: any;
            by_type: any;
            by_urgency: any;
            latest_feedback_at: any;
            raw_data: any;
        } | null;
    }>;
    private buildSystemPrompt;
    private callAI;
    private callClaude;
    private callOpenAI;
    private callGemini;
}
