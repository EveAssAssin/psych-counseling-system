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
exports.EmployeesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const employees_service_1 = require("./employees.service");
const employees_dto_1 = require("./employees.dto");
let EmployeesController = class EmployeesController {
    constructor(employeesService) {
        this.employeesService = employeesService;
    }
    async create(dto) {
        return this.employeesService.create(dto);
    }
    async search(dto) {
        return this.employeesService.search(dto);
    }
    async getStats() {
        return this.employeesService.getStats();
    }
    async findOne(id) {
        return this.employeesService.findById(id);
    }
    async findByAppNumber(appnumber) {
        const employee = await this.employeesService.findByAppNumber(appnumber);
        if (!employee) {
            return { found: false, message: `Employee not found: ${appnumber}` };
        }
        return employee;
    }
    async update(id, dto) {
        return this.employeesService.update(id, dto);
    }
    async delete(id) {
        await this.employeesService.softDelete(id);
    }
    async identify(body) {
        const employee = await this.employeesService.identify(body);
        if (!employee) {
            return { found: false, message: 'Employee not found with given identifiers' };
        }
        return { found: true, employee };
    }
    async bulkUpsert(body) {
        return this.employeesService.bulkUpsert(body.employees);
    }
};
exports.EmployeesController = EmployeesController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '建立員工' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '建立成功', type: employees_dto_1.EmployeeResponseDto }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [employees_dto_1.CreateEmployeeDto]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '搜尋員工' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '搜尋結果', type: employees_dto_1.EmployeeListResponseDto }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false, description: '搜尋關鍵字' }),
    (0, swagger_1.ApiQuery)({ name: 'store_id', required: false, description: '門市 ID' }),
    (0, swagger_1.ApiQuery)({ name: 'department', required: false, description: '部門' }),
    (0, swagger_1.ApiQuery)({ name: 'is_active', required: false, type: Boolean, description: '是否在職' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: '每頁筆數' }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false, type: Number, description: '偏移量' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [employees_dto_1.SearchEmployeeDto]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: '取得員工統計' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '統計資料' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '取得單一員工' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '員工 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '員工資料', type: employees_dto_1.EmployeeResponseDto }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '員工不存在' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('by-appnumber/:appnumber'),
    (0, swagger_1.ApiOperation)({ summary: '以 APP 編號取得員工' }),
    (0, swagger_1.ApiParam)({ name: 'appnumber', description: 'APP 員工編號' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '員工資料', type: employees_dto_1.EmployeeResponseDto }),
    __param(0, (0, common_1.Param)('appnumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "findByAppNumber", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '更新員工' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '員工 ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '更新成功', type: employees_dto_1.EmployeeResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, employees_dto_1.UpdateEmployeeDto]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: '刪除員工（軟刪除）' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '員工 ID' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: '刪除成功' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('identify'),
    (0, swagger_1.ApiOperation)({ summary: '對人識別' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '識別結果' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "identify", null);
__decorate([
    (0, common_1.Post)('bulk-upsert'),
    (0, swagger_1.ApiOperation)({ summary: '批量同步員工' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '同步結果' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EmployeesController.prototype, "bulkUpsert", null);
exports.EmployeesController = EmployeesController = __decorate([
    (0, swagger_1.ApiTags)('employees'),
    (0, common_1.Controller)('employees'),
    __metadata("design:paramtypes", [employees_service_1.EmployeesService])
], EmployeesController);
//# sourceMappingURL=employees.controller.js.map