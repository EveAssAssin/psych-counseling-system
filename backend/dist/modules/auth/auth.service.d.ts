import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
export interface User {
    id: string;
    email: string;
    name?: string;
    avatar_url?: string;
    google_id?: string;
    employee_id?: string;
    is_active: boolean;
    last_login_at?: string;
    created_at: string;
    updated_at: string;
}
export interface UserRole {
    id: string;
    user_id: string;
    role: 'admin' | 'hr_manager' | 'supervisor' | 'counselor' | 'reviewer' | 'agent';
    scope_type?: string;
    scope_value?: Record<string, any>;
    granted_by?: string;
    is_active: boolean;
}
export interface JwtPayload {
    sub: string;
    email: string;
    name?: string;
    roles: string[];
}
export declare class AuthService {
    private readonly supabase;
    private readonly jwtService;
    private readonly logger;
    constructor(supabase: SupabaseService, jwtService: JwtService);
    handleGoogleLogin(profile: {
        id: string;
        email: string;
        displayName: string;
        photos?: {
            value: string;
        }[];
    }): Promise<{
        user: User;
        accessToken: string;
    }>;
    validateToken(payload: JwtPayload): Promise<User>;
    generateToken(user: User, roles: UserRole[]): string;
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findByGoogleId(googleId: string): Promise<User | null>;
    createUser(data: Partial<User>): Promise<User>;
    updateUser(id: string, data: Partial<User>): Promise<User>;
    getUserRoles(userId: string): Promise<UserRole[]>;
    assignRole(userId: string, role: UserRole['role'], scopeType?: string, scopeValue?: Record<string, any>, grantedBy?: string): Promise<UserRole>;
    hasRole(userId: string, role: UserRole['role']): Promise<boolean>;
    isAdmin(userId: string): Promise<boolean>;
}
