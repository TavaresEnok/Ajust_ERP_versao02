import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantIsolationGuard } from '../../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../../common/request-with-auth';
import { assertAnyRole } from '../../common/role-utils';
import { IxcService } from './ixc.service';

const WebhookSchema = z.object({
  tenantId: z.string().uuid(),
  eventType: z.string().min(2),
  externalProtocol: z.string().min(1).optional(),
  status: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'CRITICA']).optional(),
  type: z
    .enum([
      'ROMPIMENTO',
      'LENTIDAO',
      'CONFIGURACAO_ONU',
      'TROCA_SENHA',
      'CANCELAMENTO',
      'AUDITORIA',
      'INSTALACAO',
      'BGP',
    ])
    .optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const ConfigureSchema = z.object({
  tenantId: z.string().uuid().optional(),
  baseUrl: z.string().url(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  webhookSecret: z.string().min(8).optional(),
  apiToken: z.string().min(8).optional(),
});

@ApiTags('Integrações')
@Controller('integrations/ixc')
export class IxcController {
  constructor(@Inject(IxcService) private readonly ixcService: IxcService) {}

  @Post('webhook')
  async webhook(
    @Body() body: unknown,
    @Headers('x-ixc-signature') signatureHeader: string | undefined,
    @Req() req: RequestWithAuth,
  ) {
    const input = WebhookSchema.parse(body);
    const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(body);
    return this.ixcService.receiveWebhook({ ...input, rawBody, signature: signatureHeader });
  }

  @UseGuards(AuthGuard, TenantIsolationGuard)
  @Post('configure')
  async configure(@Req() req: RequestWithAuth, @Body() body: unknown) {
    assertAnyRole(req.auth, ['super_admin', 'gerente']);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    const input = ConfigureSchema.parse(body);
    return this.ixcService.upsertIntegration({
      tenantId: req.auth.tenantId,
      baseUrl: input.baseUrl,
      status: input.status,
      webhookSecret: input.webhookSecret,
      apiToken: input.apiToken,
    });
  }

  @UseGuards(AuthGuard, TenantIsolationGuard)
  @Post('reconcile')
  async reconcile(@Req() req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente']);
    if (!req.auth?.tenantId) throw new UnauthorizedException('Missing tenantId');
    return this.ixcService.runManualReconciliation(req.auth.tenantId);
  }
}
