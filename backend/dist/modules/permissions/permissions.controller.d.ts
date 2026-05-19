import { Request } from 'express';
import { PermissionsService, AppRole } from './permissions.service';
export declare class PermissionsController {
    private readonly permissionsService;
    constructor(permissionsService: PermissionsService);
    getAvailableRoles(): {
        value: AppRole;
        label: string;
    }[];
    list(onlyActive?: string, role?: AppRole): Promise<import("./permissions.service").PermissionRecord[]>;
    grant(body: {
        app_number: string;
        role: AppRole;
        scope_type?: string;
        scope_value?: Record<string, any>;
    }, req: Request): Promise<import("./permissions.service").PermissionRecord>;
    update(id: string, body: {
        role?: AppRole;
        scope_type?: string;
        scope_value?: Record<string, any>;
        is_active?: boolean;
    }): Promise<import("./permissions.service").PermissionRecord>;
    revoke(id: string): Promise<void>;
}
