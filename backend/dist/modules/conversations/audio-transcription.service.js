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
var AudioTranscriptionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioTranscriptionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = require("openai");
const SUPPORTED_AUDIO_MIMES = [
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/webm',
    'audio/ogg',
    'audio/flac',
    'audio/x-flac',
];
const SUPPORTED_AUDIO_EXTS = ['mp3', 'm4a', 'wav', 'webm', 'ogg', 'flac', 'mp4', 'mpeg', 'mpga'];
let AudioTranscriptionService = AudioTranscriptionService_1 = class AudioTranscriptionService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(AudioTranscriptionService_1.name);
        const apiKey = this.config.get('openai.apiKey');
        this.whisperModel = this.config.get('openai.whisperModel') || 'whisper-1';
        if (!apiKey) {
            this.logger.warn('OPENAI_API_KEY not configured — audio transcription disabled. ' +
                'Set OPENAI_API_KEY in .env to enable.');
            this.openai = null;
        }
        else {
            this.openai = new openai_1.default({ apiKey });
            this.logger.log(`Whisper transcription enabled (model: ${this.whisperModel})`);
        }
    }
    isEnabled() {
        return this.openai !== null;
    }
    isAudioFile(mimetype, originalname) {
        if (SUPPORTED_AUDIO_MIMES.includes(mimetype.toLowerCase()))
            return true;
        if (originalname) {
            const ext = originalname.split('.').pop()?.toLowerCase();
            if (ext && SUPPORTED_AUDIO_EXTS.includes(ext))
                return true;
        }
        return false;
    }
    async transcribe(buffer, filename, language = 'zh') {
        if (!this.openai) {
            throw new common_1.BadRequestException('音檔轉錄功能未啟用：請在 backend .env 設定 OPENAI_API_KEY');
        }
        this.logger.log(`Transcribing audio: ${filename}, size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        try {
            const file = await (0, openai_1.toFile)(buffer, filename);
            const response = await this.openai.audio.transcriptions.create({
                file,
                model: this.whisperModel,
                language,
                response_format: 'verbose_json',
                timestamp_granularities: ['segment'],
            });
            const anyResp = response;
            const segments = (anyResp.segments || []).map((s) => ({
                start: s.start,
                end: s.end,
                text: (s.text || '').trim(),
            }));
            const textWithTimestamps = segments
                .map((s) => {
                const mm = String(Math.floor(s.start / 60)).padStart(2, '0');
                const ss = String(Math.floor(s.start % 60)).padStart(2, '0');
                return `[${mm}:${ss}] ${s.text}`;
            })
                .join('\n');
            const result = {
                text: response.text,
                textWithTimestamps,
                segments,
                durationSeconds: anyResp.duration || 0,
                language: anyResp.language,
                whisperModel: this.whisperModel,
            };
            this.logger.log(`Transcription completed: ${segments.length} segments, ${result.durationSeconds.toFixed(1)}s`);
            return result;
        }
        catch (error) {
            this.logger.error(`Whisper transcription failed: ${error.message}`, error.stack);
            if (error?.status === 401) {
                throw new common_1.BadRequestException('OpenAI API key 無效或已過期');
            }
            if (error?.status === 413) {
                throw new common_1.BadRequestException('音檔過大（Whisper 上限 25 MB）');
            }
            throw new common_1.InternalServerErrorException(`音檔轉錄失敗：${error.message}`);
        }
    }
};
exports.AudioTranscriptionService = AudioTranscriptionService;
exports.AudioTranscriptionService = AudioTranscriptionService = AudioTranscriptionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AudioTranscriptionService);
//# sourceMappingURL=audio-transcription.service.js.map