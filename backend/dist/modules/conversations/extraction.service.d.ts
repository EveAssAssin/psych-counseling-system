import { ConfigService } from '@nestjs/config';
export interface ExtractionResult {
    success: boolean;
    text?: string;
    error?: string;
    method: string;
}
export declare class ExtractionService {
    private readonly configService;
    private readonly logger;
    private anthropic;
    constructor(configService: ConfigService);
    extractFromPdf(buffer: Buffer): Promise<ExtractionResult>;
    extractFromDocx(buffer: Buffer): Promise<ExtractionResult>;
    extractFromImage(buffer: Buffer, mimeType: string): Promise<ExtractionResult>;
    extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult>;
}
