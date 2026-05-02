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
exports.PeriodAnalysisController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const period_analysis_service_1 = require("./period-analysis.service");
let PeriodAnalysisController = class PeriodAnalysisController {
    constructor(service) {
        this.service = service;
    }
    async analyze(body) {
        return this.service.analyze(body);
    }
};
exports.PeriodAnalysisController = PeriodAnalysisController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '執行時段 AI 分析（熱門議題、高風險名單、時間軸摘要）' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PeriodAnalysisController.prototype, "analyze", null);
exports.PeriodAnalysisController = PeriodAnalysisController = __decorate([
    (0, swagger_1.ApiTags)('period-analysis'),
    (0, common_1.Controller)('period-analysis'),
    __metadata("design:paramtypes", [period_analysis_service_1.PeriodAnalysisService])
], PeriodAnalysisController);
//# sourceMappingURL=period-analysis.controller.js.map