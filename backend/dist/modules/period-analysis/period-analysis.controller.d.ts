import { PeriodAnalysisService, PeriodAnalysisRequest } from './period-analysis.service';
export declare class PeriodAnalysisController {
    private readonly service;
    constructor(service: PeriodAnalysisService);
    analyze(body: PeriodAnalysisRequest): Promise<import("./period-analysis.service").PeriodAnalysisResult>;
}
