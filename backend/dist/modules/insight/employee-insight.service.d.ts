import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { OfficialChannelService } from '../official-channel/official-channel.service';
import { ReviewsService } from '../reviews/reviews.service';
export interface TimelineEvent {
    date: string;
    type: 'line_message' | 'ticket_comment' | 'conversation' | 'attendance' | 'score' | 'review';
    category: string;
    content: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    metadata?: Record<string, any>;
}
export interface EmployeeInsight {
    employee: {
        id: string;
        name: string;
        app_number: string;
        erp_id: string;
        department: string;
        store_name: string;
        title: string;
        is_active: boolean;
    };
    data_sources: {
        has_conversations: boolean;
        has_official_messages: boolean;
        has_attendance: boolean;
        has_scores: boolean;
        has_reviews: boolean;
        conversation_count: number;
        official_message_count: number;
        date_range: {
            from: string;
            to: string;
        };
    };
    summary: {
        risk_level: 'low' | 'moderate' | 'high' | 'critical';
        stress_level: 'low' | 'moderate' | 'high' | 'critical';
        trend: 'improving' | 'stable' | 'worsening';
        overall_assessment: string;
        key_concerns: string[];
        positive_signals: string[];
        last_analyzed: string;
    };
    timeline: TimelineEvent[];
    communication: {
        suggested_timing: string;
        opening_approach: string;
        talking_points: string[];
        avoid_topics: string[];
        expected_reactions: string[];
        response_strategies: {
            if: string;
            then: string;
        }[];
        sample_phrases: string[];
    };
    transfer_assessment: {
        current_fitness: 'high' | 'medium' | 'low';
        transfer_risk: 'high' | 'medium' | 'low';
        transfer_recommendation: string;
        suitable_role_types: string[];
        mentoring_capacity: 'ready' | 'not_recommended' | 'needs_support';
        stress_tolerance: 'high' | 'medium' | 'low';
        turnover_risk: 'high' | 'medium' | 'low';
        turnover_signals: string[];
    };
    team_dynamics: {
        collaboration_willingness: 'high' | 'medium' | 'low';
        team_influence: 'positive' | 'neutral' | 'negative';
        interpersonal_notes: string[];
    };
    historical_patterns: {
        recurring_issues: string[];
        improvement_history: string[];
        key_turning_points: {
            date: string;
            event: string;
            impact: string;
        }[];
    };
    recommended_actions: {
        immediate: string[];
        short_term: string[];
        long_term: string[];
    };
    analysis_metadata: {
        analyzed_at: string;
        model: string;
        confidence_score: number;
        data_completeness: number;
    };
}
export declare class EmployeeInsightService {
    private readonly configService;
    private readonly supabase;
    private readonly employeesService;
    private readonly officialChannelService;
    private readonly reviewsService;
    private readonly logger;
    private readonly anthropic;
    constructor(configService: ConfigService, supabase: SupabaseService, employeesService: EmployeesService, officialChannelService: OfficialChannelService, reviewsService: ReviewsService);
    getInsight(employeeAppNumber: string, options?: {
        days?: number;
        forceRefresh?: boolean;
    }): Promise<EmployeeInsight>;
    private getCachedInsight;
    private saveInsight;
    clearInsightCache(employeeId: string): Promise<void>;
    private collectEmployeeData;
    private calculateAvgResponseHours;
    private buildTimeline;
    private detectSentiment;
    private calculateDataCompleteness;
    private getDateRange;
    private callAIAnalysis;
    private prepareAnalysisInput;
    private getDefaultAnalysis;
}
