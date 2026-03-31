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
var UploadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
const uuid_1 = require("uuid");
let UploadService = UploadService_1 = class UploadService {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = new common_1.Logger(UploadService_1.name);
        this.SIZE_LIMITS = {
            image: 10 * 1024 * 1024,
            video: 100 * 1024 * 1024,
            audio: 50 * 1024 * 1024,
        };
        this.ALLOWED_TYPES = {
            image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            video: ['video/mp4', 'video/quicktime', 'video/webm'],
            audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/x-m4a'],
        };
    }
    async uploadFile(file, category, subFolder) {
        try {
            const fileType = this.getFileType(file.mimetype);
            if (!fileType) {
                throw new common_1.BadRequestException(`不支援的檔案類型: ${file.mimetype}`);
            }
            const sizeLimit = this.SIZE_LIMITS[fileType];
            if (file.size > sizeLimit) {
                throw new common_1.BadRequestException(`檔案過大，${fileType} 類型限制 ${Math.round(sizeLimit / 1024 / 1024)}MB`);
            }
            const ext = this.getExtension(file.originalname);
            const fileName = `${(0, uuid_1.v4)()}${ext}`;
            const path = subFolder
                ? `${category}/${subFolder}/${fileName}`
                : `${category}/${fileName}`;
            const bucket = 'attachments';
            await this.supabase.uploadFile(bucket, path, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
            });
            const url = this.supabase.getPublicUrl(bucket, path);
            this.logger.log(`File uploaded: ${path}`);
            return {
                success: true,
                url,
                path,
                fileName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
            };
        }
        catch (error) {
            this.logger.error(`Upload failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async uploadFiles(files, category, subFolder) {
        const results = await Promise.all(files.map(file => this.uploadFile(file, category, subFolder)));
        return results;
    }
    async deleteFile(path) {
        try {
            await this.supabase.deleteFile('attachments', [path]);
            this.logger.log(`File deleted: ${path}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Delete failed: ${error.message}`);
            return false;
        }
    }
    getFileType(mimeType) {
        if (this.ALLOWED_TYPES.image.includes(mimeType))
            return 'image';
        if (this.ALLOWED_TYPES.video.includes(mimeType))
            return 'video';
        if (this.ALLOWED_TYPES.audio.includes(mimeType))
            return 'audio';
        return null;
    }
    getExtension(filename) {
        const parts = filename.split('.');
        if (parts.length > 1) {
            return '.' + parts.pop().toLowerCase();
        }
        return '';
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = UploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], UploadService);
//# sourceMappingURL=upload.service.js.map