import { SupabaseService } from '../supabase/supabase.service';
import { EmployeeInsightService } from '../insight/employee-insight.service';
import { HolidaysService } from './holidays.service';
import { CaseDraftStoreService } from './case-draft-store.service';
import { AiPlannerService } from './ai-planner.service';
import { LefthandApiService } from '../sync/lefthand-api.service';
import { CreateCaseDraftDto, ConfirmCaseDto, UpdateCaseDto, UpdatePlanItemDto, CreateExecutionDto, UpsertStateTagDto, UpsertHolidayDto, TodayTasksQueryDto, ListCasesQueryDto } from './counseling-cases.dto';
export declare class CounselingCasesService {
    private readonly supabase;
    private readonly insight;
    private readonly holidays;
    private readonly draftStore;
    private readonly planner;
    private readonly lefthand;
    private readonly logger;
    constructor(supabase: SupabaseService, insight: EmployeeInsightService, holidays: HolidaysService, draftStore: CaseDraftStoreService, planner: AiPlannerService, lefthand: LefthandApiService);
    private get db();
    listActiveSupervisors(): Promise<{
        id: any;
        identifier: any;
        name: any;
        role: any;
        has_line_binding: boolean;
    }[]>;
    getEmployeeAttendance(appNumber: string, startDate?: string, endDate?: string): Promise<{
        success: boolean;
        message: string;
        employee: {
            name: any;
            app_number: any;
            erp_id?: undefined;
        };
        days: never[];
        range?: undefined;
    } | {
        success: boolean;
        message: string;
        employee: {
            name: any;
            app_number: any;
            erp_id: any;
        };
        days: never[];
        range?: undefined;
    } | {
        success: boolean;
        employee: {
            name: any;
            app_number: any;
            erp_id: any;
        };
        range: {
            start: string;
            end: string;
        };
        days: import("../sync/lefthand-api.service").AttendanceDayData[];
        message?: undefined;
    }>;
    listStateTags(includeInactive?: boolean): Promise<any[]>;
    upsertStateTag(dto: UpsertStateTagDto): Promise<any>;
    deactivateStateTag(id: string): Promise<{
        success: boolean;
    }>;
    listHolidays(year?: number): Promise<any[]>;
    upsertHoliday(dto: UpsertHolidayDto): Promise<any>;
    deleteHoliday(date: string): Promise<{
        success: boolean;
    }>;
    listCases(query: ListCasesQueryDto): Promise<{
        items: any[];
        total: number;
        limit: number;
        offset: number;
    }>;
    getCase(id: string): Promise<any>;
    updateCase(id: string, dto: UpdateCaseDto): Promise<any>;
    closeCase(id: string, closingSummary: string): Promise<any>;
    createDraft(dto: CreateCaseDraftDto): Promise<{
        draft_token: string;
        summary: string;
        items: any[];
        workday_dates: string[];
        employee: {
            id: string;
            name: string;
            app_number: string;
        };
        supervisor: {
            id: string;
            name: string;
        };
        state_tags: any[];
        meta: Record<string, any>;
    }>;
    confirmCase(dto: ConfirmCaseDto): Promise<any>;
    updatePlanItem(itemId: string, dto: UpdatePlanItemDto): Promise<any>;
    createExecution(caseId: string, dto: CreateExecutionDto): Promise<any>;
    listExecutions(caseId: string): Promise<any[]>;
    getTodayTasks(query: TodayTasksQueryDto): Promise<{
        date: string;
        tasks: any[];
    }>;
    getOverdueTasks(supervisorId?: string): Promise<{
        count: number;
        tasks: any[];
    }>;
}
