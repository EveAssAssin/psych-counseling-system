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
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const upload_service_1 = require("./upload.service");
let UploadController = class UploadController {
    constructor(uploadService) {
        this.uploadService = uploadService;
    }
    async uploadFile(file, category, subFolder) {
        if (!file) {
            throw new common_1.BadRequestException('請選擇檔案');
        }
        if (!category) {
            throw new common_1.BadRequestException('請指定 category');
        }
        const result = await this.uploadService.uploadFile(file, category, subFolder);
        if (!result.success) {
            throw new common_1.BadRequestException(result.error);
        }
        return result;
    }
    async uploadFiles(files, category, subFolder) {
        if (!files || files.length === 0) {
            throw new common_1.BadRequestException('請選擇檔案');
        }
        if (!category) {
            throw new common_1.BadRequestException('請指定 category');
        }
        const results = await this.uploadService.uploadFiles(files, category, subFolder);
        return {
            total: files.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results,
        };
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('category')),
    __param(2, (0, common_1.Body)('subFolder')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Post)('multiple'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 10)),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)('category')),
    __param(2, (0, common_1.Body)('subFolder')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, String, String]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadFiles", null);
exports.UploadController = UploadController = __decorate([
    (0, common_1.Controller)('upload'),
    __metadata("design:paramtypes", [upload_service_1.UploadService])
], UploadController);
//# sourceMappingURL=upload.controller.js.map