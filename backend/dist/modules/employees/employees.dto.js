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
exports.EmployeeListResponseDto = exports.EmployeeResponseDto = exports.SearchEmployeeDto = exports.UpdateEmployeeDto = exports.CreateEmployeeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateEmployeeDto {
}
exports.CreateEmployeeDto = CreateEmployeeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'APP 員工編號（主鍵）' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "employeeappnumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'ERP 員工編號' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "employeeerpid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '姓名' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '角色' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '職稱' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '門市 ID' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "store_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '門市名稱' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "store_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '部門' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "department", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Email' }),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '電話' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '到職日' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateEmployeeDto.prototype, "hire_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否在職', default: true }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateEmployeeDto.prototype, "is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否留停', default: false }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateEmployeeDto.prototype, "is_leave", void 0);
class UpdateEmployeeDto {
}
exports.UpdateEmployeeDto = UpdateEmployeeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'ERP 員工編號' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "employeeerpid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '姓名' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '角色' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '職稱' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '門市 ID' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "store_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '門市名稱' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "store_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '部門' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "department", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Email' }),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '電話' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否在職' }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateEmployeeDto.prototype, "is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否留停' }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateEmployeeDto.prototype, "is_leave", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '留停類型' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "leave_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '留停開始日' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "leave_start_date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '留停結束日' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateEmployeeDto.prototype, "leave_end_date", void 0);
class SearchEmployeeDto {
}
exports.SearchEmployeeDto = SearchEmployeeDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '搜尋關鍵字（姓名、編號）' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchEmployeeDto.prototype, "q", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '門市 ID' }),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchEmployeeDto.prototype, "store_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '部門' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SearchEmployeeDto.prototype, "department", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '是否在職' }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], SearchEmployeeDto.prototype, "is_active", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '每頁筆數', default: 20 }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], SearchEmployeeDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: '偏移量', default: 0 }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], SearchEmployeeDto.prototype, "offset", void 0);
class EmployeeResponseDto {
}
exports.EmployeeResponseDto = EmployeeResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeResponseDto.prototype, "employeeappnumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], EmployeeResponseDto.prototype, "employeeerpid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeResponseDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], EmployeeResponseDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], EmployeeResponseDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], EmployeeResponseDto.prototype, "store_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], EmployeeResponseDto.prototype, "store_name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], EmployeeResponseDto.prototype, "department", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EmployeeResponseDto.prototype, "is_active", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EmployeeResponseDto.prototype, "is_leave", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeResponseDto.prototype, "created_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], EmployeeResponseDto.prototype, "updated_at", void 0);
class EmployeeListResponseDto {
}
exports.EmployeeListResponseDto = EmployeeListResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [EmployeeResponseDto] }),
    __metadata("design:type", Array)
], EmployeeListResponseDto.prototype, "data", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], EmployeeListResponseDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], EmployeeListResponseDto.prototype, "limit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], EmployeeListResponseDto.prototype, "offset", void 0);
//# sourceMappingURL=employees.dto.js.map