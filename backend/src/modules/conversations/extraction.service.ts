import { Injectable, Logger } from '@nestjs/common';
// @ts-ignore
import * as pdf from 'pdf-parse';
import * as mammoth from 'mammoth';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';

export interface ExtractionResult {
  success: boolean;
  text?: string;
  error?: string;
  method: string;
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private anthropic: Anthropic;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('anthropic.apiKey');
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  /**
   * 從 PDF 抽取文字
   */
  async extractFromPdf(buffer: Buffer): Promise<ExtractionResult> {
    try {
      this.logger.log('Extracting text from PDF');
      const data = await pdf(buffer);
      
      return {
        success: true,
        text: data.text.trim(),
        method: 'pdf-parse',
      };
    } catch (error) {
      this.logger.error('PDF extraction failed:', error);
      return {
        success: false,
        error: error.message,
        method: 'pdf-parse',
      };
    }
  }

  /**
   * 從 Word 文件抽取文字
   */
  async extractFromDocx(buffer: Buffer): Promise<ExtractionResult> {
    try {
      this.logger.log('Extracting text from DOCX');
      const result = await mammoth.extractRawText({ buffer });
      
      return {
        success: true,
        text: result.value.trim(),
        method: 'mammoth',
      };
    } catch (error) {
      this.logger.error('DOCX extraction failed:', error);
      return {
        success: false,
        error: error.message,
        method: 'mammoth',
      };
    }
  }

  /**
   * 從圖片 OCR 抽取文字（使用 Claude Vision）
   */
  async extractFromImage(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
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
      const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      const response = await this.anthropic.messages.create({
        model: this.configService.get<string>('anthropic.model') || 'claude-sonnet-4-20250514',
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
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('\n');

      return {
        success: true,
        text: text.trim(),
        method: 'claude-vision',
      };
    } catch (error) {
      this.logger.error('Image OCR failed:', error);
      return {
        success: false,
        error: error.message,
        method: 'claude-vision',
      };
    }
  }

  /**
   * 根據檔案類型自動選擇抽取方法
   */
  async extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    if (mimeType === 'application/pdf') {
      return this.extractFromPdf(buffer);
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
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
}
