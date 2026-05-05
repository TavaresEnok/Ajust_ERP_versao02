import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { TimeTrackingService } from './time-tracking.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';

@Controller('time-entries')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class TimeTrackingController {
  constructor(private readonly svc: TimeTrackingService) {}

  @Get()
  list(@Req() req: RequestWithAuth, @Query('orderId') oq?: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    if (oq) return this.svc.listByOrder(req.auth.tenantId, oq);
    return this.svc.listByTenant(req.auth.tenantId, from, to);
  }

  @Get('summary')
  summary(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.summary(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: any) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.create(req.auth.tenantId, req.auth.userId, body);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.remove(req.auth.tenantId, id);
  }
}
