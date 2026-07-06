import { CounselingCasesService } from './counseling-cases.service';
import { CaseAiService } from './case-ai.service';
import { CaseNotifierService } from './case-notifier.service';
import { CreateCaseDraftDto, ConfirmCaseDto, UpdateCaseDto, UpdatePlanItemDto, CreateExecutionDto, UpsertStateTagDto, UpsertHolidayDto, TodayTasksQueryDto, ListCasesQueryDto } from './counseling-cases.dto';
export declare class CounselingCasesController {
    private readonly svc;
    private readonly aiSvc;
    private readonly notifier;
    constructor(svc: CounselingCasesService, aiSvc: CaseAiService, notifier: CaseNotifierService);
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
    listSupervisors(): Promise<{
        id: any;
        identifier: any;
        name: any;
        role: any;
        has_line_binding: boolean;
    }[]>;
    listStateTags(includeInactive?: string): Promise<any[]>;
    upsertStateTag(dto: UpsertStateTagDto): Promise<any>;
    deactivateStateTag(id: string): Promise<{
        success: boolean;
    }>;
    listHolidays(year?: string): Promise<any[]>;
    upsertHoliday(dto: UpsertHolidayDto): Promise<any>;
    deleteHoliday(date: string): Promise<{
        success: boolean;
    }>;
    getToday(query: TodayTasksQueryDto): Promise<{
        date: string;
        tasks: any[];
    }>;
    getOverdue(supervisorId?: string): Promise<{
        count: number;
        tasks: any[];
    }>;
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
    confirm(dto: ConfirmCaseDto): Promise<any>;
    list(query: ListCasesQueryDto): Promise<{
        items: any[];
        total: number;
        limit: number;
        offset: number;
    }>;
    get(id: string): Promise<any>;
    update(id: string, dto: UpdateCaseDto): Promise<any>;
    close(id: string, body: {
        closing_summary: string;
    }): Promise<any>;
    updatePlanItem(itemId: string, dto: UpdatePlanItemDto): Promise<any>;
    createExecution(id: string, dto: CreateExecutionDto): Promise<any>;
    listExecutions(id: string): Promise<any[]>;
    listAiSessions(id: string): Promise<any[]>;
    openAiSession(id: string, body: {
        supervisor_identifier: string;
    }): Promise<any>;
    listAiMessages(sessionId: string, supervisorIdentifier: string): Promise<any[]>;
    sendAiMessage(sessionId: string, body: {
        supervisor_identifier: string;
        content: string;
    }): Promise<{
        user_message: any;
        assistant_message: any;
    }>;
    bindLine(body: {
        identifier: string;
        line_user_id: string;
    }): Promise<{
        id: any;
        identifier: any;
        name: any;
        line_user_id: any;
        role: any;
        is_active: any;
    }>;
    unbindLine(identifier: string): Promise<{
        id: any;
        identifier: any;
        name: any;
    }>;
    notifyToday(): Promise<{
        sent: number;
        skipped: number;
        failed: number;
        details: any[];
    }>;
    notifyTodayOne(supervisorId: string): Promise<{
        pushed: boolean;
        reason?: string;
        today_count?: number;
        overdue_count?: number;
    }>;
}
