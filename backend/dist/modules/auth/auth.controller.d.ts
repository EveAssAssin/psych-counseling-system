import { Request, Response } from 'express';
import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    googleLogin(): Promise<void>;
    googleCallback(req: Request, res: Response): Promise<void>;
    me(req: Request): Promise<{
        user: any;
        roles: {
            role: "admin" | "hr_manager" | "supervisor" | "counselor" | "reviewer" | "agent";
            scope_type: string | undefined;
            scope_value: Record<string, any> | undefined;
        }[];
    }>;
    logout(): Promise<{
        message: string;
    }>;
    verify(req: Request): Promise<{
        valid: boolean;
        user: Express.User | undefined;
    }>;
}
