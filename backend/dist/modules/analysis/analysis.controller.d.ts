import { AnalysisService } from './analysis.service';
import { RunAnalysisDto, SearchAnalysisDto } from './analysis.dto';
export declare class AnalysisController {
    private readonly analysisService;
    constructor(analysisService: AnalysisService);
    runAnalysis(dto: RunAnalysisDto): Promise<import("./analysis.dto").AnalysisResult>;
    runAnalysisForConversation(conversationId: string, force?: boolean): Promise<import("./analysis.dto").AnalysisResult>;
    search(dto: SearchAnalysisDto): Promise<{
        data: import("./analysis.dto").AnalysisResult[];
        total: number;
    }>;
    getHighRisk(limit?: number): Promise<import("./analysis.dto").AnalysisResult[]>;
    findOne(id: string): Promise<import("./analysis.dto").AnalysisResult>;
    findByConversation(conversationId: string): Promise<import("./analysis.dto").AnalysisResult | {
        found: boolean;
        message: string;
    }>;
    findByEmployee(employeeId: string): Promise<import("./analysis.dto").AnalysisResult[]>;
    getLatestByEmployee(employeeId: string): Promise<import("./analysis.dto").AnalysisResult | {
        found: boolean;
        message: string;
    }>;
}
