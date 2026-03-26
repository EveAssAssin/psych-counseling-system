export interface Employee {
    id: string;
    employeeappnumber: string;
    employeeerpid?: string;
    name: string;
    role?: string;
    title?: string;
    store_id?: string;
    store_name?: string;
    department?: string;
    email?: string;
    phone?: string;
    hire_date?: string;
    is_active: boolean;
    is_leave: boolean;
    leave_type?: string;
    leave_start_date?: string;
    leave_end_date?: string;
    source_payload?: Record<string, any>;
    source_updated_at?: string;
    synced_at?: string;
    created_at: string;
    updated_at: string;
}
export declare class CreateEmployeeDto {
    employeeappnumber: string;
    employeeerpid?: string;
    name: string;
    role?: string;
    title?: string;
    store_id?: string;
    store_name?: string;
    department?: string;
    email?: string;
    phone?: string;
    hire_date?: string;
    is_active?: boolean;
    is_leave?: boolean;
}
export declare class UpdateEmployeeDto {
    employeeerpid?: string;
    name?: string;
    role?: string;
    title?: string;
    store_id?: string;
    store_name?: string;
    department?: string;
    email?: string;
    phone?: string;
    is_active?: boolean;
    is_leave?: boolean;
    leave_type?: string;
    leave_start_date?: string;
    leave_end_date?: string;
}
export declare class SearchEmployeeDto {
    q?: string;
    store_id?: string;
    department?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
}
export declare class EmployeeResponseDto {
    id: string;
    employeeappnumber: string;
    employeeerpid?: string;
    name: string;
    role?: string;
    title?: string;
    store_id?: string;
    store_name?: string;
    department?: string;
    is_active: boolean;
    is_leave: boolean;
    created_at: string;
    updated_at: string;
}
export declare class EmployeeListResponseDto {
    data: EmployeeResponseDto[];
    total: number;
    limit: number;
    offset: number;
}
