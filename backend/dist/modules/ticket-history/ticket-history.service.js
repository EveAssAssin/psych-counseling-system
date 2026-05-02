"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TicketHistoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketHistoryService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let TicketHistoryService = TicketHistoryService_1 = class TicketHistoryService {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = new common_1.Logger(TicketHistoryService_1.name);
        this.TABLE = 'employee_ticket_history';
        this.CONV_TABLE = 'ticket_conversations';
    }
    async getByEmployeeId(employeeId, limit = 50) {
        return this.supabase.findMany(this.TABLE, {
            filters: { employee_id: employeeId },
            orderBy: { column: 'ticket_created_at', ascending: false },
            limit,
            useAdmin: true,
        });
    }
    async getByEmployeeAppNumber(appNumber, limit = 50) {
        return this.supabase.findMany(this.TABLE, {
            filters: { employee_app_number: appNumber },
            orderBy: { column: 'ticket_created_at', ascending: false },
            limit,
            useAdmin: true,
        });
    }
    async getByTicketId(ticketId) {
        return this.supabase.findOne(this.TABLE, { ticket_id: ticketId }, { useAdmin: true });
    }
    async getConversationsByTicketId(ticketId) {
        return this.supabase.findMany(this.CONV_TABLE, {
            filters: { ticket_id: ticketId },
            orderBy: { column: 'event_created_at', ascending: true },
            useAdmin: true,
        });
    }
    async getStatsByEmployeeAppNumber(appNumber) {
        const tickets = await this.getByEmployeeAppNumber(appNumber, 9999);
        const byStatus = {};
        const byPriority = {};
        const categoryMap = {};
        for (const t of tickets) {
            byStatus[t.status] = (byStatus[t.status] || 0) + 1;
            byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
            if (t.parent_category) {
                categoryMap[t.parent_category] = (categoryMap[t.parent_category] || 0) + 1;
            }
        }
        const byCategory = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));
        return {
            total: tickets.length,
            by_status: byStatus,
            by_priority: byPriority,
            by_category: byCategory,
        };
    }
    async search(params) {
        const filters = {};
        if (params.employee_id)
            filters.employee_id = params.employee_id;
        if (params.employee_app_number)
            filters.employee_app_number = params.employee_app_number;
        if (params.status)
            filters.status = params.status;
        if (params.priority)
            filters.priority = params.priority;
        if (params.parent_category)
            filters.parent_category = params.parent_category;
        const data = await this.supabase.findMany(this.TABLE, {
            filters,
            orderBy: { column: 'ticket_created_at', ascending: false },
            limit: params.limit || 50,
            offset: params.offset || 0,
            useAdmin: true,
        });
        return { data, total: data.length };
    }
};
exports.TicketHistoryService = TicketHistoryService;
exports.TicketHistoryService = TicketHistoryService = TicketHistoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], TicketHistoryService);
//# sourceMappingURL=ticket-history.service.js.map