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
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = require("crypto");
let NotificationService = NotificationService_1 = class NotificationService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(NotificationService_1.name);
        this.API_URL = 'https://rsv.lohasglasses.com/_api/v1.ashx';
        this.AES_KEY = 'GmAOoS003d5OJ2G2';
        this.AES_IV = 'bgfDcfWdWG6NSUr5';
    }
    encrypt(data) {
        const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(this.AES_KEY, 'utf8'), Buffer.from(this.AES_IV, 'utf8'));
        let encrypted = cipher.update(data, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    }
    async sendCustomerServicePush(memberId, message, employeeErpId) {
        try {
            const encryptedMemberId = this.encrypt(memberId);
            const payload = {
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
        }
        catch (error) {
            this.logger.error(`Push notification error: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async sendPushNotification(employeeAppNumber, title, body, url) {
        const message = url
            ? `【${title}】\n${body}\n\n點擊查看: [${url}]`
            : `【${title}】\n${body}`;
        return this.sendCustomerServicePush(employeeAppNumber, message);
    }
    async notifyNewReview(employeeAppNumber, reviewId, baseUrl) {
        const title = '您有一則新的員工評價';
        const body = '公關部已對您提出評價，請點擊查看詳情並回覆。';
        const url = `${baseUrl}/employee/review/${reviewId}`;
        return this.sendPushNotification(employeeAppNumber, title, body, url);
    }
    async notifyNewReplyToEmployee(employeeAppNumber, reviewId, baseUrl) {
        const title = '評價有新的回覆';
        const body = '公關部已回覆您的評價，請點擊查看。';
        const url = `${baseUrl}/employee/review/${reviewId}`;
        return this.sendPushNotification(employeeAppNumber, title, body, url);
    }
    async notifyNewReplyToPR(prEmployeeAppNumber, reviewId, employeeName, baseUrl) {
        const title = '員工已回覆評價';
        const body = `${employeeName} 已回覆評價，請點擊查看。`;
        const url = `${baseUrl}/admin/reviews/${reviewId}`;
        return this.sendPushNotification(prEmployeeAppNumber, title, body, url);
    }
    async sendBatchNotifications(notifications) {
        const results = await Promise.all(notifications.map((n) => this.sendPushNotification(n.employeeAppNumber, n.title, n.body, n.url)));
        return results;
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map