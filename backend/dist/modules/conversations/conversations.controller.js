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
exports.ConversationsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const conversations_service_1 = require("./conversations.service");
const audio_transcription_service_1 = require("./audio-transcription.service");
const smart_fill_service_1 = require("./smart-fill.service");
const conversations_dto_1 = require("./conversations.dto");
let ConversationsController = class ConversationsController {
    constructor(conversationsService, audioTranscription, smartFill) {
        this.conversationsService = conversationsService;
        this.audioTranscription = audioTranscription;
        this.smartFill = smartFill;
    }
    async create(dto) {
        return this.conversationsService.create(dto);
    }
    async createWithFile(file, dto) {
        return this.conversationsService.createWithFile(dto, {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
        });
    }
    async transcribeAndSmartFill(file, body) {
        if (!file) {
            throw new common_1.BadRequestException('請上傳檔案');
        }
        let rawTranscript = '';
        let transcriptionMeta = null;
        const isAudio = this.audioTranscription.isAudioFile(file.mimetype, file.originalname);
        if (isAudio) {
            if (!this.audioTranscription.isEnabled()) {
                throw new common_1.BadRequestException('音檔轉錄功能未啟用。請在後端 .env 設定 OPENAI_API_KEY，或改為上傳逐字稿（txt）。');
            }
            const transcription = await this.audioTranscription.transcribe(file.buffer, file.originalname, body.language || 'zh');
            rawTranscript = transcription.textWithTimestamps;
            transcriptionMeta = {
                source_type: 'audio',
                duration_seconds: transcription.durationSeconds,
                language: transcription.language,
                whisper_model: transcription.whisperModel,
                segment_count: transcription.segments.length,
            };
        }
        else if (file.mimetype.startsWith('text/') ||
            file.originalname.toLowerCase().endsWith('.txt')) {
            rawTranscript = file.buffer.toString('utf-8');
            transcriptionMeta = {
                source_type: 'text_transcript',
                char_count: rawTranscript.length,
            };
        }
        else {
            throw new common_1.BadRequestException(`不支援的檔案類型：${file.mimetype}。請上傳音檔（mp3/m4a/wav/...）或文字稿（.txt）。`);
        }
        let hintEmployeeName;
        if (body.hint_employee_id) {
            try {
                const emp = await this.conversationsService.findByEmployee(body.hint_employee_id);
            }
            catch { }
        }
        const suggestions = await this.smartFill.processTranscript(rawTranscript, {
            hintInterviewerName: body.hint_interviewer_name,
            hintEmployeeName,
        });
        return {
            raw_transcript: rawTranscript,
            transcription_meta: transcriptionMeta,
            suggestions,
        };
    }
    async search(dto) {
        return this.conversationsService.search(dto);
    }
    async getStats() {
        return this.conversationsService.getStats();
    }
    async findByEmployee(employeeId) {
        return this.conversationsService.findByEmployee(employeeId);
    }
    async findOne(id) {
        return this.conversationsService.findById(id);
    }
    async getAttachments(id) {
        return this.conversationsService.getAttachments(id);
    }
    async update(id, dto) {
        return this.conversationsService.update(id, dto);
    }
    async delete(id) {
        await this.conversationsService.delete(id);
    }
};
exports.ConversationsController = ConversationsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '建立對話（文字輸入）' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '建立成功' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [conversations_dto_1.CreateConversationDto]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiOperation)({ summary: '建立對話（檔案上傳）' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
                employee_id: { type: 'string', format: 'uuid' },
                conversation_date: { type: 'string', format: 'date-time' },
                conversation_type: { type: 'string' },
                interviewer_name: { type: 'string' },
                background_note: { type: 'string' },
                priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
                need_followup: { type: 'boolean' },
                tags: { type: 'array', items: { type: 'string' } },
            },
            required: ['file', 'employee_id'],
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: '建立成功' }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, conversations_dto_1.CreateConversationWithFileDto]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "createWithFile", null);
__decorate([
    (0, common_1.Post)('transcribe'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiOperation)({
        summary: '音檔/逐字稿轉錄與智慧預填',
        description: '上傳音檔（mp3/m4a/wav/...）或逐字稿（txt），系統會：' +
            '1. 音檔 → Whisper 轉錄；2. AI 清理、識別發言者、修錯字；' +
            '3. 嘗試辨識員工/訪談者姓名；4. 萃取背景說明與初判風險訊號。' +
            '不建立對話記錄，前端拿到結果後可預覽 / 編輯 / 確認再送 create。',
    }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary', description: '音檔或文字稿' },
                hint_interviewer_name: { type: 'string', description: '提示主管姓名（通常是登入者）' },
                hint_employee_id: { type: 'string', format: 'uuid', description: '若使用者已選員工，傳 employee_id 幫助比對' },
                language: { type: 'string', description: 'Whisper 語言碼，預設 zh', default: 'zh' },
            },
            required: ['file'],
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '轉錄與建議結果' }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "transcribeAndSmartFill", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: '搜尋對話' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '搜尋結果' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [conversations_dto_1.SearchConversationDto]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: '取得對話統計' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '統計資料' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId'),
    (0, swagger_1.ApiOperation)({ summary: '取得員工的所有對話' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '對話列表' }),
    __param(0, (0, common_1.Param)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "findByEmployee", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '取得單一對話' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '對話資料' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: '對話不存在' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/attachments'),
    (0, swagger_1.ApiOperation)({ summary: '取得對話附件' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '附件列表' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "getAttachments", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: '更新對話' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '更新成功' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, conversations_dto_1.UpdateConversationDto]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: '刪除對話' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: '刪除成功' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "delete", null);
exports.ConversationsController = ConversationsController = __decorate([
    (0, swagger_1.ApiTags)('conversations'),
    (0, common_1.Controller)('conversations'),
    __metadata("design:paramtypes", [conversations_service_1.ConversationsService,
        audio_transcription_service_1.AudioTranscriptionService,
        smart_fill_service_1.SmartFillService])
], ConversationsController);
//# sourceMappingURL=conversations.controller.js.map