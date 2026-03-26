import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly configService;
    private readonly authService;
    constructor(configService: ConfigService, authService: AuthService);
    validate(payload: JwtPayload): Promise<{
        roles: string[];
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
    }>;
}
export {};
