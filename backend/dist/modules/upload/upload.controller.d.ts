import { UploadService, UploadCategory } from './upload.service';
export declare class UploadController {
    private readonly uploadService;
    constructor(uploadService: UploadService);
    uploadFile(file: Express.Multer.File, category: UploadCategory, subFolder?: string): Promise<import("./upload.service").UploadResult>;
    uploadFiles(files: Express.Multer.File[], category: UploadCategory, subFolder?: string): Promise<{
        total: number;
        success: number;
        failed: number;
        results: import("./upload.service").UploadResult[];
    }>;
}
