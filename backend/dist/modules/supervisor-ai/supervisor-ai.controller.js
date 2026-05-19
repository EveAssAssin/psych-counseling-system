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
exports.SupervisorAiController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const supervisor_ai_service_1 = require("./supervisor-ai.service");
let SupervisorAiController = class SupervisorAiController {
    constructor(svc) {
        this.svc = svc;
    }
    getPersonas() { return this.svc.getPersonas(); }
    updatePersona(id, dto) {
        return this.svc.updatePersona(id, dto);
    }
    getSessions(supervisorId) {
        return this.svc.getSessions(supervisorId);
    }
    createSession(dto) { return this.svc.createSession(dto); }
    getMessages(id) {
        return this.svc.getSessionMessages(id);
    }
    sendMessage(dto) { return this.svc.sendMessage(dto); }
    getEmployeeSummary(appNumber, supervisorId) {
        return this.svc.getEmployeeSummary(appNumber, supervisorId);
    }
};
exports.SupervisorAiController = SupervisorAiController;
__decorate([
    (0, common_1.Get)('personas'),
    (0, swagger_1.ApiOperation)({ summary: '取得所有 AI 人格設定' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SupervisorAiController.prototype, "getPersonas", null);
__decorate([
    (0, common_1.Patch)('personas/:id'),
    (0, swagger_1.ApiOperation)({ summary: '更新 AI 人格設定' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SupervisorAiController.prototype, "updatePersona", null);
__decorate([
    (0, common_1.Get)('sessions'),
    (0, swagger_1.ApiOperation)({ summary: '取得主管的 AI 對話列表' }),
    __param(0, (0, common_1.Query)('supervisor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SupervisorAiController.prototype, "getSessions", null);
__decorate([
    (0, common_1.Post)('sessions'),
    (0, swagger_1.ApiOperation)({ summary: '建立新 AI 對話 session' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupervisorAiController.prototype, "createSession", null);
__decorate([
    (0, common_1.Get)('sessions/:id/messages'),
    (0, swagger_1.ApiOperation)({ summary: '取得 session 的訊息歷史' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SupervisorAiController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('chat'),
    (0, swagger_1.ApiOperation)({ summary: '傳送訊息並取得 AI 回應' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupervisorAiController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Get)('employee-summary/:appNumber'),
    (0, swagger_1.ApiOperation)({ summary: '取得人員完整資料彙整（隨手記＋對話＋評價＋風險）' }),
    __param(0, (0, common_1.Param)('appNumber')),
    __param(1, (0, common_1.Query)('supervisor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SupervisorAiController.prototype, "getEmployeeSummary", null);
exports.SupervisorAiController = SupervisorAiController = __decorate([
    (0, swagger_1.ApiTags)('supervisor-ai'),
    (0, common_1.Controller)('supervisor-hub/ai'),
    __metadata("design:paramtypes", [supervisor_ai_service_1.SupervisorAiService])
], SupervisorAiController);
//# sourceMappingURL=supervisor-ai.controller.js.map