import { SupervisorAiService, AiType } from './supervisor-ai.service';
export declare class SupervisorAiController {
    private readonly svc;
    constructor(svc: SupervisorAiService);
    getPersonas(): Promise<any[]>;
    updatePersona(id: string, dto: any): Promise<any>;
    getSessions(supervisorId: string): Promise<any[]>;
    createSession(dto: {
        supervisor_id: string;
        supervisor_name: string;
        employee_app_number?: string;
        employee_name?: string;
        ai_type: AiType;
    }): Promise<any>;
    getMessages(id: string): Promise<any[]>;
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
}
