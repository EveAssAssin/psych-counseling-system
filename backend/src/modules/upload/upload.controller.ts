import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService, UploadCategory } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 上傳單一檔案
   * POST /api/upload
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category: UploadCategory,
    @Body('subFolder') subFolder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('請選擇檔案');
    }

    if (!category) {
      throw new BadRequestException('請指定 category');
    }

    const result = await this.uploadService.uploadFile(file, category, subFolder);
    
    if (!result.success) {
      throw new BadRequestException(result.error);
    }

    return result;
  }

  /**
   * 上傳多個檔案
   * POST /api/upload/multiple
   */
  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('category') category: UploadCategory,
    @Body('subFolder') subFolder?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('請選擇檔案');
    }

    if (!category) {
      throw new BadRequestException('請指定 category');
    }

    const results = await this.uploadService.uploadFiles(files, category, subFolder);
    
    return {
      total: files.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }
}
