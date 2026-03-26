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
exports.AnalysisController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const analysis_service_1 = require("./analysis.service");
const analysis_dto_1 = require("./analysis.dto");
let AnalysisController = class AnalysisController {
    constructor(analysisService) {
        this.analysisService = analysisService;
    }
    async runAnalysis(dto) {
        return this.analysisService.analyze(dto.conversation_intake_id, dto.force);
    }
    async runAnalysisForConversation(conversationId, force) {
        return this.analysisService.analyze(conversationId, force);
    }
    async search(dto) {
        return this.analysisService.search(dto);
    }
    async getHighRisk(limit) {
        return this.analysisService.getHighRiskAnalyses(limit);
    }
    async findOne(id) {
        return this.analysisService.findById(id);
    }
    async findByConversation(conversationId) {
        const result = await this.analysisService.findByConversationId(conversationId);
        if (!result) {
            return { found: false, message: 'Analysis not found for this conversation' };
        }
        return result;
    }
    async findByEmployee(employeeId) {
        return this.analysisService.findByEmployee(employeeId);
    }
    async getLatestByEmployee(employeeId) {
        const result = await this.analysisService.getLatestByEmployee(employeeId);
        if (!result) {
            return { found: false, message: 'No analysis found for this employee' };
        }
        return result;
    }
};
exports.AnalysisController = AnalysisController;
__decorate([
    (0, common_1.Post)('run'),
    (0, swagger_1.ApiOperation)({ summary: '執行 AI 分析' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '分析完成' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [analysis_dto_1.RunAnalysisDto]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "runAnalysis", null);
__decorate([
    (0, common_1.Post)('run/:conversationId'),
    (0, swagger_1.ApiOperation)({ summary: '對特定對話執行 AI 分析' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '分析完成' }),
    __param(0, (0, common_1.Param)('conversationId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('force')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "runAnalysisForConversation", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '搜尋分析結果' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '搜尋結果' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [analysis_dto_1.SearchAnalysisDto]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('high-risk'),
    (0, swagger_1.ApiOperation)({ summary: '取得高風險分析列表' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '高風險列表' }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "getHighRisk", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '取得單一分析結果' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '分析結果' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('conversation/:conversationId'),
    (0, swagger_1.ApiOperation)({ summary: '取得對話的分析結果' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '分析結果' }),
    __param(0, (0, common_1.Param)('conversationId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "findByConversation", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId'),
    (0, swagger_1.ApiOperation)({ summary: '取得員工的所有分析結果' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '分析列表' }),
    __param(0, (0, common_1.Param)('employeeId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "findByEmployee", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId/latest'),
    (0, swagger_1.ApiOperation)({ summary: '取得員工最新分析結果' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '最新分析結果' }),
    __param(0, (0, common_1.Param)('employeeId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "getLatestByEmployee", null);
exports.AnalysisController = AnalysisController = __decorate([
    (0, swagger_1.ApiTags)('analysis'),
    (0, common_1.Controller)('analysis'),
    __metadata("design:paramtypes", [analysis_service_1.AnalysisService])
], AnalysisController);
//# sourceMappingURL=analysis.controller.js.map