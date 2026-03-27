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
exports.OfficialChannelController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const official_channel_service_1 = require("./official-channel.service");
let OfficialChannelController = class OfficialChannelController {
    constructor(officialChannelService) {
        this.officialChannelService = officialChannelService;
    }
    async search(employeeId, employeeAppNumber, channel, limit, offset) {
        return this.officialChannelService.search({
            employee_id: employeeId,
            employee_app_number: employeeAppNumber,
            channel,
            limit: limit ? Number(limit) : undefined,
            offset: offset ? Number(offset) : undefined,
        });
    }
    async getStats() {
        return this.officialChannelService.getStats();
    }
    async getByEmployeeId(employeeId, limit) {
        return this.officialChannelService.getByEmployeeId(employeeId, limit ? Number(limit) : undefined);
    }
    async getByAppNumber(appNumber, limit) {
        return this.officialChannelService.getByEmployeeAppNumber(appNumber, limit ? Number(limit) : undefined);
    }
    async getById(id) {
        return this.officialChannelService.getById(id);
    }
};
exports.OfficialChannelController = OfficialChannelController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '搜尋官方頻道訊息' }),
    (0, swagger_1.ApiQuery)({ name: 'employee_id', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'employee_app_number', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'channel', required: false, description: 'official-line 或 ticket-comment' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'offset', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '訊息列表' }),
    __param(0, (0, common_1.Query)('employee_id')),
    __param(1, (0, common_1.Query)('employee_app_number')),
    __param(2, (0, common_1.Query)('channel')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Number, Number]),
    __metadata("design:returntype", Promise)
], OfficialChannelController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: '取得統計資料' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '統計資料' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OfficialChannelController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId'),
    (0, swagger_1.ApiOperation)({ summary: '依員工 ID 取得訊息' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '訊息列表' }),
    __param(0, (0, common_1.Param)('employeeId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], OfficialChannelController.prototype, "getByEmployeeId", null);
__decorate([
    (0, common_1.Get)('by-app-number/:appNumber'),
    (0, swagger_1.ApiOperation)({ summary: '依員工 APP Number 取得訊息' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '訊息列表' }),
    __param(0, (0, common_1.Param)('appNumber')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], OfficialChannelController.prototype, "getByAppNumber", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '取得單一訊息' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '訊息詳情' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], OfficialChannelController.prototype, "getById", null);
exports.OfficialChannelController = OfficialChannelController = __decorate([
    (0, swagger_1.ApiTags)('official-channel'),
    (0, common_1.Controller)('official-channel'),
    __metadata("design:paramtypes", [official_channel_service_1.OfficialChannelService])
], OfficialChannelController);
//# sourceMappingURL=official-channel.controller.js.map