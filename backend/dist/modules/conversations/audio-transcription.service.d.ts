import { ConfigService } from '@nestjs/config';
export interface TranscriptionSegment {
    start: number;
    end: number;
    text: string;
}
export interface TranscriptionResult {
    text: string;
    textWithTimestamps: string;
    segments: TranscriptionSegment[];
    durationSeconds: number;
    language?: string;
    whisperModel: string;
}
export declare class AudioTranscriptionService {
    private readonly config;
    private readonly logger;
    private readonly openai;
    private readonly whisperModel;
    constructor(config: ConfigService);
    isEnabled(): boolean;
    isAudioFile(mimetype: string, originalname?: string): boolean;
    transcribe(buffer: Buffer, filename: string, language?: string): Promise<TranscriptionResult>;
}
