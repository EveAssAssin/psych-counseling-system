import { SupabaseService } from '../supabase/supabase.service';
import { ConversationIntake, ConversationAttachment, CreateConversationDto, UpdateConversationDto, SearchConversationDto, IntakeStatus, Priority } from './conversations.dto';
export declare class ConversationsService {
    private readonly supabase;
    private readonly logger;
    private readonly TABLE;
    private readonly ATTACHMENTS_TABLE;
    constructor(supabase: SupabaseService);
    create(dto: CreateConversationDto, uploadedBy?: string): Promise<ConversationIntake>;
    createWithFile(dto: {
        employee_id: string;
        conversation_date?: string;
        conversation_type?: string;
        interviewer_name?: string;
        background_note?: string;
        priority?: Priority;
        need_followup?: boolean;
        tags?: string[];
    }, file: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
    }, uploadedBy?: string): Promise<ConversationIntake>;
    findById(id: string): Promise<ConversationIntake>;
    getAttachments(conversationId: string): Promise<ConversationAttachment[]>;
    search(dto: SearchConversationDto): Promise<{
        data: ConversationIntake[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findByEmployee(employeeId: string): Promise<ConversationIntake[]>;
    update(id: string, dto: UpdateConversationDto): Promise<ConversationIntake>;
    updateStatus(id: string, status: IntakeStatus, error?: string): Promise<ConversationIntake>;
    updateExtractedText(id: string, extractedText: string): Promise<ConversationIntake>;
    delete(id: string): Promise<void>;
    getPendingForExtraction(limit?: number): Promise<ConversationIntake[]>;
    getPendingForAnalysis(limit?: number): Promise<ConversationIntake[]>;
    getStats(): Promise<{
        total: number;
        pending: number;
        completed: number;
        failed: number;
        needFollowup: number;
    }>;
}
