import { RiskFlagsService } from './risk-flags.service';
export declare class RiskFlagsController {
    private readonly riskFlagsService;
    constructor(riskFlagsService: RiskFlagsService);
    getOpenFlags(severity?: string, riskType?: string, employeeId?: string, limit?: number, offset?: number): Promise<{
        data: import("./risk-flags.service").RiskFlag[];
        total: number;
    }>;
    getHighRiskFlags(limit?: number): Promise<import("./risk-flags.service").RiskFlag[]>;
    getStats(): Promise<{
        total: number;
        open: number;
        inProgress: number;
        resolved: number;
        critical: number;
        high: number;
    }>;
    findOne(id: string): Promise<import("./risk-flags.service").RiskFlag>;
    findByEmployee(employeeId: string): Promise<import("./risk-flags.service").RiskFlag[]>;
    acknowledge(id: string, userId: string): Promise<import("./risk-flags.service").RiskFlag>;
    startProgress(id: string, assignedTo?: string): Promise<import("./risk-flags.service").RiskFlag>;
    resolve(id: string, body: {
        user_id: string;
        resolution_note?: string;
    }): Promise<import("./risk-flags.service").RiskFlag>;
    markAsFalsePositive(id: string, body: {
        user_id: string;
        note?: string;
    }): Promise<import("./risk-flags.service").RiskFlag>;
}
