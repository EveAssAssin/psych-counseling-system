import { SetMetadata } from '@nestjs/common';

/**
 * @Roles('admin', 'counselor') 標註一個 endpoint 必須擁有指定的任一角色
 * 配合 RolesGuard 使用
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
