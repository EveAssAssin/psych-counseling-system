export declare class GenerateAiSuggestionDto {
    thread_id: string;
    original_message: string;
    employee_app_number?: string;
    employee_name?: string;
}
export declare class SendReplyDto {
    thread_id: string;
    final_reply: string;
    original_message?: string;
    ai_suggestion?: string;
    employee_app_number?: string;
    employee_name?: string;
    sent_by?: string;
    sent_by_name?: string;
    is_auto_reply?: boolean;
}
export declare class SaveDraftDto {
    thread_id: string;
    final_reply: string;
    original_message?: string;
    ai_suggestion?: string;
    employee_app_number?: string;
    employee_name?: string;
    sent_by?: string;
    sent_by_name?: string;
}
export declare class CreateGuidelineDto {
    title: string;
    category?: string;
    content: string;
    sort_order?: number;
    is_active?: boolean;
}
export declare class UpdateGuidelineDto {
    title?: string;
    category?: string;
    content?: string;
    sort_order?: number;
    is_active?: boolean;
}
export declare class InsertHistoricalMessageDto {
    thread_id: string;
    message_text: string;
    message_time: string;
    employee_app_number?: string;
    employee_name?: string;
    sent_by?: string;
    sent_by_name?: string;
}
export declare class ToggleSystemMessageDto {
    is_system_message: boolean;
}
export declare class UpdateAutoReplySettingsDto {
    is_enabled?: boolean;
    start_hour?: number;
    end_hour?: number;
    days_of_week?: number[];
    ai_persona?: string;
    delay_seconds?: number;
    updated_by?: string;
}
