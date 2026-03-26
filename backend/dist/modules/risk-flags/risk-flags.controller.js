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
exports.RiskFlagsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const risk_flags_service_1 = require("./risk-flags.service");
let RiskFlagsController = class RiskFlagsController {
    constructor(riskFlagsService) {
        this.riskFlagsService = riskFlagsService;
    }
    async getOpenFlags(severity, riskType, employeeId, limit, offset) {
        return this.riskFlagsService.getOpenFlags({
            severity,
            risk_type: riskType,
            employee_id: employeeId,
            limit,
            offset,
        });
    }
    async getHighRiskFlags(limit) {
        return this.riskFlagsService.getHighRiskFlags(limit);
    }
    async getStats() {
        return this.riskFlagsService.getStats();
    }
    async findOne(id) {
        return this.riskFlagsService.findById(id);
    }
    async findByEmployee(employeeId) {
        return this.riskFlagsService.findByEmployee(employeeId);
    }
    async acknowledge(id, userId) {
        return this.riskFlagsService.acknowledge(id, userId);
    }
    async startProgress(id, assignedTo) {
        return this.riskFlagsService.startProgress(id, assignedTo);
    }
    async resolve(id, body) {
        return this.riskFlagsService.resolve(id, body.user_id, body.resolution_note);
    }
    async markAsFalsePositive(id, body) {
        return this.riskFlagsService.markAsFalsePositive(id, body.user_id, body.note);
    }
};
exports.RiskFlagsController = RiskFlagsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '取得開放的風險標記' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '風險標記列表' }),
    __param(0, (0, common_1.Query)('severity')),
    __param(1, (0, common_1.Query)('risk_type')),
    __param(2, (0, common_1.Query)('employee_id')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], RiskFlagsController.prototype, "getOpenFlags", null);
__decorate([
    (0, common_1.Get)('high-risk'),
    (0, swagger_1.ApiOperation)({ summary: '取得高風險標記（critical + high）' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '高風險標記列表' }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], RiskFlagsController.prototype, "getHighRiskFlags", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: '取得風險統計' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '統計資料' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], RiskFlagsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '取得單一風險標記' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '風險標記' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RiskFlagsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId'),
    (0, swagger_1.ApiOperation)({ summary: '取得員工的風險標記' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '風險標記列表' }),
    __param(0, (0, common_1.Param)('employeeId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RiskFlagsController.prototype, "findByEmployee", null);
__decorate([
    (0, common_1.Patch)(':id/acknowledge'),
    (0, swagger_1.ApiOperation)({ summary: '確認風險標記' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '更新成功' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)('user_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RiskFlagsController.prototype, "acknowledge", null);
__decorate([
    (0, common_1.Patch)(':id/start-progress'),
    (0, swagger_1.ApiOperation)({ summary: '開始處理風險標記' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '更新成功' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)('assigned_to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RiskFlagsController.prototype, "startProgress", null);
__decorate([
    (0, common_1.Patch)(':id/resolve'),
    (0, swagger_1.ApiOperation)({ summary: '解決風險標記' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '更新成功' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RiskFlagsController.prototype, "resolve", null);
__decorate([
    (0, common_1.Patch)(':id/false-positive'),
    (0, swagger_1.ApiOperation)({ summary: '標記為誤報' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '更新成功' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RiskFlagsController.prototype, "markAsFalsePositive", null);
exports.RiskFlagsController = RiskFlagsController = __decorate([
    (0, swagger_1.ApiTags)('risk-flags'),
    (0, common_1.Controller)('risk-flags'),
    __metadata("design:paramtypes", [risk_flags_service_1.RiskFlagsService])
], RiskFlagsController);
//# sourceMappingURL=risk-flags.controller.js.map