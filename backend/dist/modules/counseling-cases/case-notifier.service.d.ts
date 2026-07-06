import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
export declare class CaseNotifierService {
    private readonly supabase;
    private readonly config;
    private readonly logger;
    private readonly LINE_PUSH_API;
    constructor(supabase: SupabaseService, config: ConfigService);
    private get db();
    private get lineToken();
    dailyMorningPush(): Promise<void>;
    bindLineUserId(identifier: string, lineUserId: string): Promise<{
        id: any;
        identifier: any;
        name: any;
        line_user_id: any;
        role: any;
        is_active: any;
    }>;
    unbindLineUserId(identifier: string): Promise<{
        id: any;
        identifier: any;
        name: any;
    }>;
    pushTodayTasksToAll(): Promise<{
        sent: number;
        skipped: number;
        failed: number;
        details: any[];
    }>;
    pushTodayTasksToSupervisor(supervisorId: string): Promise<{
        pushed: boolean;
        reason?: string;
        today_count?: number;
        overdue_count?: number;
    }>;
    private buildMessage;
    private truncate;
    private todayInTaipei;
    private pushLineText;
}
