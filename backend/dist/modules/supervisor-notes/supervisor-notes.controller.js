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
exports.SupervisorNotesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
const supervisor_notes_service_1 = require("./supervisor-notes.service");
const upload_service_1 = require("../upload/upload.service");
const supervisor_notes_dto_1 = require("./supervisor-notes.dto");
let SupervisorNotesController = class SupervisorNotesController {
    constructor(svc, uploadSvc) {
        this.svc = svc;
        this.uploadSvc = uploadSvc;
    }
    async checkAuth(identifier, password) {
        if (password) {
            const result = await this.svc.verifyLogin(identifier, password);
            if (!result.success)
                return { authorized: false, role: null, name: null };
            return { authorized: true, role: result.info.role, name: result.info.name };
        }
        const info = await this.svc.getSupervisorInfo(identifier);
        if (!info)
            return { authorized: false, role: null, name: null };
        return { authorized: true, role: info.role, name: info.name };
    }
    changeOwnPassword(body) {
        return this.svc.changeOwnPassword(body.identifier, body.currentPassword, body.newPassword);
    }
    getCategories(supervisorId) {
        return this.svc.getCategories(supervisorId);
    }
    createCategory(dto, supervisorId) { return this.svc.createCategory(dto, supervisorId, supervisorId); }
    updateCategoryOrder(body) { return this.svc.updateCategoryOrder(body.supervisor_id, body.ordered_ids); }
    updateCategory(id, dto) {
        return this.svc.updateCategory(id, dto);
    }
    deleteCategory(id) { return this.svc.deleteCategory(id); }
    async uploadAttachments(files) {
        if (!files || files.length === 0)
            return { attachments: [] };
        const results = await Promise.all(files.map(f => this.uploadSvc.uploadFile(f, 'reviews', 'supervisor-notes')));
        const attachments = results
            .filter(r => r.success)
            .map(r => ({
            url: r.url,
            originalName: r.fileName,
            type: r.mimeType,
            size: r.fileSize,
        }));
        return { attachments };
    }
    createNote(dto) { return this.svc.createNote(dto); }
    getNotes(supervisorId, employeeId, appNumber, search, categoryId, page, limit) {
        return this.svc.getNotes({ supervisor_id: supervisorId, employee_id: employeeId, employee_app_number: appNumber, search, category_id: categoryId, page, limit });
    }
    getNoteById(id) { return this.svc.getNoteById(id); }
    updateNote(id, dto, supervisorId) { return this.svc.updateNote(id, supervisorId, dto); }
    deleteNote(id, supervisorId) { return this.svc.deleteNote(id, supervisorId); }
    searchEmployees(keyword, storeId) { return this.svc.searchEmployees(keyword || '', storeId); }
    getStores() { return this.svc.getStores(); }
    getSupervisors() { return this.svc.getSupervisors(); }
    createSupervisor(dto) { return this.svc.createSupervisor(dto); }
    updateSupervisor(id, dto) {
        return this.svc.updateSupervisor(id, dto);
    }
    deleteSupervisor(id) { return this.svc.deleteSupervisor(id); }
    setPassword(id, body) {
        return this.svc.setPassword(id, body.password);
    }
    getReviewRecords(employeeAppNumber, search, page, limit) {
        return this.svc.getReviewRecords({ employee_app_number: employeeAppNumber, search, page, limit });
    }
    createReviewRecord(dto) {
        return this.svc.createReviewRecord(dto);
    }
    updateReviewRecord(id, dto, supervisorId) {
        return this.svc.updateReviewRecord(id, supervisorId, dto);
    }
    deleteReviewRecord(id, supervisorId) {
        return this.svc.deleteReviewRecord(id, supervisorId);
    }
    getConfidentialList() { return this.svc.getConfidentialList(); }
    addConfidential(dto) { return this.svc.addToConfidential(dto); }
    removeConfidential(id) { return this.svc.removeFromConfidential(id); }
};
exports.SupervisorNotesController = SupervisorNotesController;
__decorate([
    (0, common_1.Get)('auth/check'),
    (0, swagger_1.ApiOperation)({ summary: '確認主管是否有權限' }),
    __param(0, (0, common_1.Query)('identifier')),
    __param(1, (0, common_1.Query)('password')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SupervisorNotesController.prototype, "checkAuth", null);
__decorate([
    (0, common_1.Post)('auth/change-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: '主管修改自己的密碼（需驗證舊密碼）' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "changeOwnPassword", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, swagger_1.ApiOperation)({ summary: '取得分類（全域+個人）' }),
    __param(0, (0, common_1.Query)('supervisor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Post)('categories'),
    (0, swagger_1.ApiOperation)({ summary: '新增分類' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('supervisor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [supervisor_notes_dto_1.CreateCategoryDto, String]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Patch)('categories/order'),
    (0, swagger_1.ApiOperation)({ summary: '更新主管分類排序' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "updateCategoryOrder", null);
__decorate([
    (0, common_1.Patch)('categories/:id'),
    (0, swagger_1.ApiOperation)({ summary: '更新分類' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, supervisor_notes_dto_1.UpdateCategoryDto]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "updateCategory", null);
__decorate([
    (0, common_1.Delete)('categories/:id'),
    (0, swagger_1.ApiOperation)({ summary: '刪除分類（軟刪除）' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "deleteCategory", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, swagger_1.ApiOperation)({ summary: '上傳附件（圖片/影片/文件）' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 10)),
    __param(0, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], SupervisorNotesController.prototype, "uploadAttachments", null);
__decorate([
    (0, common_1.Post)('notes'),
    (0, swagger_1.ApiOperation)({ summary: '建立新隨手記' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [supervisor_notes_dto_1.CreateNoteDto]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "createNote", null);
__decorate([
    (0, common_1.Get)('notes'),
    (0, swagger_1.ApiOperation)({ summary: '查詢隨手記列表（分頁）' }),
    __param(0, (0, common_1.Query)('supervisor_id')),
    __param(1, (0, common_1.Query)('employee_id')),
    __param(2, (0, common_1.Query)('employee_app_number')),
    __param(3, (0, common_1.Query)('search')),
    __param(4, (0, common_1.Query)('category_id')),
    __param(5, (0, common_1.Query)('page')),
    __param(6, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, Number, Number]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "getNotes", null);
__decorate([
    (0, common_1.Get)('notes/:id'),
    (0, swagger_1.ApiOperation)({ summary: '取得單筆隨手記' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "getNoteById", null);
__decorate([
    (0, common_1.Patch)('notes/:id'),
    (0, swagger_1.ApiOperation)({ summary: '更新隨手記' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('supervisor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, supervisor_notes_dto_1.UpdateNoteDto, String]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "updateNote", null);
__decorate([
    (0, common_1.Delete)('notes/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: '刪除隨手記（軟刪除）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('supervisor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "deleteNote", null);
__decorate([
    (0, common_1.Get)('employees/search'),
    (0, swagger_1.ApiOperation)({ summary: '快搜人員' }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('store_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "searchEmployees", null);
__decorate([
    (0, common_1.Get)('stores'),
    (0, swagger_1.ApiOperation)({ summary: '取得店家清單' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "getStores", null);
__decorate([
    (0, common_1.Get)('supervisors'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "getSupervisors", null);
__decorate([
    (0, common_1.Post)('supervisors'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [supervisor_notes_dto_1.CreateSupervisorDto]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "createSupervisor", null);
__decorate([
    (0, common_1.Patch)('supervisors/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "updateSupervisor", null);
__decorate([
    (0, common_1.Delete)('supervisors/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "deleteSupervisor", null);
__decorate([
    (0, common_1.Patch)('supervisors/:id/password'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "setPassword", null);
__decorate([
    (0, common_1.Get)('review-records'),
    (0, swagger_1.ApiOperation)({ summary: '查詢人評會記錄' }),
    __param(0, (0, common_1.Query)('employee_app_number')),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, Number]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "getReviewRecords", null);
__decorate([
    (0, common_1.Post)('review-records'),
    (0, swagger_1.ApiOperation)({ summary: '建立人評會記錄' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [supervisor_notes_dto_1.CreateReviewRecordDto]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "createReviewRecord", null);
__decorate([
    (0, common_1.Patch)('review-records/:id'),
    (0, swagger_1.ApiOperation)({ summary: '更新人評會記錄' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('supervisor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, supervisor_notes_dto_1.UpdateReviewRecordDto, String]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "updateReviewRecord", null);
__decorate([
    (0, common_1.Delete)('review-records/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: '刪除人評會記錄（軟刪除）' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('supervisor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "deleteReviewRecord", null);
__decorate([
    (0, common_1.Get)('confidential'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "getConfidentialList", null);
__decorate([
    (0, common_1.Post)('confidential'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [supervisor_notes_dto_1.AddConfidentialDto]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "addConfidential", null);
__decorate([
    (0, common_1.Delete)('confidential/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SupervisorNotesController.prototype, "removeConfidential", null);
exports.SupervisorNotesController = SupervisorNotesController = __decorate([
    (0, swagger_1.ApiTags)('supervisor-hub'),
    (0, common_1.Controller)('supervisor-hub'),
    __metadata("design:paramtypes", [supervisor_notes_service_1.SupervisorNotesService,
        upload_service_1.UploadService])
], SupervisorNotesController);
//# sourceMappingURL=supervisor-notes.controller.js.map