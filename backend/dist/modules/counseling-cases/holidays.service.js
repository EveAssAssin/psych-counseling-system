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
var HolidaysService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HolidaysService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let HolidaysService = HolidaysService_1 = class HolidaysService {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = new common_1.Logger(HolidaysService_1.name);
        this.cache = null;
        this.TTL_MS = 10 * 60 * 1000;
    }
    get db() { return this.supabase.getAdminClient(); }
    invalidateCache() { this.cache = null; }
    async ensureCache() {
        if (this.cache && Date.now() - this.cache.fetchedAt < this.TTL_MS)
            return this.cache.map;
        const { data, error } = await this.db
            .from('counseling_holidays')
            .select('date, type, is_workday');
        if (error)
            throw error;
        const map = new Map();
        for (const row of data ?? []) {
            map.set(row.date, { type: row.type, is_workday: !!row.is_workday });
        }
        this.cache = { fetchedAt: Date.now(), map };
        return map;
    }
    parseDate(d) {
        if (d instanceof Date)
            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const [y, m, day] = d.split('-').map(Number);
        return new Date(y, m - 1, day);
    }
    formatDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    async isWorkday(date) {
        const d = this.parseDate(date);
        const key = this.formatDate(d);
        const map = await this.ensureCache();
        const entry = map.get(key);
        if (entry && entry.is_workday)
            return true;
        if (entry && !entry.is_workday)
            return false;
        const dow = d.getDay();
        return dow !== 0 && dow !== 6;
    }
    async nextWorkday(fromDate) {
        let d = this.parseDate(fromDate);
        for (let i = 0; i < 30; i++) {
            if (await this.isWorkday(d))
                return this.formatDate(d);
            d.setDate(d.getDate() + 1);
        }
        throw new Error(`No workday found within 30 days from ${this.formatDate(this.parseDate(fromDate))}`);
    }
    async getWorkdayDates(start, end) {
        const startD = this.parseDate(start);
        const endD = this.parseDate(end);
        if (startD > endD)
            return [];
        const result = [];
        const cur = new Date(startD);
        while (cur <= endD) {
            if (await this.isWorkday(cur))
                result.push(this.formatDate(cur));
            cur.setDate(cur.getDate() + 1);
        }
        return result;
    }
    async workdaysBetween(start, end) {
        return (await this.getWorkdayDates(start, end)).length;
    }
    async addWorkdays(startDate, n) {
        if (n < 0)
            throw new Error('n must be >= 0');
        let d = this.parseDate(startDate);
        while (!(await this.isWorkday(d)))
            d.setDate(d.getDate() + 1);
        let count = 0;
        while (count < n) {
            d.setDate(d.getDate() + 1);
            if (await this.isWorkday(d))
                count++;
        }
        return this.formatDate(d);
    }
};
exports.HolidaysService = HolidaysService;
exports.HolidaysService = HolidaysService = HolidaysService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], HolidaysService);
//# sourceMappingURL=holidays.service.js.map