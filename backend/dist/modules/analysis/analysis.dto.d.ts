export declare enum StressLevel {
    LOW = "low",
    MODERATE = "moderate",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare enum RiskLevel {
    LOW = "low",
    MODERATE = "moderate",
    HIGH = "high",
    CRITICAL = "critical"
}
export interface AnalysisResult {
    id: string;
    conversation_intake_id: string;
    employee_id: string;
    current_psychological_state?: string;
    stress_level?: StressLevel;
    risk_level?: RiskLevel;
    summary?: string;
    key_topics: string[];
    observations: string[];
    suggested_actions: string[];
    taboo_topics: string[];
    interviewer_question_suggestions: string[];
    followup_needed: boolean;
    followup_suggested_at?: string;
    supervisor_involvement?: string;
    next_talk_focus?: string;
    model_name?: string;
    model_version?: string;
    analysis_prompt_version?: string;
    raw_response?: Record<string, any>;
    confidence_score?: number;
    created_at: string;
    updated_at: string;
}
export interface AIAnalysisOutput {
    current_psychological_state: string;
    stress_level: StressLevel;
    risk_level: RiskLevel;
    summary: string;
    key_topics: string[];
    observations: string[];
    suggested_actions: string[];
    taboo_topics: string[];
    interviewer_question_suggestions: string[];
    followup_needed: boolean;
    followup_suggested_days?: number;
    supervisor_involvement: string;
    next_talk_focus: string;
    confidence_score: number;
    risk_flags?: {
        type: string;
        severity: RiskLevel;
        title: string;
        description: string;
        evidence: string;
    }[];
}
export declare class RunAnalysisDto {
    conversation_intake_id: string;
    force?: boolean;
}
export declare class AnalysisResponseDto {
    id: string;
    conversation_intake_id: string;
    employee_id: string;
    current_psychological_state?: string;
    stress_level?: StressLevel;
    risk_level?: RiskLevel;
    summary?: string;
    key_topics: string[];
    observations: string[];
    suggested_actions: string[];
    taboo_topics: string[];
    interviewer_question_suggestions: string[];
    followup_needed: boolean;
    followup_suggested_at?: string;
    supervisor_involvement?: string;
    next_talk_focus?: string;
    created_at: string;
}
export declare class SearchAnalysisDto {
    employee_id?: string;
    risk_level?: RiskLevel;
    stress_level?: StressLevel;
    followup_needed?: boolean;
    limit?: number;
    offset?: number;
}
