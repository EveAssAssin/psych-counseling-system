"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TicketApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketApiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
let TicketApiService = TicketApiService_1 = class TicketApiService {
    constructor() {
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
};
exports.TicketApiService = TicketApiService;
exports.TicketApiService = TicketApiService = TicketApiService_1 = __decorate([
    (0, common_1.Injectable)()
], TicketApiService);
//# sourceMappingURL=ticket-api.service.js.map