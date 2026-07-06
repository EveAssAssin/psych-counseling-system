export interface CaseDraftPayload {
    form: {
        employee_app_number: string;
        supervisor_id: string;
        state_tag_codes: string[];
        state_description?: string;
        goal: string;
        start_date: string;
        target_end_date: string;
        allowed_methods: string[];
    };
    resolved: {
        employee_id: string;
        employee_name: string;
        supervisor_name: string;
    };
    insight_snapshot: any;
    ai_summary: string;
    draft_items: Array<{
        sequence: number;
        scheduled_date: string;
        method: string;
        objective: string;
        recommended_actions: Record<string, any>;
        estimated_minutes: number;
    }>;
    ai_meta: Record<string, any>;
    created_at: number;
}
export declare class CaseDraftStoreService {
    private readonly logger;
    private readonly store;
    private readonly TTL_MS;
    private readonly PRUNE_INTERVAL_MS;
    constructor();
    put(payload: CaseDraftPayload): string;
    get(token: string): CaseDraftPayload | null;
    delete(token: string): boolean;
    prune(): number;
    size(): number;
}
