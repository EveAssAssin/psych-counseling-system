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
var RiskFlagsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskFlagsService = exports.RiskFlagStatus = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
var RiskFlagStatus;
(function (RiskFlagStatus) {
    RiskFlagStatus["OPEN"] = "open";
    RiskFlagStatus["ACKNOWLEDGED"] = "acknowledged";
    RiskFlagStatus["IN_PROGRESS"] = "in_progress";
    RiskFlagStatus["RESOLVED"] = "resolved";
    RiskFlagStatus["FALSE_POSITIVE"] = "false_positive";
})(RiskFlagStatus || (exports.RiskFlagStatus = RiskFlagStatus = {}));
let RiskFlagsService = RiskFlagsService_1 = class RiskFlagsService {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = new common_1.Logger(RiskFlagsService_1.name);
        this.TABLE = 'risk_flags';
    }
    async getOpenFlags(options) {
        const limit = options?.limit || 20;
        const offset = options?.offset || 0;
        const client = this.supabase.getAdminClient();
        let query = client
            .from(this.TABLE)
            .select('*', { count: 'exact' })
            .in('status', ['open', 'acknowledged', 'in_progress']);
        if (options?.severity) {
            query = query.eq('severity', options.severity);
        }
        if (options?.risk_type) {
            query = query.eq('risk_type', options.risk_type);
        }
        if (options?.employee_id) {
            query = query.eq('employee_id', options.employee_id);
        }
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        const { data, count, error } = await query;
        if (error)
            throw error;
        return { data: data || [], total: count || 0 };
    }
    async getHighRiskFlags(limit = 20) {
        const client = this.supabase.getAdminClient();
        const { data, error } = await client
            .from(this.TABLE)
            .select('*')
            .in('status', ['open', 'acknowledged', 'in_progress'])
            .in('severity', ['critical', 'high'])
            .order('severity', { ascending: true })
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error)
            throw error;
        return data || [];
    }
    async findById(id) {
        const flag = await this.supabase.findOne(this.TABLE, { id }, { useAdmin: true });
        if (!flag) {
            throw new common_1.NotFoundException(`Risk flag not found: ${id}`);
        }
        return flag;
    }
    async findByEmployee(employeeId) {
        return this.supabase.findMany(this.TABLE, {
            filters: { employee_id: employeeId },
            orderBy: { column: 'created_at', ascending: false },
            useAdmin: true,
        });
    }
    async acknowledge(id, userId) {
        const updated = await this.supabase.update(this.TABLE, { id }, {
            status: RiskFlagStatus.ACKNOWLEDGED,
            acknowledged_by: userId,
            acknowledged_at: new Date().toISOString(),
        }, { useAdmin: true });
        if (!updated) {
            throw new common_1.NotFoundException(`Risk flag not found: ${id}`);
        }
        this.logger.log(`Risk flag acknowledged: ${id} by ${userId}`);
        return updated;
    }
    async startProgress(id, assignedTo) {
        const updated = await this.supabase.update(this.TABLE, { id }, {
            status: RiskFlagStatus.IN_PROGRESS,
            assigned_to: assignedTo,
        }, { useAdmin: true });
        if (!updated) {
            throw new common_1.NotFoundException(`Risk flag not found: ${id}`);
        }
        return updated;
    }
    async resolve(id, userId, resolutionNote) {
        const updated = await this.supabase.update(this.TABLE, { id }, {
            status: RiskFlagStatus.RESOLVED,
            resolved_by: userId,
            resolved_at: new Date().toISOString(),
            resolution_note: resolutionNote,
        }, { useAdmin: true });
        if (!updated) {
            throw new common_1.NotFoundException(`Risk flag not found: ${id}`);
        }
        this.logger.log(`Risk flag resolved: ${id} by ${userId}`);
        return updated;
    }
    async markAsFalsePositive(id, userId, note) {
        const updated = await this.supabase.update(this.TABLE, { id }, {
            status: RiskFlagStatus.FALSE_POSITIVE,
            resolved_by: userId,
            resolved_at: new Date().toISOString(),
            resolution_note: note || 'Marked as false positive',
        }, { useAdmin: true });
        if (!updated) {
            throw new common_1.NotFoundException(`Risk flag not found: ${id}`);
        }
        this.logger.log(`Risk flag marked as false positive: ${id}`);
        return updated;
    }
    async getStats() {
        const client = this.supabase.getAdminClient();
        const [total, open, inProgress, resolved, critical, high] = await Promise.all([
            this.supabase.count(this.TABLE, {}, { useAdmin: true }),
            this.supabase.count(this.TABLE, { status: 'open' }, { useAdmin: true }),
            this.supabase.count(this.TABLE, { status: 'in_progress' }, { useAdmin: true }),
            this.supabase.count(this.TABLE, { status: 'resolved' }, { useAdmin: true }),
            this.supabase.count(this.TABLE, { severity: 'critical' }, { useAdmin: true }),
            this.supabase.count(this.TABLE, { severity: 'high' }, { useAdmin: true }),
        ]);
        return { total, open, inProgress, resolved, critical, high };
    }
};
exports.RiskFlagsService = RiskFlagsService;
exports.RiskFlagsService = RiskFlagsService = RiskFlagsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], RiskFlagsService);
//# sourceMappingURL=risk-flags.service.js.map