import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
export interface OrderTrendItem {
    label: string;
    recentAvg: number;
    prevAvg: number;
    trend: 'up' | 'down' | 'stable' | 'new';
    changePercent: number | null;
    months: Array<{
        year: number;
        month: number;
        count: number;
    }>;
}
export interface EmployeeOrderTrend {
    hasData: boolean;
    lastSyncedMonth: string | null;
    totalTrend: OrderTrendItem;
    byLabel: OrderTrendItem[];
}
export declare class OrderStatsService {
    private readonly supabase;
    private readonly config;
    private readonly logger;
    private readonly E0123_BASE_URL;
    private readonly E0123_COMPANY_ID;
    private readonly E0123_TOKEN;
    constructor(supabase: SupabaseService, config: ConfigService);
    private get db();
    syncMonthOrderStats(year: number, month: number): Promise<{
        success: boolean;
        synced: number;
        message: string;
    }>;
    syncRecentMonths(): Promise<{
        success: boolean;
        message: string;
    }>;
    getEmployeeOrderTrend(appNumber: string): Promise<EmployeeOrderTrend>;
    private calcTrend;
    private emptyTrend;
    getStoreMemberTrends(storeName: string, excludeAppNumber?: string): Promise<{
        memberCount: number;
        storeAvg: {
            recentAvg: number;
            prevAvg: number;
            changePercent: number | null;
            trend: string;
        };
        members: Array<{
            name: string;
            app_number: string;
            recentAvg: number;
            prevAvg: number;
            trend: string;
            changePercent: number | null;
        }>;
    }>;
}
