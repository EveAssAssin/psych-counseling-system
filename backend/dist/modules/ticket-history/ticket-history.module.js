"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketHistoryModule = void 0;
const common_1 = require("@nestjs/common");
const ticket_history_controller_1 = require("./ticket-history.controller");
const ticket_history_service_1 = require("./ticket-history.service");
const supabase_module_1 = require("../supabase/supabase.module");
let TicketHistoryModule = class TicketHistoryModule {
};
exports.TicketHistoryModule = TicketHistoryModule;
exports.TicketHistoryModule = TicketHistoryModule = __decorate([
    (0, common_1.Module)({
        imports: [supabase_module_1.SupabaseModule],
        controllers: [ticket_history_controller_1.TicketHistoryController],
        providers: [ticket_history_service_1.TicketHistoryService],
        exports: [ticket_history_service_1.TicketHistoryService],
    })
], TicketHistoryModule);
//# sourceMappingURL=ticket-history.module.js.map