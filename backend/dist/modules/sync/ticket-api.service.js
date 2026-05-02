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
var TicketApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketApiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
let TicketApiService = TicketApiService_1 = class TicketApiService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(TicketApiService_1.name);
        this.BASE_URL = 'https://ticket.ruki-ai.com';
    }
    async getOfficialChannelMessages(params) {
        try {
            const response = await axios_1.default.get(`${this.BASE_URL}/api/v1/person-data/official-channel-messages`, {
                params: {
                    updated_after: params.updated_after,
                    updated_before: params.updated_before,
                    page: params.page || 1,
                    page_size: params.page_size || 100,
                },
                timeout: 30000,
            });
            return response.data;
        }
        catch (error) {
            this.logger.error('Failed to fetch official channel messages:', error.message);
            throw error;
        }
    }
    async getTicketComments(params) {
        try {
            const response = await axios_1.default.get(`${this.BASE_URL}/api/v1/person-data/ticket-comments`, {
                params: {
                    updated_after: params.updated_after,
                    updated_before: params.updated_before,
                    page: params.page || 1,
                    page_size: params.page_size || 100,
                },
                timeout: 30000,
            });
            return response.data;
        }
        catch (error) {
            this.logger.error('Failed to fetch ticket comments:', error.message);
            throw error;
        }
    }
    async getAllMessages(fetchFn, params) {
        const allRecords = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
            const response = await fetchFn({
                ...params,
                page,
                page_size: 100,
            });
            allRecords.push(...response.records);
            this.logger.log(`Fetched page ${page}: ${response.records.length} records (total so far: ${allRecords.length})`);
            if (response.next_cursor) {
                page = response.next_cursor;
            }
            else {
                hasMore = false;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return allRecords;
    }
    async getAllOfficialChannelMessages(params) {
        return this.getAllMessages((p) => this.getOfficialChannelMessages(p), params);
    }
    async getAllTicketComments(params) {
        return this.getAllMessages((p) => this.getTicketComments(p), params);
    }
    async getEmployeeTicketHistory(params) {
        try {
            const response = await axios_1.default.get(`${this.BASE_URL}/api/v1/person-data/employee-ticket-history`, {
                params: {
                    app_number: params.app_number,
                    updated_after: params.updated_after,
                    updated_before: params.updated_before,
                    page: params.page || 1,
                    page_size: params.page_size || 50,
                },
                timeout: 30000,
            });
            return response.data;
        }
        catch (error) {
            this.logger.error(`Failed to fetch ticket history for ${params.app_number}:`, error.message);
            throw error;
        }
    }
    async getAllEmployeeTicketHistory(params) {
        const allRecords = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
            const response = await this.getEmployeeTicketHistory({
                ...params,
                page,
                page_size: 50,
            });
            if (!response.success)
                break;
            allRecords.push(...response.records);
            this.logger.log(`Fetched ticket history page ${page} for ${params.app_number}: ${response.records.length} records`);
            hasMore = page < response.pagination.total_pages;
            page++;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return allRecords;
    }
    async getReviewsSince(updatedAfter) {
        const baseUrl = this.configService.get('externalApis.reviewSystem.url');
        const apiKey = this.configService.get('externalApis.reviewSystem.apiKey');
        if (!baseUrl) {
            this.logger.warn('REVIEW_SYSTEM_API_URL not configured, skipping review sync');
            return [];
        }
        try {
            const url = `${baseUrl}/api/reviews/since/placeholder`;
            this.logger.log(`Fetching reviews since ${updatedAfter} from ${baseUrl}`);
            const response = await axios_1.default.get(url, {
                params: { updated_after: updatedAfter },
                headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
                timeout: 30000,
            });
            const data = response.data;
            this.logger.log(`Fetched ${data.records?.length || 0} reviews from review-system`);
            return data.records || [];
        }
        catch (err) {
            try {
                const baseUrl2 = this.configService.get('externalApis.reviewSystem.url');
                const encodedTs = encodeURIComponent(updatedAfter);
                const url2 = `${baseUrl2}/api/reviews/since/${encodedTs}`;
                const response2 = await axios_1.default.get(url2, {
                    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
                    timeout: 30000,
                });
                const data2 = response2.data;
                this.logger.log(`Fetched ${data2.records?.length || 0} reviews (fallback path format)`);
                return data2.records || [];
            }
            catch (err2) {
                this.logger.error('Failed to fetch reviews from review-system:', err2.message);
                throw err2;
            }
        }
    }
};
exports.TicketApiService = TicketApiService;
exports.TicketApiService = TicketApiService = TicketApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TicketApiService);
//# sourceMappingURL=ticket-api.service.js.map