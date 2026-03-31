"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ReviewsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_service_1 = require("../supabase/supabase.service");
const employees_service_1 = require("../employees/employees.service");
const notification_service_1 = require("../notification/notification.service");
const reviews_dto_1 = require("./reviews.dto");
const uuid_1 = require("uuid");
let ReviewsService = ReviewsService_1 = class ReviewsService {
    constructor(configService, supabase, employeesService, notificationService) {
        this.configService = configService;
        this.supabase = supabase;
        this.employeesService = employeesService;
        this.notificationService = notificationService;
        this.logger = new common_1.Logger(ReviewsService_1.name);
    }
    async create(dto, createdBy) {
        this.logger.log(`Creating review for employee: ${dto.employee_id}`);
        let requiresResponse = dto.requires_response;
        if (dto.review_type === reviews_dto_1.ReviewType.POSITIVE) {
            requiresResponse = false;
        }
        else if (dto.review_type === reviews_dto_1.ReviewType.NEGATIVE) {
            requiresResponse = true;
        }
        if (requiresResponse === undefined) {
            requiresResponse = true;
        }
        const responseToken = (0, uuid_1.v4)();
        let responseDeadline;
        if (requiresResponse && dto.response_deadline_hours) {
            const deadline = new Date();
            deadline.setHours(deadline.getHours() + dto.response_deadline_hours);
            responseDeadline = deadline.toISOString();
        }
        const reviewData = {
            employee_id: dto.employee_id,
            is_proxy: dto.is_proxy || false,
            actual_employee_id: dto.actual_employee_id,
            source: dto.source,
            review_type: dto.review_type,
            urgency: dto.urgency || 'normal',
            event_date: dto.event_date,
            content: dto.content,
            requires_response: requiresResponse,
            response_token: responseToken,
            response_deadline: responseDeadline,
            status: 'pending',
            created_by: createdBy,
        };
        const review = await this.supabase.create('reviews', reviewData, { useAdmin: true });
        this.logger.log(`Review created: ${review.id}`);
        this.sendNotifications(review).catch(err => {
            this.logger.error('Failed to send notifications:', err);
        });
        return review;
    }
    async findById(id) {
        const review = await this.supabase.findOne('reviews', { id }, { useAdmin: true });
        if (!review) {
            throw new common_1.NotFoundException(`Review not found: ${id}`);
        }
        return review;
    }
    async findByToken(token) {
        const review = await this.supabase.findOne('reviews', { response_token: token }, { useAdmin: true });
        if (!review) {
            throw new common_1.NotFoundException('無效的連結或評價不存在');
        }
        const employee = await this.employeesService.findById(review.employee_id);
        return {
            ...review,
            employee_name: employee?.name,
        };
    }
    async search(dto) {
        const limit = dto.limit || 20;
        const offset = dto.offset || 0;
        const client = this.supabase.getAdminClient();
        let query = client.from('reviews').select('*', { count: 'exact' });
        if (dto.employee_id) {
            query = query.eq('employee_id', dto.employee_id);
        }
        if (dto.review_type) {
            query = query.eq('review_type', dto.review_type);
        }
        if (dto.status) {
            query = query.eq('status', dto.status);
        }
        if (dto.source) {
            query = query.eq('source', dto.source);
        }
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        const { data, count, error } = await query;
        if (error) {
            this.logger.error('Error searching reviews:', error);
            throw error;
        }
        return {
            data: data || [],
            total: count || 0,
            limit,
            offset,
        };
    }
    async findByEmployee(employeeId, limit = 50) {
        return this.supabase.findMany('reviews', {
            filters: { employee_id: employeeId },
            orderBy: { column: 'created_at', ascending: false },
            limit,
            useAdmin: true,
        });
    }
    async getEmployeeStats(employeeId) {
        const reviews = await this.findByEmployee(employeeId, 500);
        const positive = reviews.filter(r => r.review_type === 'positive').length;
        const negative = reviews.filter(r => r.review_type === 'negative').length;
        const other = reviews.filter(r => r.review_type === 'other').length;
        const pending = reviews.filter(r => r.status === 'pending' && r.requires_response).length;
        const proxyCount = reviews.filter(r => r.is_proxy).length;
        const respondedWithSpeed = reviews.filter(r => r.response_speed_hours != null);
        const avgResponseHours = respondedWithSpeed.length > 0
            ? respondedWithSpeed.reduce((sum, r) => sum + (r.response_speed_hours || 0), 0) / respondedWithSpeed.length
            : 0;
        return {
            total: reviews.length,
            positive,
            negative,
            other,
            pending,
            avg_response_hours: Math.round(avgResponseHours * 10) / 10,
            proxy_count: proxyCount,
        };
    }
    async submitResponse(token, dto) {
        const review = await this.findByToken(token);
        if (review.status === 'closed') {
            throw new Error('此評價已結案，無法回覆');
        }
        if (!review.requires_response) {
            throw new Error('此評價不需要回覆');
        }
        const existingResponses = await this.getResponses(review.id);
        const isFirstResponse = existingResponses.filter(r => r.responder_type === 'employee').length === 0;
        const response = await this.supabase.create('review_responses', {
            review_id: review.id,
            employee_id: review.employee_id,
            content: dto.content,
            responder_type: 'employee',
            responder_name: review.employee_name,
        }, { useAdmin: true });
        if (isFirstResponse) {
            const createdAt = new Date(review.created_at);
            const respondedAt = new Date();
            const responseSpeedHours = (respondedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
            await this.supabase.update('reviews', { id: review.id }, {
                status: 'responded',
                responded_at: respondedAt.toISOString(),
                response_speed_hours: Math.round(responseSpeedHours * 100) / 100,
            }, { useAdmin: true });
        }
        this.logger.log(`Review ${review.id} responded by employee`);
        return response;
    }
    async addReviewerResponse(reviewId, content, reviewerName) {
        const review = await this.findById(reviewId);
        if (review.status === 'closed') {
            throw new Error('此評價已結案，無法回覆');
        }
        const response = await this.supabase.create('review_responses', {
            review_id: reviewId,
            employee_id: review.employee_id,
            content: content,
            responder_type: 'reviewer',
            responder_name: reviewerName,
        }, { useAdmin: true });
        this.logger.log(`Review ${reviewId} replied by reviewer: ${reviewerName}`);
        this.notifyEmployeeNewReply(review).catch(err => {
            this.logger.error('Failed to notify employee of new reply:', err);
        });
        return response;
    }
    async close(id, closedBy, closeNote) {
        const review = await this.findById(id);
        const updateData = {
            status: 'closed',
            closed_at: new Date().toISOString(),
            close_note: closeNote,
        };
        if (closedBy) {
            updateData.closed_by = closedBy;
        }
        const updated = await this.supabase.update('reviews', { id }, updateData, { useAdmin: true });
        this.logger.log(`Review ${id} closed`);
        return updated;
    }
    async getAttachments(reviewId) {
        return this.supabase.findMany('review_attachments', {
            filters: { review_id: reviewId },
            orderBy: { column: 'created_at', ascending: true },
            useAdmin: true,
        });
    }
    async getResponses(reviewId) {
        return this.supabase.findMany('review_responses', {
            filters: { review_id: reviewId },
            orderBy: { column: 'created_at', ascending: true },
            useAdmin: true,
        });
    }
    async addAttachment(reviewId, fileType, fileUrl, uploadedBy, options) {
        return this.supabase.create('review_attachments', {
            review_id: reviewId,
            file_type: fileType,
            file_url: fileUrl,
            file_name: options?.fileName,
            file_size: options?.fileSize,
            mime_type: options?.mimeType,
            uploaded_by: uploadedBy,
            uploaded_by_id: options?.uploadedById,
            transcript_status: 'pending',
        }, { useAdmin: true });
    }
    async sendNotifications(review) {
        this.logger.log(`Sending notifications for review: ${review.id}`);
        try {
            const employee = await this.employeesService.findById(review.employee_id);
            if (!employee) {
                this.logger.warn(`Employee not found: ${review.employee_id}`);
                return;
            }
            const typeLabels = {
                positive: '正面評價',
                negative: '客訴通知',
                other: '評價通知',
            };
            const title = typeLabels[review.review_type] || '評價通知';
            const responseUrl = `${this.configService.get('app.frontendUrl')}/review/respond/${review.response_token}`;
            await this.pushNotificationToEmployee(review, employee, title, responseUrl);
            await this.supabase.update('reviews', { id: review.id }, {
                employee_notified: true,
                employee_notified_at: new Date().toISOString(),
            }, { useAdmin: true });
        }
        catch (error) {
            this.logger.error('Failed to send notifications:', error);
        }
    }
    async pushNotificationToEmployee(review, employee, title, responseUrl) {
        if (!employee.employeeappnumber) {
            this.logger.warn(`Employee ${employee.name} has no employeeappnumber, skipping push`);
            return;
        }
        const message = review.requires_response
            ? `【${title}】\n${review.content?.substring(0, 100) || '您有一則新評價'}...\n\n請點擊查看並回覆:\n[${responseUrl}]`
            : `【${title}】\n${review.content?.substring(0, 100) || '您收到一則正面評價'}`;
        const result = await this.notificationService.sendCustomerServicePush(employee.employeeappnumber, message);
        await this.supabase.create('review_notifications', {
            review_id: review.id,
            employee_id: employee.id,
            notification_type: 'new_review',
            notification_title: title,
            notification_body: review.content?.substring(0, 100),
            notification_url: responseUrl,
            push_status: result.success ? 'sent' : 'failed',
            push_error: result.error,
            push_response: result.message,
        }, { useAdmin: true });
        if (result.success) {
            this.logger.log(`Push notification sent to employee ${employee.name} (${employee.employeeappnumber})`);
        }
        else {
            this.logger.error(`Push notification failed for employee ${employee.name}: ${result.error}`);
        }
    }
    async notifyEmployeeNewReply(review) {
        try {
            const employee = await this.employeesService.findById(review.employee_id);
            if (!employee?.employeeappnumber) {
                this.logger.warn(`Cannot notify employee: no employeeappnumber`);
                return;
            }
            const responseUrl = `${this.configService.get('app.frontendUrl')}/review/respond/${review.response_token}`;
            const message = `【評價有新回覆】\n公關部已回覆您的評價，請點擊查看:\n[${responseUrl}]`;
            const result = await this.notificationService.sendCustomerServicePush(employee.employeeappnumber, message);
            if (result.success) {
                this.logger.log(`New reply notification sent to employee ${employee.name}`);
            }
            else {
                this.logger.error(`Failed to notify employee of new reply: ${result.error}`);
            }
        }
        catch (error) {
            this.logger.error('Error notifying employee of new reply:', error);
        }
    }
    async getStats() {
        const client = this.supabase.getAdminClient();
        const [totalRes, pendingRes, respondedRes, closedRes] = await Promise.all([
            client.from('reviews').select('*', { count: 'exact', head: true }),
            client.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            client.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'responded'),
            client.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'closed'),
        ]);
        const { data: recentReviews } = await client
            .from('reviews')
            .select('review_type, source')
            .order('created_at', { ascending: false })
            .limit(500);
        const byType = {};
        const bySource = {};
        for (const r of recentReviews || []) {
            byType[r.review_type] = (byType[r.review_type] || 0) + 1;
            bySource[r.source] = (bySource[r.source] || 0) + 1;
        }
        return {
            total: totalRes.count || 0,
            pending: pendingRes.count || 0,
            responded: respondedRes.count || 0,
            closed: closedRes.count || 0,
            by_type: byType,
            by_source: bySource,
        };
    }
    async delete(id) {
        this.logger.log(`Deleting review: ${id}`);
        await this.supabase.delete('review_responses', { review_id: id });
        await this.supabase.delete('review_attachments', { review_id: id });
        await this.supabase.delete('reviews', { id });
        this.logger.log(`Review deleted: ${id}`);
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = ReviewsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        supabase_service_1.SupabaseService,
        employees_service_1.EmployeesService,
        notification_service_1.NotificationService])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map