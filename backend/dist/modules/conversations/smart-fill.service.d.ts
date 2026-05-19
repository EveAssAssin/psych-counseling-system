import { ConfigService } from '@nestjs/config';
import { EmployeesService } from '../employees/employees.service';
export interface SmartFillSuggestions {
    employee_match: {
        detected_name: string;
        employee_id: string | null;
        employee_name: string | null;
        employeeappnumber: string | null;
        confidence: 'high' | 'medium' | 'low';
        note?: string;
    } | null;
    interviewer_name: string | null;
    background_note: string;
    cleaned_text: string;
    speakers: Array<{
        original_label: string;
        role: 'supervisor' | 'employee' | 'unknown';
        name?: string;
    }>;
    preliminary_risk_signals: string[];
    potential_transcription_errors: Array<{
        suspicious_text: string;
        likely_correct: string;
        reason: string;
    }>;
    confidence_score: number;
}
export declare class SmartFillService {
    private readonly config;
    private readonly employeesService;
    private readonly logger;
    private readonly anthropic;
    private readonly model;
    constructor(config: ConfigService, employeesService: EmployeesService);
    processTranscript(rawTranscript: string, options?: {
        hintInterviewerName?: string;
        hintEmployeeName?: string;
    }): Promise<SmartFillSuggestions>;
    private buildHints;
    private parseJsonResponse;
    private matchEmployee;
    private fallbackSuggestions;
}
