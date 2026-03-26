import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth 登入' })
  async googleLogin() {
    // Guard 會自動重導到 Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth 回調' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const { user, accessToken } = await this.authService.handleGoogleLogin(
        req.user as any,
      );

      // 可以選擇重導到前端並帶上 token
      // 或直接返回 JSON
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
    } catch (error) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        message: 'Authentication failed',
        error: error.message,
      });
    }
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '取得當前使用者資訊' })
  @ApiResponse({ status: 200, description: '使用者資訊' })
  async me(@Req() req: Request) {
    const user = req.user as any;
    const roles = await this.authService.getUserRoles(user.id);

    return {
      user,
      roles: roles.map((r) => ({
        role: r.role,
        scope_type: r.scope_type,
        scope_value: r.scope_value,
      })),
    };
  }

  @Post('logout')
  @ApiOperation({ summary: '登出' })
  @ApiResponse({ status: 200, description: '登出成功' })
  async logout() {
    // JWT 是無狀態的，前端只需清除 token
    return { message: 'Logged out successfully' };
  }

  @Get('verify')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '驗證 Token' })
  @ApiResponse({ status: 200, description: 'Token 有效' })
  async verify(@Req() req: Request) {
    return {
      valid: true,
      user: req.user,
    };
  }
}
