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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const supabase_service_1 = require("../supabase/supabase.service");
let AuthService = AuthService_1 = class AuthService {
    constructor(supabase, jwtService) {
        this.supabase = supabase;
        this.jwtService = jwtService;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async handleGoogleLogin(profile) {
        this.logger.log(`Google login: ${profile.email}`);
        let user = await this.findByGoogleId(profile.id);
        if (!user) {
            user = await this.findByEmail(profile.email);
        }
        if (!user) {
            user = await this.createUser({
                email: profile.email,
                name: profile.displayName,
                google_id: profile.id,
                avatar_url: profile.photos?.[0]?.value,
            });
            this.logger.log(`New user created: ${user.id}`);
        }
        else {
            user = await this.updateUser(user.id, {
                last_login_at: new Date().toISOString(),
                google_id: profile.id,
                avatar_url: profile.photos?.[0]?.value,
            });
        }
        const roles = await this.getUserRoles(user.id);
        const accessToken = this.generateToken(user, roles);
        return { user, accessToken };
    }
    async validateToken(payload) {
        const user = await this.findById(payload.sub);
        if (!user || !user.is_active) {
            throw new common_1.UnauthorizedException('Invalid or inactive user');
        }
        return user;
    }
    generateToken(user, roles) {
        const payload = {
            sub: user.id,
            email: user.email,
            name: user.name,
            roles: roles.map((r) => r.role),
        };
        return this.jwtService.sign(payload);
    }
    async findById(id) {
        return this.supabase.findOne('users', { id }, { useAdmin: true });
    }
    async findByEmail(email) {
        return this.supabase.findOne('users', { email }, { useAdmin: true });
    }
    async findByGoogleId(googleId) {
        return this.supabase.findOne('users', { google_id: googleId }, { useAdmin: true });
    }
    async createUser(data) {
        return this.supabase.create('users', {
            ...data,
            is_active: true,
            last_login_at: new Date().toISOString(),
        }, { useAdmin: true });
    }
    async updateUser(id, data) {
        const updated = await this.supabase.update('users', { id }, data, { useAdmin: true });
        return updated;
    }
    async getUserRoles(userId) {
        return this.supabase.findMany('user_roles', {
            filters: { user_id: userId, is_active: true },
            useAdmin: true,
        });
    }
    async assignRole(userId, role, scopeType, scopeValue, grantedBy) {
        return this.supabase.create('user_roles', {
            user_id: userId,
            role,
            scope_type: scopeType,
            scope_value: scopeValue,
            granted_by: grantedBy,
            is_active: true,
        }, { useAdmin: true });
    }
    async hasRole(userId, role) {
        const roles = await this.getUserRoles(userId);
        return roles.some((r) => r.role === role);
    }
    async isAdmin(userId) {
        return this.hasRole(userId, 'admin');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map