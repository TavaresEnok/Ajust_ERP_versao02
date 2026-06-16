import { ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { NotificationChannel, NotificationTrigger } from '@prisma/client';
import { z } from 'zod';
import { NotificationConfigInput, NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertManagerRole } from '../common/role-utils';

const NotificationConfigObjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channel: z.nativeEnum(NotificationChannel),
  trigger: z.nativeEnum(NotificationTrigger),
  target: z.string().trim().min(3).max(2048),
  active: z.boolean().optional(),
});

const NotificationConfigSchema = NotificationConfigObjectSchema.superRefine((data, ctx) => {
  const valid =
    data.channel === NotificationChannel.EMAIL
      ? z.string().email().safeParse(data.target).success
      : z.string().url().safeParse(data.target).success;
  if (!valid)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['target'], message: 'Invalid target.' });
});

const UpdateNotificationConfigSchema = NotificationConfigObjectSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided.' },
);

@ApiTags('Notificações')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Permissão insuficiente' })
@Controller('notifications/config')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly svc: NotificationsService) {}

  @Get()
  list(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.list(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.create(req.auth.tenantId, NotificationConfigSchema.parse(body));
  }

  @Patch(':id')
  update(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.update(
      req.auth.tenantId,
      id,
      UpdateNotificationConfigSchema.parse(body) as NotificationConfigInput,
    );
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.remove(req.auth.tenantId, id);
  }
}
