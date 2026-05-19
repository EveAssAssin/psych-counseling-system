import { LineAssistantService } from './line-assistant.service';
import { GenerateAiSuggestionDto, SendReplyDto, SaveDraftDto, CreateGuidelineDto, UpdateGuidelineDto, UpdateAutoReplySettingsDto, InsertHistoricalMessageDto, ToggleSystemMessageDto } from './line-assistant.dto';
export declare class LineAssistantController {
    private readonly svc;
    constructor(svc: LineAssistantService);
    getConversations(limit?: number, offset?: number, search?: string): Promise<{
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
    generateSuggestion(dto: GenerateAiSuggestionDto): Promise<{
        suggestion: string;
        model: string;
    }>;
    sendReply(dto: SendReplyDto): Promise<{
        success: boolean;
        line_send_status: "success" | "failed" | "manual";
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
    isOffHours(): Promise<{
        is_off_hours: boolean;
    }>;
    insertHistorical(dto: InsertHistoricalMessageDto): Promise<{
        id: string;
    }>;
    toggleSystemMessage(id: string, dto: ToggleSystemMessageDto): Promise<{
        success: boolean;
    }>;
    getReplyLogs(threadId?: string, status?: string, limit?: number, offset?: number): Promise<{
        data: any[];
        total: number;
    }>;
}
