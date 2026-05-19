export declare class SupervisorIdentityDto {
    identifier: string;
    name: string;
}
export declare class CreateCategoryDto {
    name: string;
    color?: string;
    sort_order?: number;
}
export declare class UpdateCategoryDto {
    name?: string;
    color?: string;
    sort_order?: number;
    is_active?: boolean;
}
export declare class CreateNoteDto {
    supervisor_id: string;
    supervisor_name: string;
    employee_id?: string;
    employee_app_number?: string;
    non_employee_name?: string;
    non_employee_info?: Record<string, any>;
    is_external?: boolean;
    category_id?: string;
    category_name?: string;
    content: string;
    images?: string[];
    attachments?: any[];
}
export declare class UpdateNoteDto {
    category_id?: string;
    category_name?: string;
    content?: string;
    images?: string[];
    attachments?: any[];
}
export declare class CreateSupervisorDto {
    name: string;
    identifier: string;
    display_name?: string;
    role?: string;
}
export declare class CreateReviewRecordDto {
    employee_app_number?: string;
    employee_name?: string;
    categories: Array<{
        id?: string;
        name: string;
        color?: string;
    }>;
    content: string;
    images?: string[];
    attachments?: any[];
    created_by?: string;
    created_by_name?: string;
}
export declare class UpdateReviewRecordDto {
    categories?: Array<{
        id?: string;
        name: string;
        color?: string;
    }>;
    content?: string;
    images?: string[];
    attachments?: any[];
}
export declare class AddConfidentialDto {
    employee_id?: string;
    employee_app_number?: string;
    employee_name?: string;
    reason?: string;
    created_by?: string;
}
