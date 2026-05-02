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
exports.SyncController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const sync_service_1 = require("./sync.service");
let SyncController = class SyncController {
    constructor(syncService) {
        this.syncService = syncService;
    }
    async syncEmployees(triggeredBy) {
        return this.syncService.syncEmployees(triggeredBy);
    }
    async syncDailyData(triggeredBy) {
        return this.syncService.syncDailyData(triggeredBy);
    }
    async syncOfficialChannel(triggeredBy) {
        return this.syncService.syncOfficialChannelMessages(triggeredBy);
    }
    async syncTicketHistory(triggeredBy) {
        return this.syncService.syncTicketHistory(triggeredBy);
    }
    async syncReviewData(triggeredBy) {
        return this.syncService.syncReviewData(triggeredBy);
    }
    async getSyncStatus() {
        return this.syncService.getSyncStatus();
    }
    async getSyncLogs(limit) {
        return this.syncService.getRecentSyncLogs(limit);
    }
    async getSyncLog(id) {
        return this.syncService.getSyncLog(id);
    }
};
exports.SyncController = SyncController;
__decorate([
    (0, common_1.Post)('employees'),
    (0, swagger_1.ApiOperation)({ summary: '執行員工主檔同步' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '同步結果' }),
    __param(0, (0, common_1.Query)('triggered_by')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncEmployees", null);
__decorate([
    (0, common_1.Post)('daily'),
    (0, swagger_1.ApiOperation)({ summary: '執行每日多來源資料同步' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '同步結果' }),
    __param(0, (0, common_1.Query)('triggered_by')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncDailyData", null);
__decorate([
    (0, common_1.Post)('official-channel'),
    (0, swagger_1.ApiOperation)({ summary: '同步官方頻道訊息（LINE + 工單留言）' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '同步結果' }),
    __param(0, (0, common_1.Query)('triggered_by')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncOfficialChannel", null);
__decorate([
    (0, common_1.Post)('ticket-history'),
    (0, swagger_1.ApiOperation)({ summary: '同步員工工單歷史' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '同步結果' }),
    __param(0, (0, common_1.Query)('triggered_by')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncTicketHistory", null);
__decorate([
    (0, common_1.Post)('review-data'),
    (0, swagger_1.ApiOperation)({ summary: '同步評價資料（reviews + 回覆對話）' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '同步結果' }),
    __param(0, (0, common_1.Query)('triggered_by')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncReviewData", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, swagger_1.ApiOperation)({ summary: '取得所有同步狀態（含最後同步時間）' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '同步狀態' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "getSyncStatus", null);
__decorate([
    (0, common_1.Get)('logs'),
    (0, swagger_1.ApiOperation)({ summary: '取得同步日誌' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '同步日誌列表' }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "getSyncLogs", null);
__decorate([
    (0, common_1.Get)('logs/:id'),
    (0, swagger_1.ApiOperation)({ summary: '取得單一同步日誌' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '同步日誌' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "getSyncLog", null);
exports.SyncController = SyncController = __decorate([
    (0, swagger_1.ApiTags)('sync'),
    (0, common_1.Controller)('sync'),
    __metadata("design:paramtypes", [sync_service_1.SyncService])
], SyncController);
//# sourceMappingURL=sync.controller.js.map