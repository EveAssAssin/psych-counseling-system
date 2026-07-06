import { SupabaseService } from '../supabase/supabase.service';
export declare class HolidaysService {
    private readonly supabase;
    private readonly logger;
    private cache;
    private readonly TTL_MS;
    constructor(supabase: SupabaseService);
    private get db();
    invalidateCache(): void;
    private ensureCache;
    private parseDate;
    private formatDate;
    isWorkday(date: string | Date): Promise<boolean>;
    nextWorkday(fromDate: string | Date): Promise<string>;
    getWorkdayDates(start: string | Date, end: string | Date): Promise<string[]>;
    workdaysBetween(start: string | Date, end: string | Date): Promise<number>;
    addWorkdays(startDate: string | Date, n: number): Promise<string>;
}
