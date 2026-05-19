import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { EmployeeContextService } from '../conversations/employee-context.service';
import { GenerateAiSuggestionDto, SendReplyDto, SaveDraftDto, CreateGuidelineDto, UpdateGuidelineDto, UpdateAutoReplySettingsDto } from './line-assistant.dto';
export declare class LineAssistantService {
    private readonly supabase;
    private readonly config;
    private readonly employeesService;
    private readonly employeeContext;
    private readonly logger;
    private readonly anthropic;
    constructor(supabase: SupabaseService, config: ConfigService, employeesService: EmployeesService, employeeContext: EmployeeContextService);
    private get db();
    getConversationList(params: {
        limit?: number;
        offset?: number;
        search?: string;
    }): Promise<{
        data: any[];
        total: number;
    }>;
    getThreadMessages(threadId: string): Promise<{
        messages: any[];
        employee: {
            app_number: string;
            name: string;
        } | null;
        replyLog: any[];
    }>;
    generateAiSuggestion(dto: GenerateAiSuggestionDto): Promise<{
        suggestion: string;
        model: string;
    }>;
    sendReply(dto: SendReplyDto): Promise<{
        success: boolean;
        line_send_status: 'success' | 'failed' | 'manual';
        message: string;
        log_id: string;
    }>;
    saveDraft(dto: SaveDraftDto): Promise<{
        id: string;
    }>;
    getGuidelines(): Promise<any[]>;
    createGuideline(dto: CreateGuidelineDto): Promise<any>;
    updateGuideline(id: string, dto: UpdateGuidelineDto): Promise<any>;
    deleteGuideline(id: string): Promise<{
        success: boolean;
    }>;
    getAutoReplySettings(): Promise<any>;
    updateAutoReplySettings(dto: UpdateAutoReplySettingsDto): Promise<any>;
    getReplyLogs(params: {
        thread_id?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: any[];
        total: number;
    }>;
    isOffHours(): Promise<boolean>;
    triggerAutoReply(threadId: string, message: string, employeeAppNumber?: string, employeeName?: string): Promise<void>;
    insertHistoricalMessage(dto: {
        thread_id: string;
        message_text: string;
        message_time: string;
        employee_app_number?: string;
        employee_name?: string;
        sent_by?: string;
        sent_by_name?: string;
    }): Promise<{
        id: string;
    }>;
    toggleSystemMessage(id: string, isSystem: boolean): Promise<{
        success: boolean;
    }>;
}
