import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthService } from '../auth.service';

/**
 * 角色守衛：檢查當前 user 是否擁有 @Roles(...) 指定的任一角色
 *
 * 從 JWT payload 拿 roles 陣列（簽 JWT 時就放進去了），對照 endpoint 的需求。
 * 為避免 JWT 過期前角色變更（例如 admin 撤銷某人權限）依然有效，
 * 這裡會再從 DB 拉一次 user_roles 確認。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 沒有 @Roles 裝飾 → 不檢查角色（只要登入過 JWT 就可以）
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) {
      throw new ForbiddenException('未登入');
    }

    // 從 DB 拉最新 user_roles（不信任 JWT 中的 roles，因為可能已過期）
    const roles = await this.authService.getUserRoles(user.id);
    const userRoleNames = roles.map((r) => r.role);

    const hasRequiredRole = requiredRoles.some((required) => userRoleNames.includes(required as any));
    if (!hasRequiredRole) {
      this.logger.warn(
        `Access denied: user ${user.id} has roles [${userRoleNames.join(',')}], ` +
          `requires one of [${requiredRoles.join(',')}]`,
      );
      throw new ForbiddenException(
        `存取被拒：需要以下角色之一：${requiredRoles.join('、')}`,
      );
    }

    return true;
  }
}
