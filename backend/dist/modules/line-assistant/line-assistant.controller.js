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
exports.LineAssistantController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const line_assistant_service_1 = require("./line-assistant.service");
const line_assistant_dto_1 = require("./line-assistant.dto");
let LineAssistantController = class LineAssistantController {
    constructor(svc) {
        this.svc = svc;
    }
    getConversations(limit, offset, search) {
        return this.svc.getConversationList({
            limit: limit ? parseInt(String(limit), 10) : 30,
            offset: offset ? parseInt(String(offset), 10) : 0,
            search,
        });
    }
    getThreadMessages(threadId) {
        return this.svc.getThreadMessages(threadId);
    }
    generateSuggestion(dto) {
        return this.svc.generateAiSuggestion(dto);
    }
    sendReply(dto) {
        return this.svc.sendReply(dto);
    }
    saveDraft(dto) {
        return this.svc.saveDraft(dto);
    }
    getGuidelines() { return this.svc.getGuidelines(); }
    createGuideline(dto) { return this.svc.createGuideline(dto); }
    updateGuideline(id, dto) {
        return this.svc.updateGuideline(id, dto);
    }
    deleteGuideline(id) { return this.svc.deleteGuideline(id); }
    getAutoReplySettings() { return this.svc.getAutoReplySettings(); }
    updateAutoReplySettings(dto) {
        return this.svc.updateAutoReplySettings(dto);
    }
    isOffHours() { return this.svc.isOffHours().then(v => ({ is_off_hours: v })); }
    insertHistorical(dto) {
        return this.svc.insertHistoricalMessage(dto);
    }
    toggleSystemMessage(id, dto) {
        return this.svc.toggleSystemMessage(id, dto.is_system_message);
    }
    getReplyLogs(threadId, status, limit, offset) {
        return this.svc.getReplyLogs({
            thread_id: threadId,
            status,
            limit: limit ? parseInt(String(limit), 10) : 20,
            offset: offset ? parseInt(String(offset), 10) : 0,
        });
    }
};
exports.LineAssistantController = LineAssistantController;
__decorate([
    (0, common_1.Get)('conversations'),
    (0, swagger_1.ApiOperation)({ summary: '取得 LINE 會話列表' }),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "getConversations", null);
__decorate([
    (0, common_1.Get)('conversations/:threadId/messages'),
    (0, swagger_1.ApiOperation)({ summary: '取得單一 thread 的所有訊息' }),
    __param(0, (0, common_1.Param)('threadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "getThreadMessages", null);
__decorate([
    (0, common_1.Post)('suggest'),
    (0, swagger_1.ApiOperation)({ summary: '生成 AI 回覆建議' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [line_assistant_dto_1.GenerateAiSuggestionDto]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "generateSuggestion", null);
__decorate([
    (0, common_1.Post)('send'),
    (0, swagger_1.ApiOperation)({ summary: '送出回覆' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [line_assistant_dto_1.SendReplyDto]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "sendReply", null);
__decorate([
    (0, common_1.Post)('draft'),
    (0, swagger_1.ApiOperation)({ summary: '儲存草稿' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [line_assistant_dto_1.SaveDraftDto]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "saveDraft", null);
__decorate([
    (0, common_1.Get)('guidelines'),
    (0, swagger_1.ApiOperation)({ summary: '取得所有公司規範' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "getGuidelines", null);
__decorate([
    (0, common_1.Post)('guidelines'),
    (0, swagger_1.ApiOperation)({ summary: '新增公司規範' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [line_assistant_dto_1.CreateGuidelineDto]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "createGuideline", null);
__decorate([
    (0, common_1.Patch)('guidelines/:id'),
    (0, swagger_1.ApiOperation)({ summary: '更新公司規範' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, line_assistant_dto_1.UpdateGuidelineDto]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "updateGuideline", null);
__decorate([
    (0, common_1.Delete)('guidelines/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: '刪除公司規範' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "deleteGuideline", null);
__decorate([
    (0, common_1.Get)('auto-reply/settings'),
    (0, swagger_1.ApiOperation)({ summary: '取得自動回覆設定' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "getAutoReplySettings", null);
__decorate([
    (0, common_1.Patch)('auto-reply/settings'),
    (0, swagger_1.ApiOperation)({ summary: '更新自動回覆設定' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [line_assistant_dto_1.UpdateAutoReplySettingsDto]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "updateAutoReplySettings", null);
__decorate([
    (0, common_1.Get)('auto-reply/off-hours'),
    (0, swagger_1.ApiOperation)({ summary: '檢查目前是否為非辦公時間' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "isOffHours", null);
__decorate([
    (0, common_1.Post)('insert-historical'),
    (0, swagger_1.ApiOperation)({ summary: '補入歷史主管回覆（帶自訂時間）' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [line_assistant_dto_1.InsertHistoricalMessageDto]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "insertHistorical", null);
__decorate([
    (0, common_1.Patch)('messages/:id/system-flag'),
    (0, swagger_1.ApiOperation)({ summary: '標記/取消標記為系統訊息（自動回覆、選單等）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, line_assistant_dto_1.ToggleSystemMessageDto]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "toggleSystemMessage", null);
__decorate([
    (0, common_1.Get)('logs'),
    (0, swagger_1.ApiOperation)({ summary: '查詢回覆記錄' }),
    __param(0, (0, common_1.Query)('thread_id')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, Number]),
    __metadata("design:returntype", void 0)
], LineAssistantController.prototype, "getReplyLogs", null);
exports.LineAssistantController = LineAssistantController = __decorate([
    (0, swagger_1.ApiTags)('line-assistant'),
    (0, common_1.Controller)('line-assistant'),
    __metadata("design:paramtypes", [line_assistant_service_1.LineAssistantService])
], LineAssistantController);
//# sourceMappingURL=line-assistant.controller.js.map