import { SyncService } from './sync.service';
import { OrderStatsService } from './order-stats.service';
export declare class SyncController {
    private readonly syncService;
    private readonly orderStatsService;
    constructor(syncService: SyncService, orderStatsService: OrderStatsService);
    syncEmployees(triggeredBy?: string): Promise<import("./sync.service").SyncLog>;
    syncDailyData(triggeredBy?: string): Promise<import("./sync.service").SyncLog>;
    syncOfficialChannel(triggeredBy?: string, force?: string): Promise<import("./sync.service").SyncLog>;
    resetCursor(type: string): Promise<{
        success: boolean;
        message: string;
    }>;
    syncTicketHistory(triggeredBy?: string): Promise<import("./sync.service").SyncLog>;
    syncReviewData(triggeredBy?: string): Promise<import("./sync.service").SyncLog>;
    syncCustomerFeedbackStats(triggeredBy?: string): Promise<import("./sync.service").SyncLog>;
    getSyncStatus(): Promise<{
        cursors: Record<string, any>;
        recentLogs: import("./sync.service").SyncLog[];
    }>;
    getSyncLogs(limit?: number): Promise<import("./sync.service").SyncLog[]>;
    getSyncLog(id: string): Promise<import("./sync.service").SyncLog>;
    patchStoreNames(): Promise<{
        updated: number;
        skipped: number;
    }>;
    syncOrderStats(): Promise<{
        success: boolean;
        message: string;
    }>;
    syncOrderStatsMonth(year: string, month: string): Promise<{
        success: boolean;
        synced: number;
        message: string;
    }>;
    getOrderTrend(appNumber: string): Promise<import("./order-stats.service").EmployeeOrderTrend>;
}
