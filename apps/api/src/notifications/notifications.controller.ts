import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';

@Controller('notifications/config')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.list(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: any) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.create(req.auth.tenantId, body);
  }

  @Patch(':id')
  update(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: any) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.update(req.auth.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.remove(req.auth.tenantId, id);
  }
}
