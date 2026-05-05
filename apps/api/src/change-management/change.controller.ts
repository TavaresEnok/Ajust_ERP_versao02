import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ChangeService } from './change.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';

@Controller('change-management')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class ChangeController {
  constructor(private readonly changeService: ChangeService) {}

  @Get()
  list(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.changeService.list(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: any) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.changeService.create(req.auth.tenantId, req.auth.userId, body);
  }

  @Patch(':id/transition')
  transition(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: { toStatus: string }) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.changeService.transition(req.auth.tenantId, id, req.auth.userId, body.toStatus);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.changeService.remove(req.auth.tenantId, id);
  }
}
