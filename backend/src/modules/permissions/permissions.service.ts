import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmployeesService } from '../employees/employees.service';

/**
 * 心理輔導系統實際使用的兩種角色
 * （user_role_enum 還有別的值，但本系統只用這兩個）
 */
export type AppRole = 'admin' | 'counselor';
export const APP_ROLES: AppRole[] = ['admin', 'counselor'];
export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: '超級管理者',
  counselor: '輔導人員',
};

/**
 * 權限總覽（對應 DB 的 v_active_permissions view）
 */
export interface PermissionRecord {
  user_role_id: string;
  user_id: string;
  email: string | null;
  user_name: string | null;
  user_is_active: boolean;
  last_login_at: string | null;
  employee_id: string | null;
  app_number: string | null;
  erp_id: string | null;
  employee_name: string | null;
  department: string | null;
  store_name: string | null;
  title: string | null;
  employee_is_active: boolean | null;
  role: AppRole;
  scope_type: string | null;
  scope_value: any;
  granted_by: string | null;
  role_is_active: boolean;
  granted_at: string;
  expires_at: string | null;
}

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly employeesService: EmployeesService,
  ) {}

  /**
   * 列出目前所有授權（含已停用，by `is_active` 參數過濾）
   */
  async list(options?: {
    onlyActive?: boolean;
    role?: AppRole;
  }): Promise<PermissionRecord[]> {
    const client = this.supabase.getAdminClient();
    let query = client.from('v_active_permissions').select('*');

    if (options?.onlyActive) {
      query = query.eq('role_is_active', true);
    }
    if (options?.role) {
      query = query.eq('role', options.role);
    }

    const { data, error } = await query.order('granted_at', { ascending: false });
    if (error) {
      this.logger.error(`Failed to list permissions: ${error.message}`);
      throw new BadRequestException(`查詢失敗：${error.message}`);
    }
    return (data as PermissionRecord[]) || [];
  }

  /**
   * 指派權限（給某 app_number 一個角色）
   *
   * 流程：
   *   1. 用 app_number 找員工
   *   2. 找對應的 user，若無則自動建立（用 dummy email）
   *   3. 建立 / 啟用 user_role 一筆
   */
  async grant(
    params: {
      app_number: string;
      role: AppRole;
      scope_type?: string;
      scope_value?: Record<string, any>;
    },
    grantedBy?: string,
  ): Promise<PermissionRecord> {
    if (!APP_ROLES.includes(params.role)) {
      throw new BadRequestException(`不支援的角色：${params.role}（允許值：${APP_ROLES.join(', ')}）`);
    }

    // 1. 找員工
    const employee = await this.employeesService.findByAppNumber(params.app_number);
    if (!employee) {
      throw new NotFoundException(`找不到員工編號「${params.app_number}」`);
    }

    // 2. 找對應 user，無則建立
    const client = this.supabase.getAdminClient();
    let userId: string;

    const { data: existingUser } = await client
      .from('users')
      .select('id, is_active')
      .eq('employee_id', employee.id)
      .limit(1)
      .maybeSingle();

    if (existingUser) {
      userId = existingUser.id;
      // 確保 user 是 active
      if (!existingUser.is_active) {
        await client.from('users').update({ is_active: true }).eq('id', userId);
      }
    } else {
      // 建新 user（dummy email，等該員工自己用 Google 登入時可以更新）
      const dummyEmail = `${params.app_number}@psych.internal`;
      const { data: newUser, error: userErr } = await client
        .from('users')
        .insert({
          email: dummyEmail,
          name: employee.name,
          employee_id: employee.id,
          is_active: true,
        })
        .select('id')
        .single();
      if (userErr) {
        // 若 email 衝突（極少數情況：app_number 重複），fallback 撈一次
        if (userErr.code === '23505') {
          const { data: retry } = await client
            .from('users')
            .select('id')
            .eq('email', dummyEmail)
            .single();
          if (retry) {
            userId = retry.id;
          } else {
            throw new ConflictException(`建立使用者失敗：${userErr.message}`);
          }
        } else {
          throw new BadRequestException(`建立使用者失敗：${userErr.message}`);
        }
      } else {
        userId = newUser.id;
      }
    }

    // 3. 建 / 啟用 user_role
    const scopeType = params.scope_type ?? 'all';
    const { data: existingRole } = await client
      .from('user_roles')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('role', params.role)
      .eq('scope_type', scopeType)
      .limit(1)
      .maybeSingle();

    let userRoleId: string;
    if (existingRole) {
      // 重新啟用
      const { error } = await client
        .from('user_roles')
        .update({
          is_active: true,
          scope_value: params.scope_value,
          granted_by: grantedBy,
        })
        .eq('id', existingRole.id);
      if (error) throw new BadRequestException(`更新角色失敗：${error.message}`);
      userRoleId = existingRole.id;
    } else {
      const { data: newRole, error } = await client
        .from('user_roles')
        .insert({
          user_id: userId,
          role: params.role,
          scope_type: scopeType,
          scope_value: params.scope_value,
          granted_by: grantedBy,
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw new BadRequestException(`新增角色失敗：${error.message}`);
      userRoleId = newRole.id;
    }

    this.logger.log(
      `Granted role '${params.role}' to ${employee.name} (${params.app_number}) by ${grantedBy || 'system'}`,
    );

    // 4. 回傳完整 view 記錄
    const list = await this.list();
    const rec = list.find((r) => r.user_role_id === userRoleId);
    if (!rec) {
      throw new NotFoundException('指派完成但找不到對應記錄');
    }
    return rec;
  }

  /**
   * 更新權限（改 role / scope / is_active）
   */
  async update(
    userRoleId: string,
    updates: {
      role?: AppRole;
      scope_type?: string;
      scope_value?: Record<string, any>;
      is_active?: boolean;
    },
  ): Promise<PermissionRecord> {
    if (updates.role && !APP_ROLES.includes(updates.role)) {
      throw new BadRequestException(`不支援的角色：${updates.role}`);
    }

    const client = this.supabase.getAdminClient();
    const { error } = await client.from('user_roles').update(updates).eq('id', userRoleId);
    if (error) throw new BadRequestException(`更新失敗：${error.message}`);

    const list = await this.list();
    const rec = list.find((r) => r.user_role_id === userRoleId);
    if (!rec) throw new NotFoundException('找不到該權限記錄');
    return rec;
  }

  /**
   * 撤銷權限（軟刪除：is_active=false）
   */
  async revoke(userRoleId: string): Promise<{ success: true }> {
    const client = this.supabase.getAdminClient();
    const { error } = await client.from('user_roles').update({ is_active: false }).eq('id', userRoleId);
    if (error) throw new BadRequestException(`撤銷失敗：${error.message}`);
    this.logger.log(`Revoked user_role ${userRoleId}`);
    return { success: true };
  }

  /**
   * 列出可用角色（給前端下拉選單）
   */
  getAvailableRoles(): Array<{ value: AppRole; label: string }> {
    return APP_ROLES.map((r) => ({ value: r, label: APP_ROLE_LABELS[r] }));
  }
}
