import { QueryService, QueryRequest } from './query.service';
export declare class QueryController {
    private readonly queryService;
    constructor(queryService: QueryService);
    query(request: QueryRequest): Promise<import("./query.service").QueryResponse>;
    getEmployeeStatus(employeeappnumber?: string, employeeerpid?: string, name?: string): Promise<{
        found: boolean;
        employee?: import("../employees").Employee;
        current_status?: any;
        latest_analysis?: import("../analysis/analysis.dto").AnalysisResult;
        open_risk_flags?: number;
    }>;
    chat(body: {
        message: string;
        session_id?: string;
        user_id?: string;
    }): Promise<import("./query.service").QueryResponse>;
}
