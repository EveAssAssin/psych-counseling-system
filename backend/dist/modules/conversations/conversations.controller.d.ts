import { ConversationsService } from './conversations.service';
import { AudioTranscriptionService } from './audio-transcription.service';
import { SmartFillService } from './smart-fill.service';
import { CreateConversationDto, CreateConversationWithFileDto, UpdateConversationDto, SearchConversationDto } from './conversations.dto';
export declare class ConversationsController {
    private readonly conversationsService;
    private readonly audioTranscription;
    private readonly smartFill;
    constructor(conversationsService: ConversationsService, audioTranscription: AudioTranscriptionService, smartFill: SmartFillService);
    create(dto: CreateConversationDto): Promise<import("./conversations.dto").ConversationIntake>;
    createWithFile(file: Express.Multer.File, dto: CreateConversationWithFileDto): Promise<import("./conversations.dto").ConversationIntake>;
    transcribeAndSmartFill(file: Express.Multer.File, body: {
        hint_interviewer_name?: string;
        hint_employee_id?: string;
        language?: string;
    }): Promise<{
        raw_transcript: string;
        transcription_meta: any;
        suggestions: import("./smart-fill.service").SmartFillSuggestions;
    }>;
    search(dto: SearchConversationDto): Promise<{
        data: import("./conversations.dto").ConversationIntake[];
        total: number;
        limit: number;
        offset: number;
    }>;
    getStats(): Promise<{
        total: number;
        pending: number;
        completed: number;
        failed: number;
        needFollowup: number;
    }>;
    findByEmployee(employeeId: string): Promise<import("./conversations.dto").ConversationIntake[]>;
    findOne(id: string): Promise<import("./conversations.dto").ConversationIntake>;
    getAttachments(id: string): Promise<import("./conversations.dto").ConversationAttachment[]>;
    update(id: string, dto: UpdateConversationDto): Promise<import("./conversations.dto").ConversationIntake>;
    delete(id: string): Promise<void>;
}
