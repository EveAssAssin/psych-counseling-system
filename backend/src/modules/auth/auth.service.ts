import { Injectable, Logger, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Google OAuth 登入後處理
   */
  async handleGoogleLogin(profile: {
    id: string;
    email: string;
    displayName: string;
    photos?: { value: string }[];
  }): Promise<{ user: User; accessToken: string }> {
    this.logger.log(`Google login: ${profile.email}`);

    // 查找或建立使用者
    let user = await this.findByGoogleId(profile.id);

    if (!user) {
      user = await this.findByEmail(profile.email);
    }

    if (!user) {
      // 建立新使用者
      user = await this.createUser({
        email: profile.email,
        name: profile.displayName,
        google_id: profile.id,
        avatar_url: profile.photos?.[0]?.value,
      });
      this.logger.log(`New user created: ${user.id}`);
    } else {
      // 更新登入時間
      user = await this.updateUser(user.id, {
        last_login_at: new Date().toISOString(),
        google_id: profile.id,
        avatar_url: profile.photos?.[0]?.value,
      });
    }

    // 取得角色
    const roles = await this.getUserRoles(user.id);

    // 產生 JWT
    const accessToken = this.generateToken(user, roles);

    return { user, accessToken };
  }

  /**
   * App-number-based 登入（用於樂活統一入口跳轉）
   *
   * 流程：
   *   1. 用 app_number 找到 employees 表中的員工
   *   2. 找到對應的 user（透過 user.employee_id）
   *   3. 確認 user.is_active 且至少有一個 active role
   *   4. 簽 JWT 回傳
   *
   * 不會自動建立 user — 必須先由 admin 在權限管理頁面「指派權限」才能登入。
   */
  async loginByAppNumber(appNumber: string): Promise<{ user: User; accessToken: string; roles: UserRole[] }> {
    if (!appNumber || !appNumber.trim()) {
      throw new UnauthorizedException('缺少員工編號');
    }
    const cleanAppNumber = appNumber.trim();
    this.logger.log(`App-number login attempt: ${cleanAppNumber}`);

    // 1. 找員工
    const employee = await this.supabase.findOne<{ id: string; name: string; employeeappnumber: string }>(
      'employees',
      { employeeappnumber: cleanAppNumber },
      { useAdmin: true },
    );
    if (!employee) {
      this.logger.warn(`Login denied: employee not found for app_number ${cleanAppNumber}`);
      throw new NotFoundException(`找不到員工編號「${cleanAppNumber}」，請聯絡系統管理員`);
    }

    // 2. 找對應的 user
    const user = await this.supabase.findOne<User>(
      'users',
      { employee_id: employee.id },
      { useAdmin: true },
    );
    if (!user) {
      this.logger.warn(`Login denied: no user record for employee ${cleanAppNumber}`);
      throw new ForbiddenException(`您（${employee.name}）尚未被授權使用此系統，請聯絡系統管理員開通權限`);
    }
    if (!user.is_active) {
      this.logger.warn(`Login denied: user inactive for employee ${cleanAppNumber}`);
      throw new ForbiddenException(`您的帳號已被停用，請聯絡系統管理員`);
    }

    // 3. 確認至少有一個 active role
    const roles = await this.getUserRoles(user.id);
    if (roles.length === 0) {
      this.logger.warn(`Login denied: no active role for ${cleanAppNumber}`);
      throw new ForbiddenException(`您尚未被指派任何角色，請聯絡系統管理員`);
    }

    // 4. 更新 last_login_at
    const updatedUser = await this.updateUser(user.id, {
      last_login_at: new Date().toISOString(),
    });

    // 5. 簽 JWT
    const accessToken = this.generateToken(updatedUser, roles);
    this.logger.log(
      `Login granted: ${employee.name} (${cleanAppNumber}), roles=[${roles.map((r) => r.role).join(',')}]`,
    );

    return { user: updatedUser, accessToken, roles };
  }

  /**
   * 驗證 JWT Token
   */
  async validateToken(payload: JwtPayload): Promise<User> {
    const user = await this.findById(payload.sub);

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid or inactive user');
    }

    return user;
  }

  /**
   * 產生 JWT Token
   */
  generateToken(user: User, roles: UserRole[]): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      roles: roles.map((r) => r.role),
    };

    return this.jwtService.sign(payload);
  }

  /**
   * 查找使用者（by ID）
   */
  async findById(id: string): Promise<User | null> {
    return this.supabase.findOne<User>('users', { id }, { useAdmin: true });
  }

  /**
   * 查找使用者（by Email）
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.supabase.findOne<User>('users', { email }, { useAdmin: true });
  }

  /**
   * 查找使用者（by Google ID）
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.supabase.findOne<User>('users', { google_id: googleId }, { useAdmin: true });
  }

  /**
   * 建立使用者
   */
  async createUser(data: Partial<User>): Promise<User> {
    return this.supabase.create<User>(
      'users',
      {
        ...data,
        is_active: true,
        last_login_at: new Date().toISOString(),
      },
      { useAdmin: true },
    );
  }

  /**
   * 更新使用者
   */
  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const updated = await this.supabase.update<User>('users', { id }, data, { useAdmin: true });
    return updated!;
  }

  /**
   * 取得使用者角色
   */
  async getUserRoles(userId: string): Promise<UserRole[]> {
    return this.supabase.findMany<UserRole>('user_roles', {
      filters: { user_id: userId, is_active: true },
      useAdmin: true,
    });
  }

  /**
   * 指派角色
   */
  async assignRole(
    userId: string,
    role: UserRole['role'],
    scopeType?: string,
    scopeValue?: Record<string, any>,
    grantedBy?: string,
  ): Promise<UserRole> {
    return this.supabase.create<UserRole>(
      'user_roles',
      {
        user_id: userId,
        role,
        scope_type: scopeType,
        scope_value: scopeValue,
        granted_by: grantedBy,
        is_active: true,
      },
      { useAdmin: true },
    );
  }

  /**
   * 檢查使用者是否有特定角色
   */
  async hasRole(userId: string, role: UserRole['role']): Promise<boolean> {
    const roles = await this.getUserRoles(userId);
    return roles.some((r) => r.role === role);
  }

  /**
   * 檢查使用者是否為管理員
   */
  async isAdmin(userId: string): Promise<boolean> {
    return this.hasRole(userId, 'admin');
  }
}
