export declare const CASE_STATUSES: readonly ["planning", "active", "paused", "completed", "archived"];
export type CaseStatus = typeof CASE_STATUSES[number];
export declare const PLAN_ITEM_STATUSES: readonly ["pending", "done", "skipped", "rescheduled"];
export type PlanItemStatus = typeof PLAN_ITEM_STATUSES[number];
export declare const COUNSELING_METHODS: readonly ["phone", "face_to_face", "line_text", "observation", "group", "written"];
export type CounselingMethod = typeof COUNSELING_METHODS[number];
export declare class CreateCaseDraftDto {
    employee_app_number: string;
    supervisor_id: string;
    state_tag_codes: string[];
    state_description?: string;
    goal: string;
    start_date: string;
    target_end_date: string;
    allowed_methods: string[];
}
export declare class ConfirmCaseDto {
    draft_token: string;
    adjusted_plan_items?: AdjustedPlanItemDto[];
    adjusted_summary?: string;
}
export declare class AdjustedPlanItemDto {
    scheduled_date: string;
    sequence: number;
    method: string;
    objective: string;
    recommended_actions?: Record<string, any>;
    estimated_minutes?: number;
}
export declare class UpdateCaseDto {
    goal?: string;
    state_description?: string;
    target_end_date?: string;
    allowed_methods?: string[];
    status?: CaseStatus;
    closing_summary?: string;
}
export declare class UpdatePlanItemDto {
    scheduled_date?: string;
    method?: string;
    objective?: string;
    recommended_actions?: Record<string, any>;
    estimated_minutes?: number;
    status?: PlanItemStatus;
    reschedule_reason?: string;
}
export declare class CreateExecutionDto {
    plan_item_id?: string;
    actual_method: string;
    duration_minutes?: number;
    what_happened: string;
    employee_reaction?: string;
    next_action_hint?: string;
    mood_score?: number;
    attachments?: any[];
    recorded_by: string;
    recorded_by_name: string;
    executed_at?: string;
}
export declare class UpsertStateTagDto {
    code: string;
    label: string;
    description?: string;
    ai_prompt_hint?: string;
    severity?: string;
    default_duration_days?: number;
    sort_order?: number;
}
export declare class UpsertHolidayDto {
    date: string;
    name: string;
    type?: string;
    notes?: string;
}
export declare class TodayTasksQueryDto {
    date?: string;
    supervisor_id?: string;
}
export declare class ListCasesQueryDto {
    status?: string;
    supervisor_id?: string;
    employee_app_number?: string;
    state_tag_code?: string;
    limit?: number;
    offset?: number;
}
