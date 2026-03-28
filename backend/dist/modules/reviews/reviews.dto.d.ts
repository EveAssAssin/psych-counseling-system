export declare enum ReviewSource {
    GOOGLE_MAP = "google_map",
    FACEBOOK = "facebook",
    PHONE = "phone",
    APP = "app",
    OTHER = "other"
}
export declare enum ReviewType {
    POSITIVE = "positive",
    NEGATIVE = "negative",
    OTHER = "other"
}
export declare enum Urgency {
    URGENT_PLUS = "urgent_plus",
    URGENT = "urgent",
    NORMAL = "normal"
}
export declare enum ReviewStatus {
    PENDING = "pending",
    RESPONDED = "responded",
    CLOSED = "closed"
}
export interface Review {
    id: string;
    employee_id: string;
    is_proxy: boolean;
    actual_employee_id?: string;
    source: ReviewSource;
    review_type: ReviewType;
    urgency: Urgency;
    event_date?: string;
    content?: string;
    content_transcript?: string;
    requires_response: boolean;
    response_token?: string;
    response_deadline?: string;
    responded_at?: string;
    response_speed_hours?: number;
    status: ReviewStatus;
    closed_at?: string;
    closed_by?: string;
    close_note?: string;
    employee_notified: boolean;
    employee_notified_at?: string;
    manager_notified: boolean;
    manager_notified_at?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
}
export interface ReviewAttachment {
    id: string;
    review_id: string;
    file_type: 'image' | 'video' | 'audio';
    file_name?: string;
    file_url: string;
    file_size?: number;
    mime_type?: string;
    transcript?: string;
    transcript_status: 'pending' | 'processing' | 'completed' | 'failed';
    uploaded_by: 'reviewer' | 'employee';
    uploaded_by_id?: string;
    created_at: string;
}
export interface ReviewResponse {
    id: string;
    review_id: string;
    employee_id: string;
    content?: string;
    responder_type: 'employee' | 'reviewer';
    responder_name?: string;
    created_at: string;
    updated_at: string;
}
export declare class CreateReviewDto {
    employee_id: string;
    is_proxy?: boolean;
    actual_employee_id?: string;
    source: ReviewSource;
    review_type: ReviewType;
    urgency?: Urgency;
    event_date?: string;
    content?: string;
    requires_response?: boolean;
    response_deadline_hours?: number;
}
export declare class UpdateReviewDto {
    status?: ReviewStatus;
    close_note?: string;
}
export declare class CreateReviewResponseDto {
    content: string;
    responder_type?: 'employee' | 'reviewer';
    responder_name?: string;
}
export declare class SearchReviewDto {
    employee_id?: string;
    review_type?: ReviewType;
    status?: ReviewStatus;
    source?: ReviewSource;
    limit?: number;
    offset?: number;
}
export declare class ReviewResponseDto {
    id: string;
    employee_id: string;
    employee_name?: string;
    is_proxy: boolean;
    actual_employee_id?: string;
    source: ReviewSource;
    review_type: ReviewType;
    urgency: Urgency;
    event_date?: string;
    content?: string;
    requires_response: boolean;
    status: ReviewStatus;
    responded_at?: string;
    response_speed_hours?: number;
    created_at: string;
    attachments?: ReviewAttachment[];
    responses?: ReviewResponse[];
}
export declare class ReviewListResponseDto {
    data: ReviewResponseDto[];
    total: number;
    limit: number;
    offset: number;
}
export declare const SOURCE_LABELS: Record<ReviewSource, string>;
export declare const TYPE_LABELS: Record<ReviewType, string>;
export declare const URGENCY_LABELS: Record<Urgency, string>;
export declare const STATUS_LABELS: Record<ReviewStatus, string>;
