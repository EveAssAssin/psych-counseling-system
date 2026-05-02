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
exports.TicketHistoryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const ticket_history_service_1 = require("./ticket-history.service");
let TicketHistoryController = class TicketHistoryController {
    constructor(ticketHistoryService) {
        this.ticketHistoryService = ticketHistoryService;
    }
    async getByEmployeeId(employeeId, limit) {
        return this.ticketHistoryService.getByEmployeeId(employeeId, limit);
    }
    async getByAppNumber(appNumber, limit) {
        return this.ticketHistoryService.getByEmployeeAppNumber(appNumber, limit);
    }
    async getStats(appNumber) {
        return this.ticketHistoryService.getStatsByEmployeeAppNumber(appNumber);
    }
    async getConversations(ticketId) {
        return this.ticketHistoryService.getConversationsByTicketId(ticketId);
    }
    async getByTicketId(ticketId) {
        return this.ticketHistoryService.getByTicketId(ticketId);
    }
};
exports.TicketHistoryController = TicketHistoryController;
__decorate([
    (0, common_1.Get)('employee/:employeeId'),
    (0, swagger_1.ApiOperation)({ summary: '依員工 ID 取得工單歷史' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '工單歷史列表' }),
    __param(0, (0, common_1.Param)('employeeId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], TicketHistoryController.prototype, "getByEmployeeId", null);
__decorate([
    (0, common_1.Get)('by-app-number/:appNumber'),
    (0, swagger_1.ApiOperation)({ summary: '依 APP Number 取得工單歷史' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '工單歷史列表' }),
    __param(0, (0, common_1.Param)('appNumber')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], TicketHistoryController.prototype, "getByAppNumber", null);
__decorate([
    (0, common_1.Get)('stats/:appNumber'),
    (0, swagger_1.ApiOperation)({ summary: '取得員工工單統計' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '工單統計摘要' }),
    __param(0, (0, common_1.Param)('appNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TicketHistoryController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('ticket/:ticketId/conversations'),
    (0, swagger_1.ApiOperation)({ summary: '取得工單對話時間軸' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '對話事件列表' }),
    __param(0, (0, common_1.Param)('ticketId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], TicketHistoryController.prototype, "getConversations", null);
__decorate([
    (0, common_1.Get)(':ticketId'),
    (0, swagger_1.ApiOperation)({ summary: '依工單 ID 取得單張工單' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '工單詳情' }),
    __param(0, (0, common_1.Param)('ticketId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], TicketHistoryController.prototype, "getByTicketId", null);
exports.TicketHistoryController = TicketHistoryController = __decorate([
    (0, swagger_1.ApiTags)('ticket-history'),
    (0, common_1.Controller)('ticket-history'),
    __metadata("design:paramtypes", [ticket_history_service_1.TicketHistoryService])
], TicketHistoryController);
//# sourceMappingURL=ticket-history.controller.js.map