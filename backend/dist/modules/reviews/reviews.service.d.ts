import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { NotificationService } from '../notification/notification.service';
import { Review, ReviewAttachment, ReviewResponse, CreateReviewDto, CreateReviewResponseDto, SearchReviewDto } from './reviews.dto';
export declare class ReviewsService {
    private readonly configService;
    private readonly supabase;
    private readonly employeesService;
    private readonly notificationService;
    private readonly logger;
    constructor(configService: ConfigService, supabase: SupabaseService, employeesService: EmployeesService, notificationService: NotificationService);
    create(dto: CreateReviewDto, createdBy?: string): Promise<Review>;
    findById(id: string): Promise<Review>;
    findByToken(token: string): Promise<Review & {
        employee_name?: string;
    }>;
    search(dto: SearchReviewDto): Promise<{
        data: Review[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findByEmployee(employeeId: string, limit?: number): Promise<Review[]>;
    getEmployeeStats(employeeId: string): Promise<{
        total: number;
        positive: number;
        negative: number;
        other: number;
        pending: number;
        avg_response_hours: number;
        proxy_count: number;
    }>;
    submitResponse(token: string, dto: CreateReviewResponseDto): Promise<ReviewResponse>;
    addReviewerResponse(reviewId: string, content: string, reviewerName: string): Promise<ReviewResponse>;
    close(id: string, closedBy: string | null, closeNote?: string): Promise<Review>;
    getAttachments(reviewId: string): Promise<ReviewAttachment[]>;
    getResponses(reviewId: string): Promise<ReviewResponse[]>;
    addAttachment(reviewId: string, fileType: 'image' | 'video' | 'audio', fileUrl: string, uploadedBy: 'reviewer' | 'employee', options?: {
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
        uploadedById?: string;
    }): Promise<ReviewAttachment>;
    private sendNotifications;
    private pushNotificationToEmployee;
    private notifyEmployeeNewReply;
    getStats(): Promise<{
        total: number;
        pending: number;
        responded: number;
        closed: number;
        by_type: Record<string, number>;
        by_source: Record<string, number>;
    }>;
    delete(id: string): Promise<void>;
}
