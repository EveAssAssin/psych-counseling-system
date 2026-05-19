import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
export type AppRole = 'admin' | 'counselor';
export declare const APP_ROLES: AppRole[];
export declare const APP_ROLE_LABELS: Record<AppRole, string>;
export interface PermissionRecord {
    user_role_id: string;
    user_id: string;
    email: string | null;
    user_name: string | null;
    user_is_active: boolean;
    last_login_at: string | null;
    employee_id: string | null;
    app_number: string | null;
    erp_id: string | null;
    employee_name: string | null;
    department: string | null;
    store_name: string | null;
    title: string | null;
    employee_is_active: boolean | null;
    role: AppRole;
    scope_type: string | null;
    scope_value: any;
    granted_by: string | null;
    role_is_active: boolean;
    granted_at: string;
    expires_at: string | null;
}
export declare class PermissionsService {
    private readonly supabase;
    private readonly employeesService;
    private readonly logger;
    constructor(supabase: SupabaseService, employeesService: EmployeesService);
    list(options?: {
        onlyActive?: boolean;
        role?: AppRole;
    }): Promise<PermissionRecord[]>;
    grant(params: {
        app_number: string;
        role: AppRole;
        scope_type?: string;
        scope_value?: Record<string, any>;
    }, grantedBy?: string): Promise<PermissionRecord>;
    update(userRoleId: string, updates: {
        role?: AppRole;
        scope_type?: string;
        scope_value?: Record<string, any>;
        is_active?: boolean;
    }): Promise<PermissionRecord>;
    revoke(userRoleId: string): Promise<{
        success: true;
    }>;
    getAvailableRoles(): Array<{
        value: AppRole;
        label: string;
    }>;
}
