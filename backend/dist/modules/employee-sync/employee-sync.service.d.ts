import { SupabaseService } from '../supabase/supabase.service';
export declare class EmployeeSyncService {
    private readonly supabase;
    private readonly logger;
    private readonly apiUrl;
    constructor(supabase: SupabaseService);
    private aesEncrypt;
    private isValidEmployee;
    getAppNumberMap(): Promise<Map<string, string>>;
    syncStoreEmployees(): Promise<{
        synced: number;
        stores: number;
    }>;
    syncBackendEmployees(): Promise<{
        synced: number;
        departments: number;
    }>;
    syncAll(): Promise<any>;
    getStats(): Promise<any>;
}
