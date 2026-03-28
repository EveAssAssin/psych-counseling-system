import { ConfigService } from '@nestjs/config';
interface NotificationResult {
    success: boolean;
    statecode?: string;
    message?: string;
    data?: {
        count: number;
        memberIds: string[];
    };
    error?: string;
}
export declare class NotificationService {
    private configService;
    private readonly logger;
    private readonly API_URL;
    private readonly AES_KEY;
    private readonly AES_IV;
    constructor(configService: ConfigService);
    private encrypt;
    sendCustomerServicePush(memberId: string, message: string, employeeErpId?: string): Promise<NotificationResult>;
    sendPushNotification(employeeAppNumber: string, title: string, body: string, url?: string): Promise<NotificationResult>;
    notifyNewReview(employeeAppNumber: string, reviewId: string, baseUrl: string): Promise<NotificationResult>;
    notifyNewReplyToEmployee(employeeAppNumber: string, reviewId: string, baseUrl: string): Promise<NotificationResult>;
    notifyNewReplyToPR(prEmployeeAppNumber: string, reviewId: string, employeeName: string, baseUrl: string): Promise<NotificationResult>;
    sendBatchNotifications(notifications: Array<{
        employeeAppNumber: string;
        title: string;
        body: string;
        url?: string;
    }>): Promise<NotificationResult[]>;
}
export {};
