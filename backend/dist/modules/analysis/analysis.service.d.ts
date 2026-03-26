import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AnalysisResult, StressLevel, RiskLevel } from './analysis.dto';
export declare class AnalysisService {
    private readonly configService;
    private readonly supabase;
    private readonly conversationsService;
    private readonly logger;
    private readonly anthropic;
    private readonly TABLE;
    constructor(configService: ConfigService, supabase: SupabaseService, conversationsService: ConversationsService);
    analyze(conversationId: string, force?: boolean): Promise<AnalysisResult>;
    private callClaudeAnalysis;
    private saveAnalysisResult;
    private createRiskFlags;
    private updateEmployeeCurrentStatus;
    findById(id: string): Promise<AnalysisResult>;
    findByConversationId(conversationId: string): Promise<AnalysisResult | null>;
    findByEmployee(employeeId: string): Promise<AnalysisResult[]>;
    getLatestByEmployee(employeeId: string): Promise<AnalysisResult | null>;
    search(options: {
        employee_id?: string;
        risk_level?: RiskLevel;
        stress_level?: StressLevel;
        followup_needed?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: AnalysisResult[];
        total: number;
    }>;
    getHighRiskAnalyses(limit?: number): Promise<AnalysisResult[]>;
}
