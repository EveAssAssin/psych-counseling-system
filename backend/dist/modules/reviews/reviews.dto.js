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
exports.STATUS_LABELS = exports.URGENCY_LABELS = exports.TYPE_LABELS = exports.SOURCE_LABELS = exports.ReviewListResponseDto = exports.ReviewResponseDto = exports.SearchReviewDto = exports.CreateReviewResponseDto = exports.UpdateReviewDto = exports.CreateReviewDto = exports.ReviewStatus = exports.Urgency = exports.ReviewType = exports.ReviewSource = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
var ReviewSource;
(function (ReviewSource) {
    ReviewSource["GOOGLE_MAP"] = "google_map";
    ReviewSource["FACEBOOK"] = "facebook";
    ReviewSource["PHONE"] = "phone";
    ReviewSource["APP"] = "app";
    ReviewSource["OTHER"] = "other";
})(ReviewSource || (exports.ReviewSource = ReviewSource = {}));
var ReviewType;
(function (ReviewType) {
    ReviewType["POSITIVE"] = "positive";
    ReviewType["NEGATIVE"] = "negative";
    ReviewType["OTHER"] = "other";
})(ReviewType || (exports.ReviewType = ReviewType = {}));
var Urgency;
(function (Urgency) {
    Urgency["URGENT_PLUS"] = "urgent_plus";
    Urgency["URGENT"] = "urgent";
    Urgency["NORMAL"] = "normal";
})(Urgency || (exports.Urgency = Urgency = {}));
var ReviewStatus;
(function (ReviewStatus) {
    ReviewStatus["PENDING"] = "pending";
    ReviewStatus["RESPONDED"] = "responded";
    ReviewStatus["CLOSED"] = "closed";
})(ReviewStatus || (exports.ReviewStatus = ReviewStatus = {}));
class CreateReviewDto {
}
exports.CreateReviewDto = CreateReviewDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '被指定處理的員工 ID' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否代理處理' }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateReviewDto.prototype, "is_proxy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '實際被評價員工 ID（如果知道）' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "actual_employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ReviewSource, description: '來源' }),
    (0, class_validator_1.IsEnum)(ReviewSource),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ReviewType, description: '評價類型' }),
    (0, class_validator_1.IsEnum)(ReviewType),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "review_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: Urgency, description: '緊急程度' }),
    (0, class_validator_1.IsEnum)(Urgency),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "urgency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '事件發生日期' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "event_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '完整說明給員工' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateReviewDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否需要回覆（僅 other 類型需指定）' }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateReviewDto.prototype, "requires_response", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '回覆期限（小時）' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateReviewDto.prototype, "response_deadline_hours", void 0);
class UpdateReviewDto {
}
exports.UpdateReviewDto = UpdateReviewDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ReviewStatus }),
    (0, class_validator_1.IsEnum)(ReviewStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateReviewDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateReviewDto.prototype, "close_note", void 0);
class CreateReviewResponseDto {
}
exports.CreateReviewResponseDto = CreateReviewResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '回覆內容' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateReviewResponseDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '回覆者類型' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateReviewResponseDto.prototype, "responder_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '回覆者名字' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateReviewResponseDto.prototype, "responder_name", void 0);
class SearchReviewDto {
}
exports.SearchReviewDto = SearchReviewDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchReviewDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ReviewType }),
    (0, class_validator_1.IsEnum)(ReviewType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchReviewDto.prototype, "review_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ReviewStatus }),
    (0, class_validator_1.IsEnum)(ReviewStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchReviewDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ReviewSource }),
    (0, class_validator_1.IsEnum)(ReviewSource),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchReviewDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], SearchReviewDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], SearchReviewDto.prototype, "offset", void 0);
class ReviewResponseDto {
}
exports.ReviewResponseDto = ReviewResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "employee_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "employee_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ReviewResponseDto.prototype, "is_proxy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "actual_employee_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ReviewSource }),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "source", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ReviewType }),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "review_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: Urgency }),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "urgency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "event_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], ReviewResponseDto.prototype, "requires_response", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ReviewStatus }),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "responded_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Number)
], ReviewResponseDto.prototype, "response_speed_hours", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ReviewResponseDto.prototype, "created_at", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Array)
], ReviewResponseDto.prototype, "attachments", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Array)
], ReviewResponseDto.prototype, "responses", void 0);
class ReviewListResponseDto {
}
exports.ReviewListResponseDto = ReviewListResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ReviewResponseDto] }),
    __metadata("design:type", Array)
], ReviewListResponseDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ReviewListResponseDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ReviewListResponseDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ReviewListResponseDto.prototype, "offset", void 0);
exports.SOURCE_LABELS = {
    [ReviewSource.GOOGLE_MAP]: 'Google MAP',
    [ReviewSource.FACEBOOK]: 'Facebook',
    [ReviewSource.PHONE]: '電話客服',
    [ReviewSource.APP]: 'APP 客服',
    [ReviewSource.OTHER]: '其他',
};
exports.TYPE_LABELS = {
    [ReviewType.POSITIVE]: '正評',
    [ReviewType.NEGATIVE]: '負評',
    [ReviewType.OTHER]: '其他',
};
exports.URGENCY_LABELS = {
    [Urgency.URGENT_PLUS]: '特急',
    [Urgency.URGENT]: '緊急',
    [Urgency.NORMAL]: '普通',
};
exports.STATUS_LABELS = {
    [ReviewStatus.PENDING]: '待處理',
    [ReviewStatus.RESPONDED]: '已回覆',
    [ReviewStatus.CLOSED]: '已結案',
};
//# sourceMappingURL=reviews.dto.js.map