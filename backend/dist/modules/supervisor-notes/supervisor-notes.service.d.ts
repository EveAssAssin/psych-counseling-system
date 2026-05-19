import { SupabaseService } from '../supabase/supabase.service';
import { CreateNoteDto, UpdateNoteDto, CreateCategoryDto, UpdateCategoryDto, CreateSupervisorDto, AddConfidentialDto, CreateReviewRecordDto, UpdateReviewRecordDto } from './supervisor-notes.dto';
export declare class SupervisorNotesService {
    private readonly supabase;
    private readonly logger;
    constructor(supabase: SupabaseService);
    private get db();
    private hashPassword;
    setPassword(supervisorId: string, password: string): Promise<{
        success: boolean;
    }>;
    changeOwnPassword(identifier: string, currentPassword: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
    isSupervisorAuthorized(identifier: string): Promise<boolean>;
    verifyLogin(identifier: string, password: string): Promise<{
        success: boolean;
        info?: {
            id: string;
            name: string;
            role: string;
        };
    }>;
    getSupervisorInfo(identifier: string): Promise<{
        id: string;
        name: string;
        role: string;
    } | null>;
    isAdmin(identifier: string): Promise<boolean>;
    requireAuthorized(identifier: string): Promise<void>;
    getSupervisors(): Promise<any[]>;
    createSupervisor(dto: CreateSupervisorDto): Promise<any>;
    updateSupervisor(id: string, updates: Partial<CreateSupervisorDto> & {
        is_active?: boolean;
    }): Promise<any>;
    deleteSupervisor(id: string): Promise<{
        success: boolean;
    }>;
    getCategories(supervisorId?: string): Promise<any[]>;
    updateCategoryOrder(supervisorId: string, orderedIds: string[]): Promise<{
        success: boolean;
    }>;
    createCategory(dto: CreateCategoryDto, createdBy?: string, supervisorId?: string): Promise<any>;
    updateCategory(id: string, dto: UpdateCategoryDto): Promise<any>;
    deleteCategory(id: string): Promise<{
        success: boolean;
    }>;
    createNote(dto: CreateNoteDto): Promise<any>;
    getNotes(filters: {
        supervisor_id?: string;
        employee_id?: string;
        employee_app_number?: string;
        search?: string;
        category_id?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: any[];
        total: number | null;
        page: number;
        limit: number;
    }>;
    getNoteById(id: string): Promise<any>;
    updateNote(id: string, supervisorId: string, dto: UpdateNoteDto): Promise<any>;
    deleteNote(id: string, supervisorId: string): Promise<{
        success: boolean;
    }>;
    searchEmployees(keyword: string, storeId?: string): Promise<{
        app_number: any;
        name: any;
        store_name: any;
        position: any;
    }[]>;
    getStores(): Promise<{
        store_name: any;
    }[]>;
    getConfidentialList(): Promise<any[]>;
    addToConfidential(dto: AddConfidentialDto): Promise<any>;
    removeFromConfidential(id: string): Promise<{
        success: boolean;
    }>;
    isConfidential(employeeAppNumber: string): Promise<boolean>;
    getReviewRecords(filters: {
        employee_app_number?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: any[];
        total: number | null;
        page: number;
        limit: number;
    }>;
    createReviewRecord(dto: CreateReviewRecordDto): Promise<any>;
    updateReviewRecord(id: string, supervisorId: string, dto: UpdateReviewRecordDto): Promise<any>;
    deleteReviewRecord(id: string, supervisorId: string): Promise<{
        success: boolean;
    }>;
    getReviewRecordsByEmployee(employeeAppNumber: string): Promise<any[]>;
    getNotesByEmployee(employeeAppNumber: string, supervisorId?: string): Promise<any[]>;
}
