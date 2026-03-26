import { ConversationsService } from './conversations.service';
import { CreateConversationDto, CreateConversationWithFileDto, UpdateConversationDto, SearchConversationDto } from './conversations.dto';
export declare class ConversationsController {
    private readonly conversationsService;
    constructor(conversationsService: ConversationsService);
    create(dto: CreateConversationDto): Promise<import("./conversations.dto").ConversationIntake>;
    createWithFile(file: Express.Multer.File, dto: CreateConversationWithFileDto): Promise<import("./conversations.dto").ConversationIntake>;
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
    findOne(id: string): Promise<import("./conversations.dto").ConversationIntake>;
    getAttachments(id: string): Promise<import("./conversations.dto").ConversationAttachment[]>;
    findByEmployee(employeeId: string): Promise<import("./conversations.dto").ConversationIntake[]>;
    update(id: string, dto: UpdateConversationDto): Promise<import("./conversations.dto").ConversationIntake>;
    delete(id: string): Promise<void>;
}
