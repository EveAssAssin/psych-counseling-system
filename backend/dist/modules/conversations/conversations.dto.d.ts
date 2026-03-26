export declare enum IntakeSourceType {
    MANUAL_TEXT = "manual_text",
    PDF = "pdf",
    DOCX = "docx",
    IMAGE_OCR = "image_ocr",
    EXTERNAL_SYNC = "external_sync",
    OFFICIAL_CHANNEL = "official_channel"
}
export declare enum IntakeStatus {
    PENDING = "pending",
    EXTRACTING = "extracting",
    EXTRACTED = "extracted",
    ANALYZING = "analyzing",
    COMPLETED = "completed",
    FAILED = "failed"
}
export declare enum Priority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    URGENT = "urgent"
}
export interface ConversationIntake {
    id: string;
    employee_id: string;
    source_type: IntakeSourceType;
    conversation_date?: string;
    conversation_type?: string;
    interviewer_name?: string;
    background_note?: string;
    raw_text?: string;
    extracted_text?: string;
    priority: Priority;
    need_followup: boolean;
    tags: string[];
    intake_status: IntakeStatus;
    extraction_status?: string;
    extraction_error?: string;
    analysis_status?: string;
    analysis_error?: string;
    uploaded_by?: string;
    imported_at: string;
    created_at: string;
    updated_at: string;
}
export interface ConversationAttachment {
    id: string;
    conversation_intake_id: string;
    storage_path: string;
    file_name: string;
    mime_type?: string;
    size_bytes?: number;
    extracted_text?: string;
    extraction_status: string;
    extraction_error?: string;
    uploaded_at: string;
    created_at: string;
}
export declare class CreateConversationDto {
    employee_id: string;
    conversation_date?: string;
    conversation_type?: string;
    interviewer_name?: string;
    background_note?: string;
    raw_text: string;
    priority?: Priority;
    need_followup?: boolean;
    tags?: string[];
    auto_analyze?: boolean;
}
export declare class CreateConversationWithFileDto {
    employee_id: string;
    conversation_date?: string;
    conversation_type?: string;
    interviewer_name?: string;
    background_note?: string;
    priority?: Priority;
    need_followup?: boolean;
    tags?: string[];
}
export declare class UpdateConversationDto {
    conversation_date?: string;
    conversation_type?: string;
    interviewer_name?: string;
    background_note?: string;
    priority?: Priority;
    need_followup?: boolean;
    tags?: string[];
}
export declare class SearchConversationDto {
    employee_id?: string;
    status?: IntakeStatus;
    priority?: Priority;
    need_followup?: boolean;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
}
export declare class ConversationResponseDto {
    id: string;
    employee_id: string;
    source_type: IntakeSourceType;
    conversation_date?: string;
    conversation_type?: string;
    interviewer_name?: string;
    background_note?: string;
    raw_text?: string;
    extracted_text?: string;
    priority: Priority;
    need_followup: boolean;
    tags: string[];
    intake_status: IntakeStatus;
    created_at: string;
    updated_at: string;
}
