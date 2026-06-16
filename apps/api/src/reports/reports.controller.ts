import { ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Inject,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { TenantRateLimit, TenantRateLimitGuard } from '../common/tenant-rate-limit.guard';
import { assertAnyRole, assertManagerRole } from '../common/role-utils';

@ApiTags('Relatórios')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Permissão insuficiente' })
@Controller('reports')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly svc: ReportsService) {}

  @Get('operational-health')
  @UseGuards(TenantRateLimitGuard)
  @TenantRateLimit(30, 60) // 30 req/min por tenant
  getOperationalHealth(@Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'leitura', 'cliente']);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.getOperationalHealth(req.auth.tenantId);
  }

  @Get('manager-kpi')
  @UseGuards(TenantRateLimitGuard)
  @TenantRateLimit(30, 60) // 30 req/min por tenant
  getManagerKPIs(@Req() req: RequestWithAuth) {
    assertManagerRole(req.auth);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.getManagerKPIs(req.auth.tenantId);
  }

  @Get('service-order-flow')
  @UseGuards(TenantRateLimitGuard)
  @TenantRateLimit(15, 60) // 15 req/min — consulta mais pesada
  getServiceOrderFlow(
    @Req() req: RequestWithAuth,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
    @Query('priority') priority?: string,
    @Query('type') type?: string,
    @Query('provider') provider?: string,
    @Query('analyst') analyst?: string,
    @Query('sector') sector?: string,
    @Query('sla') sla?: string,
  ) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista', 'leitura']);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.getServiceOrderFlow(req.auth.tenantId, {
      periodStart,
      periodEnd,
      priority,
      type,
      provider,
      analyst,
      sector,
      sla,
    });
  }
}
