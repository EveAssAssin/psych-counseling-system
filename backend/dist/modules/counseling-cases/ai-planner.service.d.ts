import { ConfigService } from '@nestjs/config';
export interface PlannerInput {
    employee: {
        name: string;
        app_number: string;
        department?: string;
        store_name?: string;
        title?: string;
    };
    state_tags: Array<{
        code: string;
        label: string;
        description?: string;
        ai_prompt_hint?: string;
        severity?: string;
    }>;
    state_description?: string;
    goal: string;
    allowed_methods: string[];
    workday_count: number;
    start_date: string;
    target_end_date: string;
    insight_summary?: any;
}
export interface PlannerOutput {
    summary: string;
    items: Array<{
        sequence: number;
        workday_offset: number;
        method: string;
        objective: string;
        recommended_actions: Record<string, any>;
        estimated_minutes: number;
    }>;
    meta: {
        model: string;
        input_tokens?: number;
        output_tokens?: number;
        generated_at: string;
    };
}
export declare class AiPlannerService {
    private readonly config;
    private readonly logger;
    private readonly anthropic;
    private readonly model;
    constructor(config: ConfigService);
    generateDraft(input: PlannerInput): Promise<PlannerOutput>;
    private buildSystemPrompt;
    private buildUserPrompt;
    private summarizeInsight;
    private extractJson;
    private validateAndNormalizeItems;
}
