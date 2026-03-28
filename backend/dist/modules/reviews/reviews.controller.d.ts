import { ReviewsService } from './reviews.service';
import { CreateReviewDto, CreateReviewResponseDto, SearchReviewDto } from './reviews.dto';
export declare class ReviewsController {
    private readonly reviewsService;
    constructor(reviewsService: ReviewsService);
    create(dto: CreateReviewDto): Promise<{
        success: boolean;
        data: import("./reviews.dto").Review;
    }>;
    search(dto: SearchReviewDto): Promise<{
        data: import("./reviews.dto").Review[];
        total: number;
        limit: number;
        offset: number;
        success: boolean;
    }>;
    getStats(): Promise<{
        success: boolean;
        data: {
            total: number;
            pending: number;
            responded: number;
            closed: number;
            by_type: Record<string, number>;
            by_source: Record<string, number>;
        };
    }>;
    getByEmployee(employeeId: string, limit?: number): Promise<{
        success: boolean;
        data: import("./reviews.dto").Review[];
    }>;
    getEmployeeStats(employeeId: string): Promise<{
        success: boolean;
        data: {
            total: number;
            positive: number;
            negative: number;
            other: number;
            pending: number;
            avg_response_hours: number;
            proxy_count: number;
        };
    }>;
    getById(id: string): Promise<{
        success: boolean;
        data: {
            attachments: import("./reviews.dto").ReviewAttachment[];
            responses: import("./reviews.dto").ReviewResponse[];
            id: string;
            employee_id: string;
            is_proxy: boolean;
            actual_employee_id?: string;
            source: import("./reviews.dto").ReviewSource;
            review_type: import("./reviews.dto").ReviewType;
            urgency: import("./reviews.dto").Urgency;
            event_date?: string;
            content?: string;
            content_transcript?: string;
            requires_response: boolean;
            response_token?: string;
            response_deadline?: string;
            responded_at?: string;
            response_speed_hours?: number;
            status: import("./reviews.dto").ReviewStatus;
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
        };
    }>;
    addResponse(id: string, body: {
        content: string;
        reviewer_name?: string;
    }): Promise<{
        success: boolean;
        data: import("./reviews.dto").ReviewResponse;
    }>;
    close(id: string, body: {
        close_note?: string;
        closed_by?: string;
    }): Promise<{
        success: boolean;
        data: import("./reviews.dto").Review;
    }>;
}
export declare class ReviewResponseController {
    private readonly reviewsService;
    constructor(reviewsService: ReviewsService);
    getByToken(token: string): Promise<{
        success: boolean;
        data: {
            id: string;
            employee_name: string | undefined;
            review_type: import("./reviews.dto").ReviewType;
            source: import("./reviews.dto").ReviewSource;
            urgency: import("./reviews.dto").Urgency;
            event_date: string | undefined;
            content: string | undefined;
            requires_response: boolean;
            status: import("./reviews.dto").ReviewStatus;
            response_deadline: string | undefined;
            created_at: string;
            attachments: {
                id: string;
                file_type: "image" | "video" | "audio";
                file_url: string;
                file_name: string | undefined;
            }[];
            responses: {
                id: string;
                content: string | undefined;
                responder_type: "reviewer" | "employee";
                responder_name: string | undefined;
                created_at: string;
            }[];
        };
    }>;
    submitResponse(token: string, dto: CreateReviewResponseDto): Promise<{
        success: boolean;
        message: string;
        data: import("./reviews.dto").ReviewResponse;
    }>;
}
