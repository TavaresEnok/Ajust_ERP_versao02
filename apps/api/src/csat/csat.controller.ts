import { ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { CsatService } from './csat.service';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertAnyRole, assertManagerRole } from '../common/role-utils';
import { z } from 'zod';

const CsatAnswerSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(4000).optional(),
});
const CreateCsatSchema = z.object({ orderId: z.string().uuid() });

@ApiTags('CSAT')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Não autenticado' })
@ApiResponse({ status: 403, description: 'Permissão insuficiente' })
@Controller('csat')
export class CsatController {
  constructor(@Inject(CsatService) private readonly svc: CsatService) {}

  // Public: respond to a survey via its unguessable, one-time token.
  @Get('survey/:token')
  getSurvey(@Param('token') token: string) {
    return this.svc.getByToken(token);
  }

  @Post('survey/:token/answer')
  answer(@Param('token') token: string, @Body() body: unknown) {
    const input = CsatAnswerSchema.parse(body);
    return this.svc.answer(token, input.score, input.comment);
  }

  // Protected: management
  @Get()
  @UseGuards(AuthGuard, TenantIsolationGuard)
  list(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.listByTenant(req.auth.tenantId);
  }

  @Get('summary')
  @UseGuards(AuthGuard, TenantIsolationGuard)
  summary(@Req() req: RequestWithAuth) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertManagerRole(req.auth);
    return this.svc.summary(req.auth.tenantId);
  }

  @Post('create-for-order')
  @UseGuards(AuthGuard, TenantIsolationGuard)
  create(@Req() req: RequestWithAuth, @Body() body: unknown) {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    const input = CreateCsatSchema.parse(body);
    return this.svc.createForOrder(req.auth.tenantId, input.orderId);
  }
}
