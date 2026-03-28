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
var EmployeesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeesService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let EmployeesService = EmployeesService_1 = class EmployeesService {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = new common_1.Logger(EmployeesService_1.name);
        this.TABLE = 'employees';
    }
    async create(dto) {
        this.logger.log(`Creating employee: ${dto.employeeappnumber}`);
        const employee = await this.supabase.create(this.TABLE, {
            ...dto,
            is_active: dto.is_active ?? true,
            is_leave: dto.is_leave ?? false,
            synced_at: new Date().toISOString(),
        }, { useAdmin: true });
        this.logger.log(`Employee created: ${employee.id}`);
        return employee;
    }
    async findById(id) {
        const employee = await this.supabase.findOne(this.TABLE, { id }, { useAdmin: true });
        if (!employee) {
            throw new common_1.NotFoundException(`Employee not found: ${id}`);
        }
        return employee;
    }
    async findByAppNumber(employeeappnumber) {
        return this.supabase.findOne(this.TABLE, { employeeappnumber }, { useAdmin: true });
    }
    async findByErpId(employeeerpid) {
        return this.supabase.findOne(this.TABLE, { employeeerpid }, { useAdmin: true });
    }
    async search(dto) {
        const limit = dto.limit || 20;
        const offset = dto.offset || 0;
        const client = this.supabase.getAdminClient();
        if (dto.q) {
            let query = client.from(this.TABLE).select('*');
            if (dto.store_id) {
                query = query.eq('store_id', dto.store_id);
            }
            if (dto.department) {
                query = query.eq('department', dto.department);
            }
            if (dto.is_active !== undefined) {
                query = query.eq('is_active', dto.is_active);
            }
            const { data: allData, error } = await query.order('name', { ascending: true });
            if (error) {
                this.logger.error('Error searching employees:', error);
                throw error;
            }
            const searchTerm = dto.q.toLowerCase();
            const filtered = (allData || []).filter((emp) => {
                return (emp.name?.toLowerCase().includes(searchTerm) ||
                    emp.employeeappnumber?.toLowerCase().includes(searchTerm) ||
                    emp.employeeerpid?.toLowerCase().includes(searchTerm) ||
                    emp.store_name?.toLowerCase().includes(searchTerm) ||
                    emp.department?.toLowerCase().includes(searchTerm));
            });
            const paged = filtered.slice(offset, offset + limit);
            return {
                data: paged,
                total: filtered.length,
                limit,
                offset,
            };
        }
        let query = client.from(this.TABLE).select('*', { count: 'exact' });
        if (dto.store_id) {
            query = query.eq('store_id', dto.store_id);
        }
        if (dto.department) {
            query = query.eq('department', dto.department);
        }
        if (dto.is_active !== undefined) {
            query = query.eq('is_active', dto.is_active);
        }
        query = query
            .order('name', { ascending: true })
            .range(offset, offset + limit - 1);
        const { data, count, error } = await query;
        if (error) {
            this.logger.error('Error searching employees:', error);
            throw error;
        }
        return {
            data: data || [],
            total: count || 0,
            limit,
            offset,
        };
    }
    async findAll(options) {
        return this.supabase.findMany(this.TABLE, {
            filters: options?.is_active !== undefined ? { is_active: options.is_active } : undefined,
            orderBy: { column: 'name', ascending: true },
            limit: options?.limit,
            offset: options?.offset,
            useAdmin: true,
        });
    }
    async update(id, dto) {
        this.logger.log(`Updating employee: ${id}`);
        const employee = await this.supabase.update(this.TABLE, { id }, dto, { useAdmin: true });
        if (!employee) {
            throw new common_1.NotFoundException(`Employee not found: ${id}`);
        }
        return employee;
    }
    async upsert(dto, sourcePayload) {
        this.logger.debug(`Upserting employee: ${dto.employeeappnumber}`);
        const data = {
            ...dto,
            source_payload: sourcePayload,
            source_updated_at: new Date().toISOString(),
            synced_at: new Date().toISOString(),
        };
        return this.supabase.upsert(this.TABLE, data, {
            onConflict: 'employeeappnumber',
            useAdmin: true,
        });
    }
    async bulkUpsert(employees) {
        const result = {
            created: 0,
            updated: 0,
            failed: 0,
            errors: [],
        };
        for (const emp of employees) {
            try {
                const existing = await this.findByAppNumber(emp.employeeappnumber);
                await this.upsert(emp, emp.source_payload);
                if (existing) {
                    result.updated++;
                }
                else {
                    result.created++;
                }
            }
            catch (error) {
                result.failed++;
                result.errors.push({
                    employeeappnumber: emp.employeeappnumber,
                    error: error.message,
                });
                this.logger.error(`Failed to upsert employee ${emp.employeeappnumber}:`, error);
            }
        }
        this.logger.log(`Bulk upsert completed: ${result.created} created, ${result.updated} updated, ${result.failed} failed`);
        return result;
    }
    async softDelete(id) {
        return this.update(id, { is_active: false });
    }
    async getStats() {
        const [total, active, onLeave] = await Promise.all([
            this.supabase.count(this.TABLE, {}, { useAdmin: true }),
            this.supabase.count(this.TABLE, { is_active: true }, { useAdmin: true }),
            this.supabase.count(this.TABLE, { is_leave: true }, { useAdmin: true }),
        ]);
        return {
            total,
            active,
            inactive: total - active,
            onLeave,
        };
    }
    async identify(identifiers) {
        if (identifiers.employeeappnumber) {
            const emp = await this.findByAppNumber(identifiers.employeeappnumber);
            if (emp)
                return emp;
        }
        if (identifiers.employeeerpid) {
            const emp = await this.findByErpId(identifiers.employeeerpid);
            if (emp)
                return emp;
        }
        if (identifiers.name) {
            const client = this.supabase.getAdminClient();
            let query = client
                .from(this.TABLE)
                .select('*')
                .eq('name', identifiers.name);
            if (identifiers.store_name) {
                query = query.eq('store_name', identifiers.store_name);
            }
            const { data } = await query.limit(1);
            if (data && data.length > 0) {
                this.logger.warn(`Employee identified by name+store (not recommended): ${identifiers.name}`);
                return data[0];
            }
        }
        return null;
    }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = EmployeesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], EmployeesService);
//# sourceMappingURL=employees.service.js.map