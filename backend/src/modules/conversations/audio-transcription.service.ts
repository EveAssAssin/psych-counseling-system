import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';

/**
 * 支援的音檔 MIME types（Whisper 接受的格式）
 * 來源：https://platform.openai.com/docs/guides/speech-to-text
 */
const SUPPORTED_AUDIO_MIMES = [
  'audio/mpeg',        // .mp3
  'audio/mp3',
  'audio/mp4',         // .m4a
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

/**
 * Whisper 轉錄輸出格式（verbose_json 含時間戳）
 */
export interface TranscriptionSegment {
  start: number;       // 秒
  end: number;         // 秒
  text: string;
}

export interface TranscriptionResult {
  text: string;                          // 全文（無時間戳）
  textWithTimestamps: string;            // 帶時間戳的文字稿（Teams/Zoom 風格）
  segments: TranscriptionSegment[];      // 結構化 segments
  durationSeconds: number;
  language?: string;
  whisperModel: string;
}

/**
 * 音檔轉錄服務 — 呼叫 OpenAI Whisper API
 */
@Injectable()
export class AudioTranscriptionService {
  private readonly logger = new Logger(AudioTranscriptionService.name);
  private readonly openai: OpenAI | null;
  private readonly whisperModel: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('openai.apiKey');
    this.whisperModel = this.config.get<string>('openai.whisperModel') || 'whisper-1';
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not configured — audio transcription disabled. ' +
          'Set OPENAI_API_KEY in .env to enable.',
      );
      this.openai = null;
    } else {
      this.openai = new OpenAI({ apiKey });
      this.logger.log(`Whisper transcription enabled (model: ${this.whisperModel})`);
    }
  }

  /** 服務是否可用（API key 已設定） */
  isEnabled(): boolean {
    return this.openai !== null;
  }

  /** 檢查 MIME / 副檔名是否為支援的音檔 */
  isAudioFile(mimetype: string, originalname?: string): boolean {
    if (SUPPORTED_AUDIO_MIMES.includes(mimetype.toLowerCase())) return true;
    if (originalname) {
      const ext = originalname.split('.').pop()?.toLowerCase();
      if (ext && SUPPORTED_AUDIO_EXTS.includes(ext)) return true;
    }
    return false;
  }

  /**
   * 轉錄音檔
   * @param buffer 音檔 buffer
   * @param filename 原始檔名（Whisper 會看副檔名）
   * @param language ISO-639-1 語言碼，預設 'zh'（中文）
   */
  async transcribe(
    buffer: Buffer,
    filename: string,
    language: string = 'zh',
  ): Promise<TranscriptionResult> {
    if (!this.openai) {
      throw new BadRequestException(
        '音檔轉錄功能未啟用：請在 backend .env 設定 OPENAI_API_KEY',
      );
    }

    this.logger.log(
      `Transcribing audio: ${filename}, size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`,
    );

    try {
      // Whisper 透過 OpenAI SDK 的 toFile helper 處理 buffer
      const file = await toFile(buffer, filename);

      const response = await this.openai.audio.transcriptions.create({
        file,
        model: this.whisperModel,
        language,
        response_format: 'verbose_json',     // 取得時間戳
        timestamp_granularities: ['segment'],
      });

      // response 在 verbose_json 模式下會有 segments, duration, language
      const anyResp: any = response;
      const segments: TranscriptionSegment[] = (anyResp.segments || []).map((s: any) => ({
        start: s.start,
        end: s.end,
        text: (s.text || '').trim(),
      }));

      // 組裝帶時間戳的文字稿（類似 Teams/Zoom 格式）
      const textWithTimestamps = segments
        .map((s) => {
          const mm = String(Math.floor(s.start / 60)).padStart(2, '0');
          const ss = String(Math.floor(s.start % 60)).padStart(2, '0');
          return `[${mm}:${ss}] ${s.text}`;
        })
        .join('\n');

      const result: TranscriptionResult = {
        text: response.text,
        textWithTimestamps,
        segments,
        durationSeconds: anyResp.duration || 0,
        language: anyResp.language,
        whisperModel: this.whisperModel,
      };

      this.logger.log(
        `Transcription completed: ${segments.length} segments, ${result.durationSeconds.toFixed(1)}s`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Whisper transcription failed: ${error.message}`, error.stack);
      if (error?.status === 401) {
        throw new BadRequestException('OpenAI API key 無效或已過期');
      }
      if (error?.status === 413) {
        throw new BadRequestException('音檔過大（Whisper 上限 25 MB）');
      }
      throw new InternalServerErrorException(`音檔轉錄失敗：${error.message}`);
    }
  }
}
