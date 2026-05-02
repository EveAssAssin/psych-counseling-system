import { TicketHistoryService } from './ticket-history.service';
export declare class TicketHistoryController {
    private readonly ticketHistoryService;
    constructor(ticketHistoryService: TicketHistoryService);
    getByEmployeeId(employeeId: string, limit?: number): Promise<import("./ticket-history.service").TicketHistory[]>;
    getByAppNumber(appNumber: string, limit?: number): Promise<import("./ticket-history.service").TicketHistory[]>;
    getStats(appNumber: string): Promise<{
        total: number;
        by_status: Record<string, number>;
        by_priority: Record<string, number>;
        by_category: {
            category: string;
            count: number;
        }[];
    }>;
    getConversations(ticketId: number): Promise<import("./ticket-history.service").TicketConversation[]>;
    getByTicketId(ticketId: number): Promise<import("./ticket-history.service").TicketHistory | null>;
}
