import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { CmdbService } from './cmdb.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';

@Controller('cmdb/assets')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class CmdbController {
  constructor(private readonly cmdbService: CmdbService) {}

  @Get()
  list(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.cmdbService.list(req.auth.tenantId);
  }

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: any) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.cmdbService.create(req.auth.tenantId, req.auth.userId, body);
  }

  @Patch(':id')
  update(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() body: any) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.cmdbService.update(req.auth.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithAuth, @Param('id') id: string) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.cmdbService.remove(req.auth.tenantId, id);
  }

  @Post(':id/link-order')
  linkOrder(@Req() req: RequestWithAuth, @Param('id') assetId: string, @Body() body: any) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.cmdbService.linkOrder(req.auth.tenantId, assetId, body.orderId);
  }
}
