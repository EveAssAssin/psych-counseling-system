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
exports.ListCasesQueryDto = exports.TodayTasksQueryDto = exports.UpsertHolidayDto = exports.UpsertStateTagDto = exports.CreateExecutionDto = exports.UpdatePlanItemDto = exports.UpdateCaseDto = exports.AdjustedPlanItemDto = exports.ConfirmCaseDto = exports.CreateCaseDraftDto = exports.COUNSELING_METHODS = exports.PLAN_ITEM_STATUSES = exports.CASE_STATUSES = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
exports.CASE_STATUSES = ['planning', 'active', 'paused', 'completed', 'archived'];
exports.PLAN_ITEM_STATUSES = ['pending', 'done', 'skipped', 'rescheduled'];
exports.COUNSELING_METHODS = ['phone', 'face_to_face', 'line_text', 'observation', 'group', 'written'];
class CreateCaseDraftDto {
}
exports.CreateCaseDraftDto = CreateCaseDraftDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '目標員工 app_number' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCaseDraftDto.prototype, "employee_app_number", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '建案輔導員 ID（authorized_supervisors.id）' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateCaseDraftDto.prototype, "supervisor_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '狀態標籤 code 陣列', type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateCaseDraftDto.prototype, "state_tag_codes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '狀態自由文字補充' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCaseDraftDto.prototype, "state_description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '輔導目標' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCaseDraftDto.prototype, "goal", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '開始日期 YYYY-MM-DD' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateCaseDraftDto.prototype, "start_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '預計結束日期 YYYY-MM-DD' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateCaseDraftDto.prototype, "target_end_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '可用方法陣列', type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateCaseDraftDto.prototype, "allowed_methods", void 0);
class ConfirmCaseDto {
}
exports.ConfirmCaseDto = ConfirmCaseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '草稿時拿到的 draftToken（暫存 key）' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConfirmCaseDto.prototype, "draft_token", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '輔導員調整後的 plan_items（覆蓋 AI 草稿）' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], ConfirmCaseDto.prototype, "adjusted_plan_items", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '輔導員調整後的整體計畫摘要' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConfirmCaseDto.prototype, "adjusted_summary", void 0);
class AdjustedPlanItemDto {
}
exports.AdjustedPlanItemDto = AdjustedPlanItemDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AdjustedPlanItemDto.prototype, "scheduled_date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AdjustedPlanItemDto.prototype, "sequence", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustedPlanItemDto.prototype, "method", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustedPlanItemDto.prototype, "objective", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], AdjustedPlanItemDto.prototype, "recommended_actions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AdjustedPlanItemDto.prototype, "estimated_minutes", void 0);
class UpdateCaseDto {
}
exports.UpdateCaseDto = UpdateCaseDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCaseDto.prototype, "goal", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCaseDto.prototype, "state_description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateCaseDto.prototype, "target_end_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateCaseDto.prototype, "allowed_methods", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CASE_STATUSES),
    __metadata("design:type", String)
], UpdateCaseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCaseDto.prototype, "closing_summary", void 0);
class UpdatePlanItemDto {
}
exports.UpdatePlanItemDto = UpdatePlanItemDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdatePlanItemDto.prototype, "scheduled_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePlanItemDto.prototype, "method", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePlanItemDto.prototype, "objective", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdatePlanItemDto.prototype, "recommended_actions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdatePlanItemDto.prototype, "estimated_minutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PLAN_ITEM_STATUSES),
    __metadata("design:type", String)
], UpdatePlanItemDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePlanItemDto.prototype, "reschedule_reason", void 0);
class CreateExecutionDto {
}
exports.CreateExecutionDto = CreateExecutionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '對應的 plan_item_id；無對應排程可不填' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateExecutionDto.prototype, "plan_item_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExecutionDto.prototype, "actual_method", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateExecutionDto.prototype, "duration_minutes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '經過描述' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExecutionDto.prototype, "what_happened", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExecutionDto.prototype, "employee_reaction", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExecutionDto.prototype, "next_action_hint", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '員工當下情緒 1-5' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], CreateExecutionDto.prototype, "mood_score", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateExecutionDto.prototype, "attachments", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateExecutionDto.prototype, "recorded_by", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateExecutionDto.prototype, "recorded_by_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateExecutionDto.prototype, "executed_at", void 0);
class UpsertStateTagDto {
}
exports.UpsertStateTagDto = UpsertStateTagDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertStateTagDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertStateTagDto.prototype, "label", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertStateTagDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertStateTagDto.prototype, "ai_prompt_hint", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['low', 'moderate', 'high', 'critical']),
    __metadata("design:type", String)
], UpsertStateTagDto.prototype, "severity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpsertStateTagDto.prototype, "default_duration_days", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpsertStateTagDto.prototype, "sort_order", void 0);
class UpsertHolidayDto {
}
exports.UpsertHolidayDto = UpsertHolidayDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpsertHolidayDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertHolidayDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['national', 'company', 'makeup_workday']),
    __metadata("design:type", String)
], UpsertHolidayDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertHolidayDto.prototype, "notes", void 0);
class TodayTasksQueryDto {
}
exports.TodayTasksQueryDto = TodayTasksQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '指定日期，預設今日 YYYY-MM-DD' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], TodayTasksQueryDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '指定輔導員，預設不限' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TodayTasksQueryDto.prototype, "supervisor_id", void 0);
class ListCasesQueryDto {
}
exports.ListCasesQueryDto = ListCasesQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListCasesQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ListCasesQueryDto.prototype, "supervisor_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListCasesQueryDto.prototype, "employee_app_number", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListCasesQueryDto.prototype, "state_tag_code", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ListCasesQueryDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ListCasesQueryDto.prototype, "offset", void 0);
//# sourceMappingURL=counseling-cases.dto.js.map