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
exports.ConversationResponseDto = exports.SearchConversationDto = exports.UpdateConversationDto = exports.CreateConversationWithFileDto = exports.CreateConversationDto = exports.Priority = exports.IntakeStatus = exports.IntakeSourceType = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
var IntakeSourceType;
(function (IntakeSourceType) {
    IntakeSourceType["MANUAL_TEXT"] = "manual_text";
    IntakeSourceType["PDF"] = "pdf";
    IntakeSourceType["DOCX"] = "docx";
    IntakeSourceType["IMAGE_OCR"] = "image_ocr";
    IntakeSourceType["EXTERNAL_SYNC"] = "external_sync";
    IntakeSourceType["OFFICIAL_CHANNEL"] = "official_channel";
})(IntakeSourceType || (exports.IntakeSourceType = IntakeSourceType = {}));
var IntakeStatus;
(function (IntakeStatus) {
    IntakeStatus["PENDING"] = "pending";
    IntakeStatus["EXTRACTING"] = "extracting";
    IntakeStatus["EXTRACTED"] = "extracted";
    IntakeStatus["ANALYZING"] = "analyzing";
    IntakeStatus["COMPLETED"] = "completed";
    IntakeStatus["FAILED"] = "failed";
})(IntakeStatus || (exports.IntakeStatus = IntakeStatus = {}));
var Priority;
(function (Priority) {
    Priority["LOW"] = "low";
    Priority["NORMAL"] = "normal";
    Priority["HIGH"] = "high";
    Priority["URGENT"] = "urgent";
})(Priority || (exports.Priority = Priority = {}));
class CreateConversationDto {
}
exports.CreateConversationDto = CreateConversationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '員工 ID' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '對話日期時間' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "conversation_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '對話類型', example: '一對一面談' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "conversation_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '訪談者姓名' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "interviewer_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '背景說明' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "background_note", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '對話內容文字' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "raw_text", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: Priority,
        default: Priority.NORMAL,
        description: '優先等級',
    }),
    (0, class_validator_1.IsEnum)(Priority),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否需要追蹤', default: false }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateConversationDto.prototype, "need_followup", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '標籤', type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateConversationDto.prototype, "tags", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否立即分析', default: true }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateConversationDto.prototype, "auto_analyze", void 0);
class CreateConversationWithFileDto {
}
exports.CreateConversationWithFileDto = CreateConversationWithFileDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '員工 ID' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateConversationWithFileDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '對話日期時間' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateConversationWithFileDto.prototype, "conversation_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '對話類型' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateConversationWithFileDto.prototype, "conversation_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '訪談者姓名' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateConversationWithFileDto.prototype, "interviewer_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '背景說明' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateConversationWithFileDto.prototype, "background_note", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: Priority, default: Priority.NORMAL }),
    (0, class_validator_1.IsEnum)(Priority),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateConversationWithFileDto.prototype, "priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateConversationWithFileDto.prototype, "need_followup", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], CreateConversationWithFileDto.prototype, "tags", void 0);
class UpdateConversationDto {
}
exports.UpdateConversationDto = UpdateConversationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '對話日期時間' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateConversationDto.prototype, "conversation_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '對話類型' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateConversationDto.prototype, "conversation_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '訪談者姓名' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateConversationDto.prototype, "interviewer_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '背景說明' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateConversationDto.prototype, "background_note", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: Priority }),
    (0, class_validator_1.IsEnum)(Priority),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateConversationDto.prototype, "priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateConversationDto.prototype, "need_followup", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], UpdateConversationDto.prototype, "tags", void 0);
class SearchConversationDto {
}
exports.SearchConversationDto = SearchConversationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '員工 ID' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchConversationDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: IntakeStatus }),
    (0, class_validator_1.IsEnum)(IntakeStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchConversationDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: Priority }),
    (0, class_validator_1.IsEnum)(Priority),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchConversationDto.prototype, "priority", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], SearchConversationDto.prototype, "need_followup", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '開始日期' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchConversationDto.prototype, "date_from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '結束日期' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchConversationDto.prototype, "date_to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 20 }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], SearchConversationDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], SearchConversationDto.prototype, "offset", void 0);
class ConversationResponseDto {
}
exports.ConversationResponseDto = ConversationResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: IntakeSourceType }),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "source_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "conversation_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "conversation_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "interviewer_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "background_note", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "raw_text", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "extracted_text", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: Priority }),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "priority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ConversationResponseDto.prototype, "need_followup", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    __metadata("design:type", Array)
], ConversationResponseDto.prototype, "tags", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: IntakeStatus }),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "intake_status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "created_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ConversationResponseDto.prototype, "updated_at", void 0);
//# sourceMappingURL=conversations.dto.js.map