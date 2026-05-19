import { SupabaseService } from '../supabase/supabase.service';
import { ConversationsService } from './conversations.service';
export declare class EmployeeContextService {
    private readonly supabase;
    private readonly conversations;
    private readonly logger;
    constructor(supabase: SupabaseService, conversations: ConversationsService);
    buildConversationContext(employeeId: string, options?: {
        recentFullCount?: number;
        olderSummaryCount?: number;
        includeAnalysis?: boolean;
        maxRawTextLength?: number;
        includeBackgroundNote?: boolean;
    }): Promise<string>;
    private fetchAnalysesByConversationIds;
    private formatAnalysisSection;
    private riskTag;
    private indentLines;
}
