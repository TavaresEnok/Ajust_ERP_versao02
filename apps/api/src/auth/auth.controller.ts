import { Body, Controller, Get, Inject, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { RequestWithAuth } from '../common/request-with-auth';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

const LoginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(4), // Reduzido de 6 para 4 (4 últimos dígitos do CNPJ)
  tenantId: z.string().uuid().optional(),
  device: z.string().optional()
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(20)
});

const LogoutSchema = z.object({
  sessionId: z.string().uuid().optional()
});

const UpdateMeSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).optional()
}).refine((data) => data.name || data.email || data.newPassword, {
  message: 'No profile field was provided.'
}).refine((data) => !data.newPassword || !!data.currentPassword, {
  message: 'currentPassword is required when changing password.',
  path: ['currentPassword']
});

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) { }

  @Post('login')
  async login(@Body() body: unknown, @Req() req: RequestWithAuth) {
    const input = LoginSchema.parse(body);
    return this.authService.login({
      ...input,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  @Post('refresh')
  async refresh(@Body() body: unknown) {
    const input = RefreshSchema.parse(body);
    return this.authService.refresh(input);
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(@Body() body: unknown, @Req() req: RequestWithAuth) {
    const input = LogoutSchema.parse(body);
    return this.authService.logout(req.auth!.userId, input.sessionId);
  }

  @UseGuards(AuthGuard)
  @Post('logout-all')
  async logoutAll(@Req() req: RequestWithAuth) {
    return this.authService.logout(req.auth!.userId);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me(@Req() req: RequestWithAuth) {
    return this.authService.me(req.auth!.userId, req.auth!.tenantId);
  }

  @UseGuards(AuthGuard)
  @Patch('me')
  async updateMe(@Req() req: RequestWithAuth, @Body() body: unknown) {
    const input = UpdateMeSchema.parse(body);
    return this.authService.updateMe(req.auth!.userId, req.auth!.tenantId, input);
  }
}
