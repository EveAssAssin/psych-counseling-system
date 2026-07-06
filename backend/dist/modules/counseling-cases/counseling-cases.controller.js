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
exports.CounselingCasesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const counseling_cases_service_1 = require("./counseling-cases.service");
const case_ai_service_1 = require("./case-ai.service");
const case_notifier_service_1 = require("./case-notifier.service");
const counseling_cases_dto_1 = require("./counseling-cases.dto");
let CounselingCasesController = class CounselingCasesController {
    constructor(svc, aiSvc, notifier) {
        this.svc = svc;
        this.aiSvc = aiSvc;
        this.notifier = notifier;
    }
    getEmployeeAttendance(appNumber, startDate, endDate) {
        return this.svc.getEmployeeAttendance(appNumber, startDate, endDate);
    }
    listSupervisors() {
        return this.svc.listActiveSupervisors();
    }
    listStateTags(includeInactive) {
        return this.svc.listStateTags(includeInactive === 'true');
    }
    upsertStateTag(dto) {
        return this.svc.upsertStateTag(dto);
    }
    deactivateStateTag(id) {
        return this.svc.deactivateStateTag(id);
    }
    listHolidays(year) {
        return this.svc.listHolidays(year ? parseInt(year, 10) : undefined);
    }
    upsertHoliday(dto) {
        return this.svc.upsertHoliday(dto);
    }
    deleteHoliday(date) {
        return this.svc.deleteHoliday(date);
    }
    getToday(query) {
        return this.svc.getTodayTasks(query);
    }
    getOverdue(supervisorId) {
        return this.svc.getOverdueTasks(supervisorId);
    }
    createDraft(dto) {
        return this.svc.createDraft(dto);
    }
    confirm(dto) {
        return this.svc.confirmCase(dto);
    }
    list(query) {
        return this.svc.listCases(query);
    }
    get(id) {
        return this.svc.getCase(id);
    }
    update(id, dto) {
        return this.svc.updateCase(id, dto);
    }
    close(id, body) {
        return this.svc.closeCase(id, body.closing_summary);
    }
    updatePlanItem(itemId, dto) {
        return this.svc.updatePlanItem(itemId, dto);
    }
    createExecution(id, dto) {
        return this.svc.createExecution(id, dto);
    }
    listExecutions(id) {
        return this.svc.listExecutions(id);
    }
    listAiSessions(id) {
        return this.aiSvc.listSessions(id);
    }
    openAiSession(id, body) {
        return this.aiSvc.getOrCreateSession(id, body.supervisor_identifier);
    }
    listAiMessages(sessionId, supervisorIdentifier) {
        return this.aiSvc.getMessages(sessionId, supervisorIdentifier);
    }
    sendAiMessage(sessionId, body) {
        return this.aiSvc.sendMessage(sessionId, body.supervisor_identifier, body.content);
    }
    bindLine(body) {
        return this.notifier.bindLineUserId(body.identifier, body.line_user_id);
    }
    unbindLine(identifier) {
        return this.notifier.unbindLineUserId(identifier);
    }
    notifyToday() {
        return this.notifier.pushTodayTasksToAll();
    }
    notifyTodayOne(supervisorId) {
        return this.notifier.pushTodayTasksToSupervisor(supervisorId);
    }
};
exports.CounselingCasesController = CounselingCasesController;
__decorate([
    (0, common_1.Get)('employee-attendance/:appNumber'),
    (0, swagger_1.ApiOperation)({ summary: '取得員工最近出勤狀況（含休假、請假），給輔導排程參考' }),
    __param(0, (0, common_1.Param)('appNumber')),
    __param(1, (0, common_1.Query)('start_date')),
    __param(2, (0, common_1.Query)('end_date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "getEmployeeAttendance", null);
__decorate([
    (0, common_1.Get)('supervisors'),
    (0, swagger_1.ApiOperation)({ summary: '列出有效的輔導員（給前端 picker 用）' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "listSupervisors", null);
__decorate([
    (0, common_1.Get)('state-tags'),
    (0, swagger_1.ApiOperation)({ summary: '取得狀態標籤列表' }),
    __param(0, (0, common_1.Query)('include_inactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "listStateTags", null);
__decorate([
    (0, common_1.Post)('state-tags'),
    (0, swagger_1.ApiOperation)({ summary: '新增 / 更新狀態標籤（後台）' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [counseling_cases_dto_1.UpsertStateTagDto]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "upsertStateTag", null);
__decorate([
    (0, common_1.Delete)('state-tags/:id'),
    (0, swagger_1.ApiOperation)({ summary: '停用狀態標籤' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "deactivateStateTag", null);
__decorate([
    (0, common_1.Get)('holidays'),
    (0, swagger_1.ApiOperation)({ summary: '取得假日列表（可帶 year）' }),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "listHolidays", null);
__decorate([
    (0, common_1.Post)('holidays'),
    (0, swagger_1.ApiOperation)({ summary: '新增 / 更新假日' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [counseling_cases_dto_1.UpsertHolidayDto]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "upsertHoliday", null);
__decorate([
    (0, common_1.Delete)('holidays/:date'),
    (0, swagger_1.ApiOperation)({ summary: '刪除假日' }),
    __param(0, (0, common_1.Param)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "deleteHoliday", null);
__decorate([
    (0, common_1.Get)('today'),
    (0, swagger_1.ApiOperation)({ summary: '今日輔導任務（可帶 date / supervisor_id）' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [counseling_cases_dto_1.TodayTasksQueryDto]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "getToday", null);
__decorate([
    (0, common_1.Get)('overdue'),
    (0, swagger_1.ApiOperation)({ summary: '過期未完成任務' }),
    __param(0, (0, common_1.Query)('supervisor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "getOverdue", null);
__decorate([
    (0, common_1.Post)('draft'),
    (0, swagger_1.ApiOperation)({ summary: 'AI 排程草稿（不寫 DB，回 draft_token + 預覽）' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [counseling_cases_dto_1.CreateCaseDraftDto]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "createDraft", null);
__decorate([
    (0, common_1.Post)('confirm'),
    (0, swagger_1.ApiOperation)({ summary: '確認草稿並寫入正式案（含工作日自動對齊）' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [counseling_cases_dto_1.ConfirmCaseDto]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "confirm", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '輔導案列表（含篩選）' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [counseling_cases_dto_1.ListCasesQueryDto]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '輔導案詳情（含排程與執行紀錄）' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '更新輔導案' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, counseling_cases_dto_1.UpdateCaseDto]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/close'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: '結案' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "close", null);
__decorate([
    (0, common_1.Patch)('plan-items/:itemId'),
    (0, swagger_1.ApiOperation)({ summary: '更新排程節點（改期 / 跳過 / 標記完成；自動對齊工作日）' }),
    __param(0, (0, common_1.Param)('itemId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, counseling_cases_dto_1.UpdatePlanItemDto]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "updatePlanItem", null);
__decorate([
    (0, common_1.Post)(':id/executions'),
    (0, swagger_1.ApiOperation)({ summary: '新增執行紀錄（自動標記對應 plan_item 為 done）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, counseling_cases_dto_1.CreateExecutionDto]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "createExecution", null);
__decorate([
    (0, common_1.Get)(':id/executions'),
    (0, swagger_1.ApiOperation)({ summary: '取得執行紀錄列表' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "listExecutions", null);
__decorate([
    (0, common_1.Get)(':id/ai/sessions'),
    (0, swagger_1.ApiOperation)({ summary: '列出案件下所有 AI 討論 session' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "listAiSessions", null);
__decorate([
    (0, common_1.Post)(':id/ai/session'),
    (0, swagger_1.ApiOperation)({ summary: '取得或建立此輔導員在此案的 session（同人同案共用一個 session）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "openAiSession", null);
__decorate([
    (0, common_1.Get)('ai/sessions/:sessionId/messages'),
    (0, swagger_1.ApiOperation)({ summary: '取得 session 訊息列表' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Query)('supervisor_identifier')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "listAiMessages", null);
__decorate([
    (0, common_1.Post)('ai/sessions/:sessionId/messages'),
    (0, swagger_1.ApiOperation)({ summary: '在 session 發送訊息，AI 自動回覆（含案件上下文）' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "sendAiMessage", null);
__decorate([
    (0, common_1.Post)('supervisors/bind-line'),
    (0, swagger_1.ApiOperation)({ summary: '綁定輔導員的 LINE userId' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "bindLine", null);
__decorate([
    (0, common_1.Delete)('supervisors/:identifier/line'),
    (0, swagger_1.ApiOperation)({ summary: '解除輔導員的 LINE 綁定' }),
    __param(0, (0, common_1.Param)('identifier')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "unbindLine", null);
__decorate([
    (0, common_1.Post)('notify/today'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: '手動觸發：對所有已綁定輔導員推送今日任務' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "notifyToday", null);
__decorate([
    (0, common_1.Post)('notify/today/:supervisorId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: '手動觸發：對單一輔導員推送今日任務' }),
    __param(0, (0, common_1.Param)('supervisorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CounselingCasesController.prototype, "notifyTodayOne", null);
exports.CounselingCasesController = CounselingCasesController = __decorate([
    (0, swagger_1.ApiTags)('counseling-cases'),
    (0, common_1.Controller)('counseling-cases'),
    __metadata("design:paramtypes", [counseling_cases_service_1.CounselingCasesService,
        case_ai_service_1.CaseAiService,
        case_notifier_service_1.CaseNotifierService])
], CounselingCasesController);
//# sourceMappingURL=counseling-cases.controller.js.map