import { SyncService } from './sync.service';
export declare class SyncController {
    private readonly syncService;
    constructor(syncService: SyncService);
    syncEmployees(triggeredBy?: string): Promise<import("./sync.service").SyncLog>;
    syncDailyData(triggeredBy?: string): Promise<import("./sync.service").SyncLog>;
    syncOfficialChannel(triggeredBy?: string): Promise<import("./sync.service").SyncLog>;
    syncTicketHistory(triggeredBy?: string): Promise<import("./sync.service").SyncLog>;
    syncReviewData(triggeredBy?: string): Promise<import("./sync.service").SyncLog>;
    getSyncStatus(): Promise<{
        cursors: Record<string, any>;
        recentLogs: import("./sync.service").SyncLog[];
    }>;
    getSyncLogs(limit?: number): Promise<import("./sync.service").SyncLog[]>;
    getSyncLog(id: string): Promise<import("./sync.service").SyncLog>;
}
