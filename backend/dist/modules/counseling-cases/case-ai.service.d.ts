import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
export declare class CaseAiService {
    private readonly supabase;
    private readonly config;
    private readonly logger;
    private readonly anthropic;
    private readonly model;
    private readonly RECENT_EXECUTIONS_LIMIT;
    private readonly MESSAGE_HISTORY_LIMIT;
    constructor(supabase: SupabaseService, config: ConfigService);
    private get db();
    listSessions(caseId: string): Promise<any[]>;
    getOrCreateSession(caseId: string, supervisorIdentifier: string): Promise<any>;
    getMessages(sessionId: string, supervisorIdentifier: string): Promise<any[]>;
    sendMessage(sessionId: string, supervisorIdentifier: string, userContent: string): Promise<{
        user_message: any;
        assistant_message: any;
    }>;
    private requireCase;
    private requireSessionAccess;
    private getRecentMessagesForClaude;
    private buildSystemPrompt;
    private summarizeInsight;
}
