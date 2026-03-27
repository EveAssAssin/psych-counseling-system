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
var OfficialChannelService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfficialChannelService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let OfficialChannelService = OfficialChannelService_1 = class OfficialChannelService {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = new common_1.Logger(OfficialChannelService_1.name);
        this.TABLE = 'official_channel_messages';
    }
    async getByEmployeeId(employeeId, limit = 50) {
        return this.supabase.findMany(this.TABLE, {
            filters: { employee_id: employeeId },
            orderBy: { column: 'message_time', ascending: false },
            limit,
            useAdmin: true,
        });
    }
    async getByEmployeeAppNumber(appNumber, limit = 50) {
        return this.supabase.findMany(this.TABLE, {
            filters: { employee_app_number: appNumber },
            orderBy: { column: 'message_time', ascending: false },
            limit,
            useAdmin: true,
        });
    }
    async search(params) {
        const filters = {};
        if (params.employee_id)
            filters.employee_id = params.employee_id;
        if (params.employee_app_number)
            filters.employee_app_number = params.employee_app_number;
        if (params.channel)
            filters.channel = params.channel;
        const data = await this.supabase.findMany(this.TABLE, {
            filters,
            orderBy: { column: 'message_time', ascending: false },
            limit: params.limit || 50,
            offset: params.offset || 0,
            useAdmin: true,
        });
        return { data, total: data.length };
    }
    async getById(id) {
        return this.supabase.findOne(this.TABLE, { id }, { useAdmin: true });
    }
    async getStats() {
        const allMessages = await this.supabase.findMany(this.TABLE, {
            useAdmin: true,
        });
        const byChannel = {};
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        let recentCount = 0;
        for (const msg of allMessages) {
            byChannel[msg.channel] = (byChannel[msg.channel] || 0) + 1;
            if (new Date(msg.message_time) > sevenDaysAgo) {
                recentCount++;
            }
        }
        return {
            total: allMessages.length,
            by_channel: byChannel,
            recent_count: recentCount,
        };
    }
};
exports.OfficialChannelService = OfficialChannelService;
exports.OfficialChannelService = OfficialChannelService = OfficialChannelService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], OfficialChannelService);
//# sourceMappingURL=official-channel.service.js.map