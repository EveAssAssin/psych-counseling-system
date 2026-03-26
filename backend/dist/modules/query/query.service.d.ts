import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';
import { Employee } from '../employees/employees.dto';
import { AnalysisService } from '../analysis/analysis.service';
import { AnalysisResult } from '../analysis/analysis.dto';
export interface QueryRequest {
    question: string;
    employee_identifier?: {
        employeeappnumber?: string;
        employeeerpid?: string;
        name?: string;
    };
    context?: string;
    requester_id?: string;
}
export interface QueryResponse {
    answer: string;
    employee?: {
        id: string;
        name: string;
        employeeappnumber: string;
    };
    latest_analysis?: {
        id: string;
        risk_level: string;
        stress_level: string;
        summary: string;
        created_at: string;
    };
    confidence: number;
    sources: string[];
}
export declare class QueryService {
    private readonly configService;
    private readonly supabase;
    private readonly employeesService;
    private readonly analysisService;
    private readonly logger;
    private readonly anthropic;
    constructor(configService: ConfigService, supabase: SupabaseService, employeesService: EmployeesService, analysisService: AnalysisService);
    query(request: QueryRequest): Promise<QueryResponse>;
    getEmployeeStatusSummary(employeeIdentifier: {
        employeeappnumber?: string;
        employeeerpid?: string;
        name?: string;
    }): Promise<{
        found: boolean;
        employee?: Employee;
        current_status?: any;
        latest_analysis?: AnalysisResult;
        open_risk_flags?: number;
    }>;
    private generateAIAnswer;
    private buildBasicResponse;
    private logQuery;
    private translateRiskLevel;
    private translateStressLevel;
}
