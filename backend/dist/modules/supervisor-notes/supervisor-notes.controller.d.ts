import { SupervisorNotesService } from './supervisor-notes.service';
import { UploadService } from '../upload/upload.service';
import { CreateNoteDto, UpdateNoteDto, CreateCategoryDto, UpdateCategoryDto, CreateSupervisorDto, AddConfidentialDto, CreateReviewRecordDto, UpdateReviewRecordDto } from './supervisor-notes.dto';
export declare class SupervisorNotesController {
    private readonly svc;
    private readonly uploadSvc;
    constructor(svc: SupervisorNotesService, uploadSvc: UploadService);
    checkAuth(identifier: string, password?: string): Promise<{
        authorized: boolean;
        role: null;
        name: null;
    } | {
        authorized: boolean;
        role: string;
        name: string;
    }>;
    changeOwnPassword(body: {
        identifier: string;
        currentPassword: string;
        newPassword: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    getCategories(supervisorId?: string): Promise<any[]>;
    createCategory(dto: CreateCategoryDto, supervisorId?: string): Promise<any>;
    updateCategoryOrder(body: {
        supervisor_id: string;
        ordered_ids: string[];
    }): Promise<{
        success: boolean;
    }>;
    updateCategory(id: string, dto: UpdateCategoryDto): Promise<any>;
    deleteCategory(id: string): Promise<{
        success: boolean;
    }>;
    uploadAttachments(files: Express.Multer.File[]): Promise<{
        attachments: {
            url: string | undefined;
            originalName: string | undefined;
            type: string | undefined;
            size: number | undefined;
        }[];
    }>;
    createNote(dto: CreateNoteDto): Promise<any>;
    getNotes(supervisorId?: string, employeeId?: string, appNumber?: string, search?: string, categoryId?: string, page?: number, limit?: number): Promise<{
        data: any[];
        total: number | null;
        page: number;
        limit: number;
    }>;
    getNoteById(id: string): Promise<any>;
    updateNote(id: string, dto: UpdateNoteDto, supervisorId: string): Promise<any>;
    deleteNote(id: string, supervisorId: string): Promise<{
        success: boolean;
    }>;
    searchEmployees(keyword?: string, storeId?: string): Promise<{
        app_number: any;
        name: any;
        store_name: any;
        position: any;
    }[]>;
    getStores(): Promise<{
        store_name: any;
    }[]>;
    getSupervisors(): Promise<any[]>;
    createSupervisor(dto: CreateSupervisorDto): Promise<any>;
    updateSupervisor(id: string, dto: any): Promise<any>;
    deleteSupervisor(id: string): Promise<{
        success: boolean;
    }>;
    setPassword(id: string, body: {
        password: string;
    }): Promise<{
        success: boolean;
    }>;
    getReviewRecords(employeeAppNumber?: string, search?: string, page?: number, limit?: number): Promise<{
        data: any[];
        total: number | null;
        page: number;
        limit: number;
    }>;
    createReviewRecord(dto: CreateReviewRecordDto): Promise<any>;
    updateReviewRecord(id: string, dto: UpdateReviewRecordDto, supervisorId: string): Promise<any>;
    deleteReviewRecord(id: string, supervisorId: string): Promise<{
        success: boolean;
    }>;
    getConfidentialList(): Promise<any[]>;
    addConfidential(dto: AddConfidentialDto): Promise<any>;
    removeConfidential(id: string): Promise<{
        success: boolean;
    }>;
}
