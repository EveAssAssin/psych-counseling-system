import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { NotificationService } from '../notification/notification.service';
import {
  Review,
  ReviewAttachment,
  ReviewResponse,
  CreateReviewDto,
  UpdateReviewDto,
  CreateReviewResponseDto,
  SearchReviewDto,
  ReviewType,
  ReviewStatus,
} from './reviews.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly employeesService: EmployeesService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * 建立評價
   */
  async create(dto: CreateReviewDto, createdBy?: string): Promise<Review> {
    this.logger.log(`Creating review for employee: ${dto.employee_id}`);

    // 根據 review_type 自動設定 requires_response
    let requiresResponse = dto.requires_response;
    if (dto.review_type === ReviewType.POSITIVE) {
      requiresResponse = false;
    } else if (dto.review_type === ReviewType.NEGATIVE) {
      requiresResponse = true;
    }
    // other 類型使用傳入的值，預設 true
    if (requiresResponse === undefined) {
      requiresResponse = true;
    }

    // 產生回覆 token
    const responseToken = uuidv4();

    // 計算回覆期限
    let responseDeadline: string | undefined;
    if (requiresResponse && dto.response_deadline_hours) {
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + dto.response_deadline_hours);
      responseDeadline = deadline.toISOString();
    }

    const reviewData: any = {
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

    const review = await this.supabase.create<Review>('reviews', reviewData, { useAdmin: true });

    this.logger.log(`Review created: ${review.id}`);

    // 觸發推播（異步）
    this.sendNotifications(review).catch(err => {
      this.logger.error('Failed to send notifications:', err);
    });

    return review;
  }

  /**
   * 取得單一評價
   */
  async findById(id: string): Promise<Review> {
    const review = await this.supabase.findOne<Review>('reviews', { id }, { useAdmin: true });

    if (!review) {
      throw new NotFoundException(`Review not found: ${id}`);
    }

    return review;
  }

  /**
   * 用 token 取得評價（員工回覆用）
   */
  async findByToken(token: string): Promise<Review & { employee_name?: string }> {
    const review = await this.supabase.findOne<Review>(
      'reviews',
      { response_token: token },
      { useAdmin: true },
    );

    if (!review) {
      throw new NotFoundException('無效的連結或評價不存在');
    }

    // 取得員工名字
    const employee = await this.employeesService.findById(review.employee_id);

    return {
      ...review,
      employee_name: employee?.name,
    };
  }

  /**
   * 搜尋評價
   */
  async search(dto: SearchReviewDto): Promise<{
    data: Review[];
    total: number;
    limit: number;
    offset: number;
  }> {
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

  /**
   * 取得員工的評價列表
   */
  async findByEmployee(employeeId: string, limit = 50): Promise<Review[]> {
    return this.supabase.findMany<Review>('reviews', {
      filters: { employee_id: employeeId },
      orderBy: { column: 'created_at', ascending: false },
      limit,
      useAdmin: true,
    });
  }

  /**
   * 取得員工評價統計
   */
  async getEmployeeStats(employeeId: string): Promise<{
    total: number;
    positive: number;
    negative: number;
    other: number;
    pending: number;
    avg_response_hours: number;
    proxy_count: number;
  }> {
    const reviews = await this.findByEmployee(employeeId, 500);

    const positive = reviews.filter(r => r.review_type === 'positive').length;
    const negative = reviews.filter(r => r.review_type === 'negative').length;
    const other = reviews.filter(r => r.review_type === 'other').length;
    const pending = reviews.filter(r => r.status === 'pending' && r.requires_response).length;
    const proxyCount = reviews.filter(r => r.is_proxy).length;

    // 計算平均回覆時間
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

  /**
   * 員工提交回覆
   */
  async submitResponse(
    token: string,
    dto: CreateReviewResponseDto,
  ): Promise<ReviewResponse> {
    const review = await this.findByToken(token);

    if (review.status === 'closed') {
      throw new Error('此評價已結案，無法回覆');
    }

    if (!review.requires_response) {
      throw new Error('此評價不需要回覆');
    }

    // 檢查是否為首次回覆
    const existingResponses = await this.getResponses(review.id);
    const isFirstResponse = existingResponses.filter(r => r.responder_type === 'employee').length === 0;

    // 建立回覆
    const response = await this.supabase.create<ReviewResponse>('review_responses', {
      review_id: review.id,
      employee_id: review.employee_id,
      content: dto.content,
      responder_type: 'employee',
      responder_name: review.employee_name,
    }, { useAdmin: true });

    // 如果是首次回覆，更新評價狀態和回覆速度
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

  /**
   * 公關部追問/回覆
   */
  async addReviewerResponse(
    reviewId: string,
    content: string,
    reviewerName: string,
  ): Promise<ReviewResponse> {
    const review = await this.findById(reviewId);

    if (review.status === 'closed') {
      throw new Error('此評價已結案，無法回覆');
    }

    const response = await this.supabase.create<ReviewResponse>('review_responses', {
      review_id: reviewId,
      employee_id: review.employee_id,
      content: content,
      responder_type: 'reviewer',
      responder_name: reviewerName,
    }, { useAdmin: true });

    this.logger.log(`Review ${reviewId} replied by reviewer: ${reviewerName}`);

    // 推播通知員工有新回覆
    this.notifyEmployeeNewReply(review).catch(err => {
      this.logger.error('Failed to notify employee of new reply:', err);
    });

    return response;
  }

  /**
   * 結案評價
   */
  async close(id: string, closedBy: string | null, closeNote?: string): Promise<Review> {
    const review = await this.findById(id);

    const updateData: any = {
      status: 'closed',
      closed_at: new Date().toISOString(),
      close_note: closeNote,
    };
    
    if (closedBy) {
      updateData.closed_by = closedBy;
    }

    const updated = await this.supabase.update<Review>('reviews', { id }, updateData, { useAdmin: true });

    this.logger.log(`Review ${id} closed`);

    return updated!;
  }

  /**
   * 取得評價的附件
   */
  async getAttachments(reviewId: string): Promise<ReviewAttachment[]> {
    return this.supabase.findMany<ReviewAttachment>('review_attachments', {
      filters: { review_id: reviewId },
      orderBy: { column: 'created_at', ascending: true },
      useAdmin: true,
    });
  }

  /**
   * 取得評價的回覆
   */
  async getResponses(reviewId: string): Promise<ReviewResponse[]> {
    return this.supabase.findMany<ReviewResponse>('review_responses', {
      filters: { review_id: reviewId },
      orderBy: { column: 'created_at', ascending: true },
      useAdmin: true,
    });
  }

  /**
   * 新增附件
   */
  async addAttachment(
    reviewId: string,
    fileType: 'image' | 'video' | 'audio',
    fileUrl: string,
    uploadedBy: 'reviewer' | 'employee',
    options?: {
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      uploadedById?: string;
    },
  ): Promise<ReviewAttachment> {
    return this.supabase.create<ReviewAttachment>('review_attachments', {
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

  /**
   * 發送推播通知（建立評價時）
   */
  private async sendNotifications(review: Review): Promise<void> {
    this.logger.log(`Sending notifications for review: ${review.id}`);

    try {
      // 取得員工資料
      const employee = await this.employeesService.findById(review.employee_id);
      if (!employee) {
        this.logger.warn(`Employee not found: ${review.employee_id}`);
        return;
      }

      // 準備推播內容
      const typeLabels: Record<string, string> = {
        positive: '正面評價',
        negative: '客訴通知',
        other: '評價通知',
      };

      const title = typeLabels[review.review_type] || '評價通知';
      const responseUrl = `${this.configService.get('app.frontendUrl')}/review/respond/${review.response_token}`;

      // 推播給員工
      await this.pushNotificationToEmployee(review, employee, title, responseUrl);

      // 更新推播狀態
      await this.supabase.update('reviews', { id: review.id }, {
        employee_notified: true,
        employee_notified_at: new Date().toISOString(),
      }, { useAdmin: true });

    } catch (error) {
      this.logger.error('Failed to send notifications:', error);
    }
  }

  /**
   * 推播給員工（使用左手 customerServicePush API）
   */
  private async pushNotificationToEmployee(
    review: Review,
    employee: any,
    title: string,
    responseUrl: string,
  ): Promise<void> {
    // 檢查員工是否有 employeeappnumber
    if (!employee.employeeappnumber) {
      this.logger.warn(`Employee ${employee.name} has no employeeappnumber, skipping push`);
      return;
    }

    // 組合推播訊息
    const message = review.requires_response
      ? `【${title}】\n${review.content?.substring(0, 100) || '您有一則新評價'}...\n\n請點擊查看並回覆:\n[${responseUrl}]`
      : `【${title}】\n${review.content?.substring(0, 100) || '您收到一則正面評價'}`;

    // 使用 NotificationService 發送推播
    const result = await this.notificationService.sendCustomerServicePush(
      employee.employeeappnumber,
      message,
    );

    // 記錄推播結果
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
    } else {
      this.logger.error(`Push notification failed for employee ${employee.name}: ${result.error}`);
    }
  }

  /**
   * 通知員工有新回覆
   */
  private async notifyEmployeeNewReply(review: Review): Promise<void> {
    try {
      const employee = await this.employeesService.findById(review.employee_id);
      if (!employee?.employeeappnumber) {
        this.logger.warn(`Cannot notify employee: no employeeappnumber`);
        return;
      }

      const responseUrl = `${this.configService.get('app.frontendUrl')}/review/respond/${review.response_token}`;
      const message = `【評價有新回覆】\n公關部已回覆您的評價，請點擊查看:\n[${responseUrl}]`;

      const result = await this.notificationService.sendCustomerServicePush(
        employee.employeeappnumber,
        message,
      );

      if (result.success) {
        this.logger.log(`New reply notification sent to employee ${employee.name}`);
      } else {
        this.logger.error(`Failed to notify employee of new reply: ${result.error}`);
      }
    } catch (error) {
      this.logger.error('Error notifying employee of new reply:', error);
    }
  }

  /**
   * 取得評價統計（整體）
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    responded: number;
    closed: number;
    by_type: Record<string, number>;
    by_source: Record<string, number>;
  }> {
    const client = this.supabase.getAdminClient();

    const [totalRes, pendingRes, respondedRes, closedRes] = await Promise.all([
      client.from('reviews').select('*', { count: 'exact', head: true }),
      client.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      client.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'responded'),
      client.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'closed'),
    ]);

    // 取得最近 500 筆來統計類型和來源
    const { data: recentReviews } = await client
      .from('reviews')
      .select('review_type, source')
      .order('created_at', { ascending: false })
      .limit(500);

    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};

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
}
