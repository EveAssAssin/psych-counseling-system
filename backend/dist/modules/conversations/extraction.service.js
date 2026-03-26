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
var ExtractionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractionService = void 0;
const common_1 = require("@nestjs/common");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const sdk_1 = require("@anthropic-ai/sdk");
const config_1 = require("@nestjs/config");
let ExtractionService = ExtractionService_1 = class ExtractionService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(ExtractionService_1.name);
        const apiKey = this.configService.get('anthropic.apiKey');
        if (apiKey) {
            this.anthropic = new sdk_1.default({ apiKey });
        }
    }
    async extractFromPdf(buffer) {
        try {
            this.logger.log('Extracting text from PDF');
            const data = await pdf(buffer);
            return {
                success: true,
                text: data.text.trim(),
                method: 'pdf-parse',
            };
        }
        catch (error) {
            this.logger.error('PDF extraction failed:', error);
            return {
                success: false,
                error: error.message,
                method: 'pdf-parse',
            };
        }
    }
    async extractFromDocx(buffer) {
        try {
            this.logger.log('Extracting text from DOCX');
            const result = await mammoth.extractRawText({ buffer });
            return {
                success: true,
                text: result.value.trim(),
                method: 'mammoth',
            };
        }
        catch (error) {
            this.logger.error('DOCX extraction failed:', error);
            return {
                success: false,
                error: error.message,
                method: 'mammoth',
            };
        }
    }
    async extractFromImage(buffer, mimeType) {
        if (!this.anthropic) {
            return {
                success: false,
                error: 'Anthropic API not configured',
                method: 'claude-vision',
            };
        }
        try {
            this.logger.log('Extracting text from image using Claude Vision');
            const base64 = buffer.toString('base64');
            const mediaType = mimeType;
            const response = await this.anthropic.messages.create({
                model: this.configService.get('anthropic.model') || 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mediaType,
                                    data: base64,
                                },
                            },
                            {
                                type: 'text',
                                text: `請仔細閱讀這張圖片中的所有文字內容，並將其完整轉錄出來。
                
要求：
1. 保持原始的段落結構和格式
2. 如果有對話，請標示說話者
3. 如果有日期或時間，請保留
4. 忠實轉錄，不要遺漏任何文字
5. 如果文字模糊或難以辨認，用 [難以辨認] 標示

請直接輸出轉錄結果，不需要額外說明。`,
                            },
                        ],
                    },
                ],
            });
            const text = response.content
                .filter((block) => block.type === 'text')
                .map((block) => block.text)
                .join('\n');
            return {
                success: true,
                text: text.trim(),
                method: 'claude-vision',
            };
        }
        catch (error) {
            this.logger.error('Image OCR failed:', error);
            return {
                success: false,
                error: error.message,
                method: 'claude-vision',
            };
        }
    }
    async extract(buffer, mimeType) {
        if (mimeType === 'application/pdf') {
            return this.extractFromPdf(buffer);
        }
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            mimeType === 'application/msword') {
            return this.extractFromDocx(buffer);
        }
        if (mimeType.startsWith('image/')) {
            return this.extractFromImage(buffer, mimeType);
        }
        return {
            success: false,
            error: `Unsupported file type: ${mimeType}`,
            method: 'unknown',
        };
    }
};
exports.ExtractionService = ExtractionService;
exports.ExtractionService = ExtractionService = ExtractionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ExtractionService);
//# sourceMappingURL=extraction.service.js.map