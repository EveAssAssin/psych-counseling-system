import { EmployeeSyncService } from './employee-sync.service';
export declare class EmployeeSyncController {
    private readonly syncService;
    constructor(syncService: EmployeeSyncService);
    syncStores(): Promise<{
        success: boolean;
        data: {
            synced: number;
            stores: number;
        };
    }>;
    syncBackend(): Promise<{
        success: boolean;
        data: {
            synced: number;
            departments: number;
        };
    }>;
    syncAll(): Promise<{
        success: boolean;
        data: any;
    }>;
    getStats(): Promise<{
        success: boolean;
        data: any;
    }>;
}
