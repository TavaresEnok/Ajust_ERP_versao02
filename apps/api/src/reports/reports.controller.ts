import { Controller, Get, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';

@Controller('reports')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('operational-health')
  getOperationalHealth(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.getOperationalHealth(req.auth.tenantId);
  }
}
