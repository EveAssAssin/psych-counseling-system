import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { PermissionsService, AppRole, APP_ROLES } from './permissions.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('permissions')
@Controller('permissions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('roles')
  @ApiOperation({ summary: '列出可用角色（給前端下拉選單）' })
  getAvailableRoles() {
    return this.permissionsService.getAvailableRoles();
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: '列出所有權限記錄（僅 super_admin）' })
  @ApiResponse({ status: 200, description: '權限列表' })
  async list(
    @Query('only_active') onlyActive?: string,
    @Query('role') role?: AppRole,
  ) {
    return this.permissionsService.list({
      onlyActive: onlyActive === 'true',
      role: role && APP_ROLES.includes(role) ? role : undefined,
    });
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: '指派權限（僅 super_admin）' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        app_number: { type: 'string', example: 'A1234' },
        role: { type: 'string', enum: APP_ROLES },
        scope_type: { type: 'string', default: 'all' },
        scope_value: { type: 'object' },
      },
      required: ['app_number', 'role'],
    },
  })
  async grant(
    @Body() body: {
      app_number: string;
      role: AppRole;
      scope_type?: string;
      scope_value?: Record<string, any>;
    },
    @Req() req: Request,
  ) {
    const currentUser = req.user as any;
    return this.permissionsService.grant(body, currentUser?.id);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: '修改權限（僅 super_admin）' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      role?: AppRole;
      scope_type?: string;
      scope_value?: Record<string, any>;
      is_active?: boolean;
    },
  ) {
    return this.permissionsService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '撤銷權限（軟刪除，僅 super_admin）' })
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    await this.permissionsService.revoke(id);
  }
}
