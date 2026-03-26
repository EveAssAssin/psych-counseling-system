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
var SupabaseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_js_1 = require("@supabase/supabase-js");
let SupabaseService = SupabaseService_1 = class SupabaseService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(SupabaseService_1.name);
    }
    async onModuleInit() {
        const url = this.configService.get('supabase.url');
        const anonKey = this.configService.get('supabase.anonKey');
        const serviceRoleKey = this.configService.get('supabase.serviceRoleKey');
        if (!url || !anonKey) {
            throw new Error('Supabase URL and anon key are required');
        }
        this.supabase = (0, supabase_js_1.createClient)(url, anonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: false,
            },
        });
        if (serviceRoleKey) {
            this.supabaseAdmin = (0, supabase_js_1.createClient)(url, serviceRoleKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            });
            this.logger.log('Supabase admin client initialized');
        }
        else {
            this.logger.warn('Supabase service role key not provided, using anon key for admin operations');
            this.supabaseAdmin = this.supabase;
        }
        this.logger.log('Supabase client initialized');
    }
    getClient() {
        return this.supabase;
    }
    getAdminClient() {
        return this.supabaseAdmin;
    }
    async findOne(table, filters, options) {
        const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;
        const select = options?.select || '*';
        let query = client.from(table).select(select);
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
        const { data, error } = await query.single();
        if (error && error.code !== 'PGRST116') {
            this.logger.error(`Error finding ${table}:`, error);
            throw error;
        }
        return data;
    }
    async findMany(table, options) {
        const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;
        const select = options?.select || '*';
        let query = client.from(table).select(select);
        if (options?.filters) {
            Object.entries(options.filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    query = query.eq(key, value);
                }
            });
        }
        if (options?.orderBy) {
            query = query.order(options.orderBy.column, {
                ascending: options.orderBy.ascending ?? true,
            });
        }
        if (options?.limit) {
            query = query.limit(options.limit);
        }
        if (options?.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        }
        const { data, error } = await query;
        if (error) {
            this.logger.error(`Error finding many ${table}:`, error);
            throw error;
        }
        return (data || []);
    }
    async create(table, data, options) {
        const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;
        const { data: created, error } = await client
            .from(table)
            .insert(data)
            .select(options?.returning || '*')
            .single();
        if (error) {
            this.logger.error(`Error creating ${table}:`, error);
            throw error;
        }
        return created;
    }
    async createMany(table, records, options) {
        const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;
        let query;
        if (options?.onConflict) {
            query = client.from(table).upsert(records, { onConflict: options.onConflict });
        }
        else {
            query = client.from(table).insert(records);
        }
        const { data, error } = await query.select();
        if (error) {
            this.logger.error(`Error creating many ${table}:`, error);
            throw error;
        }
        return (data || []);
    }
    async update(table, filters, data, options) {
        const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;
        let query = client.from(table).update(data);
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
        const { data: updated, error } = await query.select().single();
        if (error) {
            this.logger.error(`Error updating ${table}:`, error);
            throw error;
        }
        return updated;
    }
    async upsert(table, data, options) {
        const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;
        const { data: upserted, error } = await client
            .from(table)
            .upsert(data, { onConflict: options?.onConflict })
            .select()
            .single();
        if (error) {
            this.logger.error(`Error upserting ${table}:`, error);
            throw error;
        }
        return upserted;
    }
    async delete(table, filters, options) {
        const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;
        let query = client.from(table).delete();
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
        const { error } = await query;
        if (error) {
            this.logger.error(`Error deleting ${table}:`, error);
            throw error;
        }
    }
    async count(table, filters, options) {
        const client = options?.useAdmin ? this.supabaseAdmin : this.supabase;
        let query = client.from(table).select('*', { count: 'exact', head: true });
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    query = query.eq(key, value);
                }
            });
        }
        const { count, error } = await query;
        if (error) {
            this.logger.error(`Error counting ${table}:`, error);
            throw error;
        }
        return count || 0;
    }
    async uploadFile(bucket, path, file, options) {
        const { data, error } = await this.supabaseAdmin.storage
            .from(bucket)
            .upload(path, file, {
            contentType: options?.contentType,
            upsert: options?.upsert ?? false,
        });
        if (error) {
            this.logger.error(`Error uploading file to ${bucket}/${path}:`, error);
            throw error;
        }
        return data.path;
    }
    getPublicUrl(bucket, path) {
        const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    }
    async getSignedUrl(bucket, path, expiresIn = 3600) {
        const { data, error } = await this.supabase.storage
            .from(bucket)
            .createSignedUrl(path, expiresIn);
        if (error) {
            this.logger.error(`Error getting signed URL:`, error);
            throw error;
        }
        return data.signedUrl;
    }
    async deleteFile(bucket, paths) {
        const { error } = await this.supabaseAdmin.storage.from(bucket).remove(paths);
        if (error) {
            this.logger.error(`Error deleting files:`, error);
            throw error;
        }
    }
};
exports.SupabaseService = SupabaseService;
exports.SupabaseService = SupabaseService = SupabaseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SupabaseService);
//# sourceMappingURL=supabase.service.js.map