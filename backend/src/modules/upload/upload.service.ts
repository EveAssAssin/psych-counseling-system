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

export type UploadCategory = 'reviews' | 'responses' | 'conversations' | 'supervisor-notes';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  
  // 檔案大小限制 (bytes)
  private readonly SIZE_LIMITS = {
    image: 10 * 1024 * 1024,      // 10MB
    video: 100 * 1024 * 1024,     // 100MB
    audio: 50 * 1024 * 1024,      // 50MB
    document: 30 * 1024 * 1024,   // 30MB
    archive: 50 * 1024 * 1024,    // 50MB（zip 等壓縮檔）
  };

  // 允許的 MIME 類型
  private readonly ALLOWED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'],
    video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-ms-wmv'],
    audio: [
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
      'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
      'audio/webm', 'audio/ogg', 'audio/oga', 'audio/flac', 'audio/x-flac',
      'audio/aac', 'audio/3gpp', 'audio/3gpp2', 'audio/amr',
    ],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
    ],
    archive: [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
      'multipart/x-zip',
    ],
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
      const fileType = this.getFileType(file.mimetype, file.originalname);
      if (!fileType) {
        throw new BadRequestException(
          `不支援的檔案格式，請轉成常見格式（音檔 mp3／m4a／wav，或壓縮成 zip）後再上傳。`,
        );
      }

      // 檢查檔案大小
      const sizeLimit = this.SIZE_LIMITS[fileType];
      if (file.size > sizeLimit) {
        throw new BadRequestException(
          `檔案過大（${(file.size / 1024 / 1024).toFixed(1)}MB），上限 ${Math.round(sizeLimit / 1024 / 1024)}MB，請壓縮後再上傳。`,
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
  private getFileType(
    mimeType: string,
    filename?: string,
  ): 'image' | 'video' | 'audio' | 'document' | 'archive' | null {
    if (this.ALLOWED_TYPES.image.includes(mimeType)) return 'image';
    if (this.ALLOWED_TYPES.video.includes(mimeType)) return 'video';
    if (this.ALLOWED_TYPES.audio.includes(mimeType)) return 'audio';
    if (this.ALLOWED_TYPES.document.includes(mimeType)) return 'document';
    if (this.ALLOWED_TYPES.archive.includes(mimeType)) return 'archive';

    // 副檔名後備：部分瀏覽器/OS 回報的 MIME 不準（例如 WAV 變成 audio/x-wav、
    // 壓縮檔變成 application/octet-stream），改以副檔名判斷，避免誤擋常見音檔。
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (ext) {
      if (['mp3', 'm4a', 'wav', 'ogg', 'oga', 'flac', 'aac', 'amr', '3gp', '3gpp', 'mpga', 'weba'].includes(ext)) return 'audio';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return 'image';
      if (['mp4', 'mov', 'avi', 'wmv'].includes(ext)) return 'video';
      if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'].includes(ext)) return 'document';
      if (ext === 'zip') return 'archive';
    }
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
