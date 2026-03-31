import { SupabaseService } from '../supabase/supabase.service';
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
export declare class UploadService {
    private readonly supabase;
    private readonly logger;
    private readonly SIZE_LIMITS;
    private readonly ALLOWED_TYPES;
    constructor(supabase: SupabaseService);
    uploadFile(file: Express.Multer.File, category: UploadCategory, subFolder?: string): Promise<UploadResult>;
    uploadFiles(files: Express.Multer.File[], category: UploadCategory, subFolder?: string): Promise<UploadResult[]>;
    deleteFile(path: string): Promise<boolean>;
    private getFileType;
    private getExtension;
}
