import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { OnCallService } from './on-call.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';

@Controller('on-call')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class OnCallController {
  constructor(private readonly svc: OnCallService) {}

  @Get()
  list(@Req() req: RequestWithAuth, @Query('from') from?: string, @Query('to') to?: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.list(req.auth.tenantId, from, to);
  }

  @Get('current')
  current(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.currentOnCall(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: any) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.create(req.auth.tenantId, body);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.remove(req.auth.tenantId, id);
  }
}
