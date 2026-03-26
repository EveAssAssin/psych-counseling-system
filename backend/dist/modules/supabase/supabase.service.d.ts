import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
export declare class SupabaseService implements OnModuleInit {
    private configService;
    private readonly logger;
    private supabase;
    private supabaseAdmin;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    getClient(): SupabaseClient;
    getAdminClient(): SupabaseClient;
    findOne<T>(table: string, filters: Record<string, any>, options?: {
        select?: string;
        useAdmin?: boolean;
    }): Promise<T | null>;
    findMany<T>(table: string, options?: {
        filters?: Record<string, any>;
        select?: string;
        orderBy?: {
            column: string;
            ascending?: boolean;
        };
        limit?: number;
        offset?: number;
        useAdmin?: boolean;
    }): Promise<T[]>;
    create<T>(table: string, data: Partial<T>, options?: {
        useAdmin?: boolean;
        returning?: string;
    }): Promise<T>;
    createMany<T>(table: string, records: Partial<T>[], options?: {
        useAdmin?: boolean;
        onConflict?: string;
    }): Promise<T[]>;
    update<T>(table: string, filters: Record<string, any>, data: Partial<T>, options?: {
        useAdmin?: boolean;
    }): Promise<T | null>;
    upsert<T>(table: string, data: Partial<T>, options?: {
        onConflict: string;
        useAdmin?: boolean;
    }): Promise<T>;
    delete(table: string, filters: Record<string, any>, options?: {
        useAdmin?: boolean;
    }): Promise<void>;
    count(table: string, filters?: Record<string, any>, options?: {
        useAdmin?: boolean;
    }): Promise<number>;
    uploadFile(bucket: string, path: string, file: Buffer, options?: {
        contentType?: string;
        upsert?: boolean;
    }): Promise<string>;
    getPublicUrl(bucket: string, path: string): string;
    getSignedUrl(bucket: string, path: string, expiresIn?: number): Promise<string>;
    deleteFile(bucket: string, paths: string[]): Promise<void>;
}
