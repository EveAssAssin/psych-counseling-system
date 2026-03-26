import { SupabaseService } from '../supabase/supabase.service';
export interface Store {
    id: string;
    store_code?: string;
    store_erp_id?: string;
    name: string;
    region?: string;
    address?: string;
    is_active: boolean;
    source_payload?: Record<string, any>;
    synced_at?: string;
    created_at: string;
    updated_at: string;
}
export declare class StoresService {
    private readonly supabase;
    private readonly logger;
    private readonly TABLE;
    constructor(supabase: SupabaseService);
    findAll(): Promise<Store[]>;
    findById(id: string): Promise<Store | null>;
    findByCode(store_code: string): Promise<Store | null>;
    upsert(data: Partial<Store>): Promise<Store>;
    upsertByErpId(data: Partial<Store>): Promise<Store>;
}
