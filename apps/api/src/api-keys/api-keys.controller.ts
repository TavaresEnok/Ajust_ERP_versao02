import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';

@Controller('api-keys')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class ApiKeysController {
  constructor(private readonly svc: ApiKeysService) {}

  @Get()
  list(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.list(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: { name: string; expiresAt?: string }) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.create(req.auth.tenantId, req.auth.userId, body.name, body.expiresAt);
  }

  @Patch(':id/revoke')
  revoke(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.revoke(req.auth.tenantId, id);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.remove(req.auth.tenantId, id);
  }
}
