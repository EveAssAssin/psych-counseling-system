import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface CustomerServicePushPayload {
  method: 'customerServicePush';
  memberId: string;
  message: string;
  employeeErpId?: string;
}

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

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  
  private readonly API_URL = 'https://rsv.lohasglasses.com/_api/v1.ashx';
  private readonly AES_KEY = 'GmAOoS003d5OJ2G2';
  private readonly AES_IV = 'bgfDcfWdWG6NSUr5';

  constructor(private configService: ConfigService) {}

  private encrypt(data: string): string {
    const cipher = crypto.createCipheriv(
      'aes-128-cbc',
      Buffer.from(this.AES_KEY, 'utf8'),
      Buffer.from(this.AES_IV, 'utf8'),
    );
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  async sendCustomerServicePush(
    memberId: string,
    message: string,
    employeeErpId?: string,
  ): Promise<NotificationResult> {
    try {
      const encryptedMemberId = this.encrypt(memberId);
      
      const payload: CustomerServicePushPayload = {
        method: 'customerServicePush',
        memberId: encryptedMemberId,
        message,
      };

      if (employeeErpId) {
        payload.employeeErpId = this.encrypt(employeeErpId);
      }

      this.logger.debug(`Sending push notification to member: ${memberId}`);

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      
      if (result.statecode !== '0') {
        this.logger.error(`Push notification failed: ${result.message}`);
        return {
          success: false,
          statecode: result.statecode,
          error: result.message,
        };
      }

      this.logger.log(`Push notification sent successfully to ${memberId}: ${result.message}`);
      return {
        success: true,
        statecode: result.statecode,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`Push notification error: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendPushNotification(
    employeeAppNumber: string,
    title: string,
    body: string,
    url?: string,
  ): Promise<NotificationResult> {
    // 網址用 [ ] 包住
    const message = url 
      ? `【${title}】\n${body}\n\n點擊查看: [${url}]`
      : `【${title}】\n${body}`;
    
    return this.sendCustomerServicePush(employeeAppNumber, message);
  }

  async notifyNewReview(
    employeeAppNumber: string,
    reviewId: string,
    baseUrl: string,
  ): Promise<NotificationResult> {
    const title = '您有一則新的員工評價';
    const body = '公關部已對您提出評價，請點擊查看詳情並回覆。';
    const url = `${baseUrl}/employee/review/${reviewId}`;

    return this.sendPushNotification(employeeAppNumber, title, body, url);
  }

  async notifyNewReplyToEmployee(
    employeeAppNumber: string,
    reviewId: string,
    baseUrl: string,
  ): Promise<NotificationResult> {
    const title = '評價有新的回覆';
    const body = '公關部已回覆您的評價，請點擊查看。';
    const url = `${baseUrl}/employee/review/${reviewId}`;

    return this.sendPushNotification(employeeAppNumber, title, body, url);
  }

  async notifyNewReplyToPR(
    prEmployeeAppNumber: string,
    reviewId: string,
    employeeName: string,
    baseUrl: string,
  ): Promise<NotificationResult> {
    const title = '員工已回覆評價';
    const body = `${employeeName} 已回覆評價，請點擊查看。`;
    const url = `${baseUrl}/admin/reviews/${reviewId}`;

    return this.sendPushNotification(prEmployeeAppNumber, title, body, url);
  }

  async sendBatchNotifications(
    notifications: Array<{
      employeeAppNumber: string;
      title: string;
      body: string;
      url?: string;
    }>,
  ): Promise<NotificationResult[]> {
    const results = await Promise.all(
      notifications.map((n) =>
        this.sendPushNotification(n.employeeAppNumber, n.title, n.body, n.url),
      ),
    );
    return results;
  }
}
