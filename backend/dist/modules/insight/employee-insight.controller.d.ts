import { EmployeeInsightService } from './employee-insight.service';
import { EmployeesService } from '../employees/employees.service';
export declare class EmployeeInsightController {
    private readonly insightService;
    private readonly employeesService;
    constructor(insightService: EmployeeInsightService, employeesService: EmployeesService);
    getInsightByName(name: string, refresh?: boolean): Promise<{
        success: boolean;
        multiple: boolean;
        message: string;
        employees: {
            name: string;
            app_number: string;
            department: string | undefined;
            store_name: string | undefined;
            title: string | undefined;
        }[];
        data?: undefined;
    } | {
        success: boolean;
        data: import("./employee-insight.service").EmployeeInsight;
        multiple?: undefined;
        message?: undefined;
        employees?: undefined;
    }>;
    getInsight(appNumber: string, days?: number, refresh?: boolean): Promise<{
        success: boolean;
        data: import("./employee-insight.service").EmployeeInsight;
    }>;
    getSummary(appNumber: string): Promise<{
        success: boolean;
        data: {
            employee: {
                name: string;
                department: string;
                store_name: string;
            };
            summary: {
                risk_level: "low" | "moderate" | "high" | "critical";
                stress_level: "low" | "moderate" | "high" | "critical";
                trend: "improving" | "stable" | "worsening";
                overall_assessment: string;
                key_concerns: string[];
                positive_signals: string[];
                last_analyzed: string;
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
            quick_tips: {
                should_talk_soon: boolean;
                trend_warning: boolean;
                suggested_timing: string;
            };
        };
    }>;
    getCommunicationTips(appNumber: string): Promise<{
        success: boolean;
        data: {
            employee_name: string;
            risk_level: "low" | "high" | "moderate" | "critical";
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
            key_concerns: string[];
        };
    }>;
    getTimeline(appNumber: string, days?: number): Promise<{
        success: boolean;
        data: {
            employee_name: string;
            date_range: {
                from: string;
                to: string;
            };
            event_count: number;
            timeline: import("./employee-insight.service").TimelineEvent[];
        };
    }>;
    getTransferAssessment(appNumber: string): Promise<{
        success: boolean;
        data: {
            employee_name: string;
            current_status: {
                risk_level: "low" | "high" | "moderate" | "critical";
                stress_level: "low" | "high" | "moderate" | "critical";
                trend: "improving" | "stable" | "worsening";
            };
            transfer_assessment: {
                current_fitness: "high" | "medium" | "low";
                transfer_risk: "high" | "medium" | "low";
                transfer_recommendation: string;
                suitable_role_types: string[];
                mentoring_capacity: "ready" | "not_recommended" | "needs_support";
                stress_tolerance: "high" | "medium" | "low";
                turnover_risk: "high" | "medium" | "low";
                turnover_signals: string[];
            };
            team_dynamics: {
                collaboration_willingness: "high" | "medium" | "low";
                team_influence: "positive" | "neutral" | "negative";
                interpersonal_notes: string[];
            };
        };
    }>;
}
