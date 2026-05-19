import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { StoresService } from '../stores/stores.service';
import { LefthandApiService } from './lefthand-api.service';
import { TicketApiService } from './ticket-api.service';
export interface SyncLog {
    id: string;
    sync_type: string;
    source_name?: string;
    status: 'started' | 'running' | 'completed' | 'failed' | 'partial';
    started_at: string;
    finished_at?: string;
    total_fetched: number;
    total_created: number;
    total_updated: number;
    total_skipped: number;
    total_failed: number;
    error_message?: string;
    error_details?: Record<string, any>;
    triggered_by?: string;
    trigger_type: string;
    created_at: string;
}
export declare class SyncService {
    private readonly configService;
    private readonly supabase;
    private readonly employeesService;
    private readonly storesService;
    private readonly lefthandApi;
    private readonly ticketApi;
    private readonly logger;
    private readonly SYNC_LOGS_TABLE;
    constructor(configService: ConfigService, supabase: SupabaseService, employeesService: EmployeesService, storesService: StoresService, lefthandApi: LefthandApiService, ticketApi: TicketApiService);
    private readonly NON_STORE_DEPARTMENTS;
    private readonly EXCLUDED_KEYWORDS;
    syncEmployees(triggeredBy?: string): Promise<SyncLog>;
    private syncStore;
    syncDailyData(triggeredBy?: string): Promise<SyncLog>;
    syncOfficialChannelConversations(triggeredBy?: string): Promise<{
        fetched: number;
        created: number;
        failed: number;
    }>;
    private syncExternalSource;
    private createSyncLog;
    private updateSyncLog;
    getSyncLog(id: string): Promise<SyncLog>;
    getSyncStatus(): Promise<{
        cursors: Record<string, any>;
        recentLogs: SyncLog[];
    }>;
    getRecentSyncLogs(limit?: number): Promise<SyncLog[]>;
    private readonly OCM_TABLE;
    private readonly SYNC_CURSORS_TABLE;
    syncOfficialChannelMessages(triggeredBy?: string, force?: boolean): Promise<SyncLog>;
    private upsertOfficialChannelMessages;
    private readonly ETH_TABLE;
    private readonly TC_TABLE;
    syncTicketHistory(triggeredBy?: string): Promise<SyncLog>;
    private upsertTicketHistory;
    private readonly CFS_TABLE;
    syncCustomerFeedbackStats(triggeredBy?: string): Promise<SyncLog>;
    private getSyncCursor;
    syncReviewData(triggeredBy?: string): Promise<SyncLog>;
    private upsertExternalReview;
    private syncReviewResponses;
    private updateSyncCursor;
    resetSyncCursor(syncType: string): Promise<{
        success: boolean;
        message: string;
    }>;
    patchStoreNamesFromPayload(): Promise<{
        updated: number;
        skipped: number;
    }>;
}
