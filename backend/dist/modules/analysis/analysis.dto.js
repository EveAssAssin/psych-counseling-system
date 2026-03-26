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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchAnalysisDto = exports.AnalysisResponseDto = exports.RunAnalysisDto = exports.RiskLevel = exports.StressLevel = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
var StressLevel;
(function (StressLevel) {
    StressLevel["LOW"] = "low";
    StressLevel["MODERATE"] = "moderate";
    StressLevel["HIGH"] = "high";
    StressLevel["CRITICAL"] = "critical";
})(StressLevel || (exports.StressLevel = StressLevel = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["LOW"] = "low";
    RiskLevel["MODERATE"] = "moderate";
    RiskLevel["HIGH"] = "high";
    RiskLevel["CRITICAL"] = "critical";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
class RunAnalysisDto {
}
exports.RunAnalysisDto = RunAnalysisDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '對話 ID' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RunAnalysisDto.prototype, "conversation_intake_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否強制重新分析' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], RunAnalysisDto.prototype, "force", void 0);
class AnalysisResponseDto {
}
exports.AnalysisResponseDto = AnalysisResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AnalysisResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AnalysisResponseDto.prototype, "conversation_intake_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AnalysisResponseDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], AnalysisResponseDto.prototype, "current_psychological_state", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: StressLevel }),
    __metadata("design:type", String)
], AnalysisResponseDto.prototype, "stress_level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: RiskLevel }),
    __metadata("design:type", String)
], AnalysisResponseDto.prototype, "risk_level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], AnalysisResponseDto.prototype, "summary", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    __metadata("design:type", Array)
], AnalysisResponseDto.prototype, "key_topics", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    __metadata("design:type", Array)
], AnalysisResponseDto.prototype, "observations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    __metadata("design:type", Array)
], AnalysisResponseDto.prototype, "suggested_actions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    __metadata("design:type", Array)
], AnalysisResponseDto.prototype, "taboo_topics", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    __metadata("design:type", Array)
], AnalysisResponseDto.prototype, "interviewer_question_suggestions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], AnalysisResponseDto.prototype, "followup_needed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], AnalysisResponseDto.prototype, "followup_suggested_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], AnalysisResponseDto.prototype, "supervisor_involvement", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], AnalysisResponseDto.prototype, "next_talk_focus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], AnalysisResponseDto.prototype, "created_at", void 0);
class SearchAnalysisDto {
}
exports.SearchAnalysisDto = SearchAnalysisDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchAnalysisDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: RiskLevel }),
    (0, class_validator_1.IsEnum)(RiskLevel),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchAnalysisDto.prototype, "risk_level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: StressLevel }),
    (0, class_validator_1.IsEnum)(StressLevel),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchAnalysisDto.prototype, "stress_level", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], SearchAnalysisDto.prototype, "followup_needed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], SearchAnalysisDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], SearchAnalysisDto.prototype, "offset", void 0);
//# sourceMappingURL=analysis.dto.js.map