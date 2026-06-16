import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { RequestWithAuth } from '../common/request-with-auth';
import { AuthGuard } from './auth.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { ForgotPasswordRateLimitGuard } from './forgot-password-rate-limit.guard';
import { TwoFactorRateLimitGuard } from './two-factor-rate-limit.guard';
import { AuthService } from './auth.service';

const LoginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(4),
  bootstrapToken: z.string().min(32).optional(),
  tenantId: z.string().uuid().optional(),
  device: z.string().optional(),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(20),
});

const LogoutSchema = z.object({
  sessionId: z.string().uuid().optional(),
});

const UpdateMeSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine((data) => data.name || data.email || data.newPassword, {
    message: 'No profile field was provided.',
  })
  .refine((data) => !data.newPassword || !!data.currentPassword, {
    message: 'currentPassword is required when changing password.',
    path: ['currentPassword'],
  });

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(8),
});

const Verify2FASchema = z.object({
  temporaryToken: z.string().min(20),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'Autenticar usuário' })
  @ApiResponse({
    status: 200,
    description: 'Login com sucesso. Retorna accessToken e refreshToken.',
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas de login' })
  async login(@Body() body: unknown, @Req() req: RequestWithAuth) {
    const input = LoginSchema.parse(body);
    return this.authService.login({
      ...input,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('refresh')
  @HttpCode(200)
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna perfil do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Dados do usuário e tenant ativo' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async me(@Req() req: RequestWithAuth) {
    return this.authService.me(req.auth!.userId, req.auth!.tenantId);
  }

  @UseGuards(AuthGuard)
  @Get('socket-token')
  issueSocketToken(@Req() req: RequestWithAuth) {
    return this.authService.issueSocketToken(
      req.auth!.userId,
      req.auth!.sessionId,
      req.auth!.tenantId,
      req.auth!.role,
    );
  }

  @UseGuards(AuthGuard)
  @Patch('me')
  async updateMe(@Req() req: RequestWithAuth, @Body() body: unknown) {
    const input = UpdateMeSchema.parse(body);
    return this.authService.updateMe(
      req.auth!.userId,
      req.auth!.tenantId,
      req.auth!.sessionId,
      input,
    );
  }

  @Post('forgot-password')
  @UseGuards(ForgotPasswordRateLimitGuard)
  @ApiOperation({ summary: 'Solicitar recuperação de senha' })
  @ApiResponse({
    status: 200,
    description: 'Email enviado (mesmo que o email não exista, por segurança)',
  })
  @ApiResponse({ status: 429, description: 'Muitas tentativas. Tente novamente em 1 hora.' })
  async forgotPassword(@Body() body: unknown) {
    const input = ForgotPasswordSchema.parse(body);
    return this.authService.forgotPassword(input.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: unknown) {
    const input = ResetPasswordSchema.parse(body);
    return this.authService.resetPassword(input.token, input.newPassword);
  }

  @Post('verify-2fa')
  @UseGuards(TwoFactorRateLimitGuard)
  async verify2FA(@Body() body: unknown, @Req() req: RequestWithAuth) {
    const input = Verify2FASchema.parse(body);
    return this.authService.verify2FA(
      input.temporaryToken,
      input.code,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @UseGuards(AuthGuard)
  @Post('admin/revoke-sessions/:userId')
  @HttpCode(200)
  async adminRevokeSessions(@Param('userId') targetUserId: string, @Req() req: RequestWithAuth) {
    if (req.auth!.role !== 'super_admin') {
      throw new ForbiddenException('Only super_admin can revoke sessions of other users.');
    }
    return this.authService.revokeAllSessionsForUser(targetUserId, req.auth!.userId);
  }
}
