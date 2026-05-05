import { Controller, Get, Post, Body, Param, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { CsatService } from './csat.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';

@Controller('csat')
export class CsatController {
  constructor(private readonly svc: CsatService) {}

  // Public: respond to a survey via token link (two route patterns for compatibility)
  @Get('survey/:token')
  getSurvey(@Param('token') token: string) {
    return this.svc.getByToken(token);
  }

  @Get(':token')
  getSurveyDirect(@Param('token') token: string) {
    return this.svc.getByToken(token);
  }

  @Post('survey/:token/answer')
  answer(@Param('token') token: string, @Body() body: { score: number; comment?: string }) {
    return this.svc.answer(token, body.score, body.comment);
  }

  @Post(':token/answer')
  answerDirect(@Param('token') token: string, @Body() body: { score: number; comment?: string }) {
    return this.svc.answer(token, body.score, body.comment);
  }

  // Protected: management
  @Get()
  @UseGuards(AuthGuard, TenantIsolationGuard)
  list(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.listByTenant(req.auth.tenantId);
  }

  @Get('summary')
  @UseGuards(AuthGuard, TenantIsolationGuard)
  summary(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.summary(req.auth.tenantId);
  }

  @Post('create-for-order')
  @UseGuards(AuthGuard, TenantIsolationGuard)
  create(@Req() req: RequestWithAuth, @Body() body: { orderId: string }) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.svc.createForOrder(req.auth.tenantId, body.orderId);
  }
}
