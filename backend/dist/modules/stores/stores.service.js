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
var StoresService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoresService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let StoresService = StoresService_1 = class StoresService {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = new common_1.Logger(StoresService_1.name);
        this.TABLE = 'stores';
    }
    async findAll() {
        return this.supabase.findMany(this.TABLE, {
            filters: { is_active: true },
            orderBy: { column: 'name', ascending: true },
            useAdmin: true,
        });
    }
    async findById(id) {
        return this.supabase.findOne(this.TABLE, { id }, { useAdmin: true });
    }
    async findByCode(store_code) {
        return this.supabase.findOne(this.TABLE, { store_code }, { useAdmin: true });
    }
    async upsert(data) {
        return this.supabase.upsert(this.TABLE, data, {
            onConflict: 'store_code',
            useAdmin: true,
        });
    }
    async upsertByErpId(data) {
        const existing = await this.supabase.findOne(this.TABLE, { store_erp_id: data.store_erp_id }, { useAdmin: true });
        if (existing) {
            const updated = await this.supabase.update(this.TABLE, { id: existing.id }, {
                ...data,
                synced_at: new Date().toISOString(),
            }, { useAdmin: true });
            return updated || existing;
        }
        else {
            return this.supabase.create(this.TABLE, {
                ...data,
                synced_at: new Date().toISOString(),
            }, { useAdmin: true });
        }
    }
};
exports.StoresService = StoresService;
exports.StoresService = StoresService = StoresService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], StoresService);
//# sourceMappingURL=stores.service.js.map