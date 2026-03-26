import { SupabaseService } from '../supabase/supabase.service';
export declare enum RiskFlagStatus {
    OPEN = "open",
    ACKNOWLEDGED = "acknowledged",
    IN_PROGRESS = "in_progress",
    RESOLVED = "resolved",
    FALSE_POSITIVE = "false_positive"
}
export interface RiskFlag {
    id: string;
    analysis_result_id?: string;
    employee_id: string;
    risk_type: string;
    severity: string;
    title: string;
    description?: string;
    evidence_text?: string;
    status: RiskFlagStatus;
    assigned_to?: string;
    acknowledged_by?: string;
    acknowledged_at?: string;
    resolved_by?: string;
    resolved_at?: string;
    resolution_note?: string;
    created_at: string;
    updated_at: string;
}
export declare class RiskFlagsService {
    private readonly supabase;
    private readonly logger;
    private readonly TABLE;
    constructor(supabase: SupabaseService);
    getOpenFlags(options?: {
        severity?: string;
        risk_type?: string;
        employee_id?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        data: RiskFlag[];
        total: number;
    }>;
    getHighRiskFlags(limit?: number): Promise<RiskFlag[]>;
    findById(id: string): Promise<RiskFlag>;
    findByEmployee(employeeId: string): Promise<RiskFlag[]>;
    acknowledge(id: string, userId: string): Promise<RiskFlag>;
    startProgress(id: string, assignedTo?: string): Promise<RiskFlag>;
    resolve(id: string, userId: string, resolutionNote?: string): Promise<RiskFlag>;
    markAsFalsePositive(id: string, userId: string, note?: string): Promise<RiskFlag>;
    getStats(): Promise<{
        total: number;
        open: number;
        inProgress: number;
        resolved: number;
        critical: number;
        high: number;
    }>;
}
