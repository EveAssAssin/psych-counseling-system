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
const order_stats_service_1 = require("./order-stats.service");
let SyncController = class SyncController {
    constructor(syncService, orderStatsService) {
        this.syncService = syncService;
        this.orderStatsService = orderStatsService;
    }
    async syncEmployees(triggeredBy) {
        return this.syncService.syncEmployees(triggeredBy);
    }
    async syncDailyData(triggeredBy) {
        return this.syncService.syncDailyData(triggeredBy);
    }
    async syncOfficialChannel(triggeredBy, force) {
        return this.syncService.syncOfficialChannelMessages(triggeredBy, force === 'true');
    }
    async resetCursor(type) {
        return this.syncService.resetSyncCursor(type);
    }
    async syncTicketHistory(triggeredBy) {
        return this.syncService.syncTicketHistory(triggeredBy);
    }
    async syncReviewData(triggeredBy) {
        return this.syncService.syncReviewData(triggeredBy);
    }
    async syncCustomerFeedbackStats(triggeredBy) {
        return this.syncService.syncCustomerFeedbackStats(triggeredBy);
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
    async patchStoreNames() {
        return this.syncService.patchStoreNamesFromPayload();
    }
    async syncOrderStats() {
        return this.orderStatsService.syncRecentMonths();
    }
    async syncOrderStatsMonth(year, month) {
        return this.orderStatsService.syncMonthOrderStats(parseInt(year), parseInt(month));
    }
    async getOrderTrend(appNumber) {
        return this.orderStatsService.getEmployeeOrderTrend(appNumber);
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
    (0, swagger_1.ApiOperation)({ summary: '同步官方頻道訊息（LINE + 工單留言）。force=true 忽略 cursor 做全量重新同步' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '同步結果' }),
    __param(0, (0, common_1.Query)('triggered_by')),
    __param(1, (0, common_1.Query)('force')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncOfficialChannel", null);
__decorate([
    (0, common_1.Delete)('cursors/:type'),
    (0, swagger_1.ApiOperation)({ summary: '清除指定 sync cursor（重置後下次同步會做全量）。type: official-channel-line | official-channel-comments | ticket-history | review-data' }),
    __param(0, (0, common_1.Param)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "resetCursor", null);
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
    (0, common_1.Post)('customer-feedback-stats'),
    (0, swagger_1.ApiOperation)({ summary: '同步客戶回報統計（從 review-system /psych-sync/reviews）' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '同步結果' }),
    __param(0, (0, common_1.Query)('triggered_by')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncCustomerFeedbackStats", null);
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
__decorate([
    (0, common_1.Post)('patch-store-names'),
    (0, swagger_1.ApiOperation)({ summary: '從 source_payload 補充門市名稱（修復 store_name 為 null 的員工）' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '修復結果' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "patchStoreNames", null);
__decorate([
    (0, common_1.Post)('order-stats'),
    (0, swagger_1.ApiOperation)({ summary: '同步近 2 個月訂單業績統計（自動）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncOrderStats", null);
__decorate([
    (0, common_1.Post)('order-stats/:year/:month'),
    (0, swagger_1.ApiOperation)({ summary: '同步指定月份訂單業績統計' }),
    __param(0, (0, common_1.Param)('year')),
    __param(1, (0, common_1.Param)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "syncOrderStatsMonth", null);
__decorate([
    (0, common_1.Get)('order-stats/trend/:appNumber'),
    (0, swagger_1.ApiOperation)({ summary: '取得員工接單趨勢（近 6 個月）' }),
    __param(0, (0, common_1.Param)('appNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SyncController.prototype, "getOrderTrend", null);
exports.SyncController = SyncController = __decorate([
    (0, swagger_1.ApiTags)('sync'),
    (0, common_1.Controller)('sync'),
    __metadata("design:paramtypes", [sync_service_1.SyncService,
        order_stats_service_1.OrderStatsService])
], SyncController);
//# sourceMappingURL=sync.controller.js.map