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
exports.EmployeeSyncController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const employee_sync_service_1 = require("./employee-sync.service");
let EmployeeSyncController = class EmployeeSyncController {
    constructor(syncService) {
        this.syncService = syncService;
    }
    async syncStores() {
        const result = await this.syncService.syncStoreEmployees();
        return { success: true, data: result };
    }
    async syncBackend() {
        const result = await this.syncService.syncBackendEmployees();
        return { success: true, data: result };
    }
    async syncAll() {
        const result = await this.syncService.syncAll();
        return { success: true, data: result };
    }
    async getStats() {
        const stats = await this.syncService.getStats();
        return { success: true, data: stats };
    }
};
exports.EmployeeSyncController = EmployeeSyncController;
__decorate([
    (0, common_1.Post)('stores'),
    (0, swagger_1.ApiOperation)({ summary: '同步門市員工' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmployeeSyncController.prototype, "syncStores", null);
__decorate([
    (0, common_1.Post)('backend'),
    (0, swagger_1.ApiOperation)({ summary: '同步後勤人員' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmployeeSyncController.prototype, "syncBackend", null);
__decorate([
    (0, common_1.Post)('all'),
    (0, swagger_1.ApiOperation)({ summary: '完整同步（門市+後勤）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmployeeSyncController.prototype, "syncAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: '取得同步統計' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmployeeSyncController.prototype, "getStats", null);
exports.EmployeeSyncController = EmployeeSyncController = __decorate([
    (0, swagger_1.ApiTags)('employee-sync'),
    (0, common_1.Controller)('employee-sync'),
    __metadata("design:paramtypes", [employee_sync_service_1.EmployeeSyncService])
], EmployeeSyncController);
//# sourceMappingURL=employee-sync.controller.js.map