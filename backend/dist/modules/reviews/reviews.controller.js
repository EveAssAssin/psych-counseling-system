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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewResponseController = exports.ReviewsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reviews_service_1 = require("./reviews.service");
const reviews_dto_1 = require("./reviews.dto");
let ReviewsController = class ReviewsController {
    constructor(reviewsService) {
        this.reviewsService = reviewsService;
    }
    async create(dto) {
        try {
            const review = await this.reviewsService.create(dto);
            return {
                success: true,
                data: review,
            };
        }
        catch (error) {
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async search(dto) {
        const result = await this.reviewsService.search(dto);
        return {
            success: true,
            ...result,
        };
    }
    async getStats() {
        const stats = await this.reviewsService.getStats();
        return {
            success: true,
            data: stats,
        };
    }
    async getByEmployee(employeeId, limit) {
        const reviews = await this.reviewsService.findByEmployee(employeeId, limit);
        return {
            success: true,
            data: reviews,
        };
    }
    async getEmployeeStats(employeeId) {
        const stats = await this.reviewsService.getEmployeeStats(employeeId);
        return {
            success: true,
            data: stats,
        };
    }
    async getById(id) {
        try {
            const review = await this.reviewsService.findById(id);
            const [attachments, responses] = await Promise.all([
                this.reviewsService.getAttachments(id),
                this.reviewsService.getResponses(id),
            ]);
            return {
                success: true,
                data: {
                    ...review,
                    attachments,
                    responses,
                },
            };
        }
        catch (error) {
            if (error.status === 404) {
                throw error;
            }
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async addResponse(id, body) {
        try {
            const response = await this.reviewsService.addReviewerResponse(id, body.content, body.reviewer_name || '公關部');
            return {
                success: true,
                data: response,
            };
        }
        catch (error) {
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async close(id, body) {
        try {
            const review = await this.reviewsService.close(id, body.closed_by || null, body.close_note);
            return {
                success: true,
                data: review,
            };
        }
        catch (error) {
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
};
exports.ReviewsController = ReviewsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '建立評價/客訴' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '建立成功' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reviews_dto_1.CreateReviewDto]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '搜尋評價' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '評價列表' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reviews_dto_1.SearchReviewDto]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: '取得評價統計' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '統計資料' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId'),
    (0, swagger_1.ApiOperation)({ summary: '取得員工的評價列表' }),
    (0, swagger_1.ApiParam)({ name: 'employeeId', description: '員工 ID' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false }),
    __param(0, (0, common_1.Param)('employeeId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getByEmployee", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId/stats'),
    (0, swagger_1.ApiOperation)({ summary: '取得員工的評價統計' }),
    (0, swagger_1.ApiParam)({ name: 'employeeId', description: '員工 ID' }),
    __param(0, (0, common_1.Param)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getEmployeeStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '取得單一評價' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '評價 ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "getById", null);
__decorate([
    (0, common_1.Post)(':id/respond'),
    (0, swagger_1.ApiOperation)({ summary: '公關部追問/回覆' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '評價 ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "addResponse", null);
__decorate([
    (0, common_1.Put)(':id/close'),
    (0, swagger_1.ApiOperation)({ summary: '結案評價' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '評價 ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReviewsController.prototype, "close", null);
exports.ReviewsController = ReviewsController = __decorate([
    (0, swagger_1.ApiTags)('reviews'),
    (0, common_1.Controller)('reviews'),
    __metadata("design:paramtypes", [reviews_service_1.ReviewsService])
], ReviewsController);
let ReviewResponseController = class ReviewResponseController {
    constructor(reviewsService) {
        this.reviewsService = reviewsService;
    }
    async getByToken(token) {
        try {
            const review = await this.reviewsService.findByToken(token);
            const [attachments, responses] = await Promise.all([
                this.reviewsService.getAttachments(review.id),
                this.reviewsService.getResponses(review.id),
            ]);
            return {
                success: true,
                data: {
                    id: review.id,
                    employee_name: review.employee_name,
                    review_type: review.review_type,
                    source: review.source,
                    urgency: review.urgency,
                    event_date: review.event_date,
                    content: review.content,
                    requires_response: review.requires_response,
                    status: review.status,
                    response_deadline: review.response_deadline,
                    created_at: review.created_at,
                    attachments: attachments.map(a => ({
                        id: a.id,
                        file_type: a.file_type,
                        file_url: a.file_url,
                        file_name: a.file_name,
                    })),
                    responses: responses.map(r => ({
                        id: r.id,
                        content: r.content,
                        responder_type: r.responder_type,
                        responder_name: r.responder_name,
                        created_at: r.created_at,
                    })),
                },
            };
        }
        catch (error) {
            if (error.status === 404) {
                throw new common_1.HttpException({ success: false, error: '無效的連結或評價不存在' }, common_1.HttpStatus.NOT_FOUND);
            }
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async submitResponse(token, dto) {
        try {
            const response = await this.reviewsService.submitResponse(token, dto);
            return {
                success: true,
                message: '回覆成功',
                data: response,
            };
        }
        catch (error) {
            throw new common_1.HttpException({ success: false, error: error.message }, common_1.HttpStatus.BAD_REQUEST);
        }
    }
};
exports.ReviewResponseController = ReviewResponseController;
__decorate([
    (0, common_1.Get)(':token'),
    (0, swagger_1.ApiOperation)({ summary: '用 token 取得評價內容（員工回覆用）' }),
    (0, swagger_1.ApiParam)({ name: 'token', description: '回覆用的 token' }),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReviewResponseController.prototype, "getByToken", null);
__decorate([
    (0, common_1.Post)(':token/respond'),
    (0, swagger_1.ApiOperation)({ summary: '員工提交回覆' }),
    (0, swagger_1.ApiParam)({ name: 'token', description: '回覆用的 token' }),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reviews_dto_1.CreateReviewResponseDto]),
    __metadata("design:returntype", Promise)
], ReviewResponseController.prototype, "submitResponse", null);
exports.ReviewResponseController = ReviewResponseController = __decorate([
    (0, swagger_1.ApiTags)('review-response'),
    (0, common_1.Controller)('review-response'),
    __metadata("design:paramtypes", [reviews_service_1.ReviewsService])
], ReviewResponseController);
//# sourceMappingURL=reviews.controller.js.map