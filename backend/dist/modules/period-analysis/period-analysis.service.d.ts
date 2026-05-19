import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
export interface PeriodAnalysisRequest {
    start_date: string;
    end_date: string;
    employee_id?: string;
}
export interface TopicItem {
    topic: string;
    count: number;
    percentage: number;
    examples: string[];
}
export interface RiskEmployee {
    employee_id: string;
    name: string;
    department?: string;
    store_name?: string;
    risk_level: 'high' | 'critical';
    risk_signals: string[];
    negative_reviews: number;
    urgent_tickets: number;
    pending_reviews: number;
}
export interface TimelineEvent {
    date: string;
    category: string;
    summary: string;
    count: number;
    significance: 'high' | 'medium' | 'low';
}
export interface DataStats {
    total_employees_involved: number;
    official_messages: number;
    tickets: number;
    reviews: {
        total: number;
        positive: number;
        negative: number;
        pending: number;
    };
    conversations: number;
    by_day: Array<{
        date: string;
        messages: number;
        tickets: number;
        reviews: number;
    }>;
}
export interface PeriodAnalysisResult {
    period: {
        start: string;
        end: string;
        days: number;
    };
    target: 'all' | 'single';
    employee?: {
        id: string;
        name: string;
        department?: string;
    };
    data_stats: DataStats;
    hot_topics: TopicItem[];
    risk_employees: RiskEmployee[];
    timeline_summary: TimelineEvent[];
    ai_summary: string;
    key_findings: string[];
    recommended_actions: string[];
    analyzed_at: string;
}
export declare class PeriodAnalysisService {
    private readonly configService;
    private readonly supabase;
    private readonly logger;
    private readonly anthropic;
    constructor(configService: ConfigService, supabase: SupabaseService);
    analyze(req: PeriodAnalysisRequest): Promise<PeriodAnalysisResult>;
    private fetchMessages;
    private fetchTickets;
    private fetchTicketConversations;
    private fetchReviews;
    private fetchConversations;
    private fetchEmployees;
    private fetchCustomerFeedbackStats;
    private calcDataStats;
    private calcHotTopics;
    private extractMessageKeywords;
    private calcRiskEmployees;
    private calcTimeline;
    private callAI;
}
