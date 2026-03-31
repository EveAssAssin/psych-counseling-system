import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  error?: string;
}

export type UploadCategory = 'reviews' | 'responses' | 'conversations';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  
  // 檔案大小限制 (bytes)
  private readonly SIZE_LIMITS = {
    image: 10 * 1024 * 1024,      // 10MB
    video: 100 * 1024 * 1024,     // 100MB
    audio: 50 * 1024 * 1024,      // 50MB
  };

  // 允許的 MIME 類型
  private readonly ALLOWED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/quicktime', 'video/webm'],
    audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/x-m4a'],
  };

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * 上傳檔案
   */
  async uploadFile(
    file: Express.Multer.File,
    category: UploadCategory,
    subFolder?: string,
  ): Promise<UploadResult> {
    try {
      // 驗證檔案
      const fileType = this.getFileType(file.mimetype);
      if (!fileType) {
        throw new BadRequestException(`不支援的檔案類型: ${file.mimetype}`);
      }

      // 檢查檔案大小
      const sizeLimit = this.SIZE_LIMITS[fileType];
      if (file.size > sizeLimit) {
        throw new BadRequestException(
          `檔案過大，${fileType} 類型限制 ${Math.round(sizeLimit / 1024 / 1024)}MB`
        );
      }

      // 產生唯一檔名
      const ext = this.getExtension(file.originalname);
      const fileName = `${uuidv4()}${ext}`;
      
      // 組合路徑: category/subFolder/fileName
      const path = subFolder 
        ? `${category}/${subFolder}/${fileName}`
        : `${category}/${fileName}`;

      // 上傳到 Supabase Storage
      const bucket = 'attachments';
      await this.supabase.uploadFile(bucket, path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

      // 取得公開 URL
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
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 批次上傳
   */
  async uploadFiles(
    files: Express.Multer.File[],
    category: UploadCategory,
    subFolder?: string,
  ): Promise<UploadResult[]> {
    const results = await Promise.all(
      files.map(file => this.uploadFile(file, category, subFolder))
    );
    return results;
  }

  /**
   * 刪除檔案
   */
  async deleteFile(path: string): Promise<boolean> {
    try {
      await this.supabase.deleteFile('attachments', [path]);
      this.logger.log(`File deleted: ${path}`);
      return true;
    } catch (error) {
      this.logger.error(`Delete failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 判斷檔案類型
   */
  private getFileType(mimeType: string): 'image' | 'video' | 'audio' | null {
    if (this.ALLOWED_TYPES.image.includes(mimeType)) return 'image';
    if (this.ALLOWED_TYPES.video.includes(mimeType)) return 'video';
    if (this.ALLOWED_TYPES.audio.includes(mimeType)) return 'audio';
    return null;
  }

  /**
   * 取得副檔名
   */
  private getExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
      return '.' + parts.pop()!.toLowerCase();
    }
    return '';
  }
}
