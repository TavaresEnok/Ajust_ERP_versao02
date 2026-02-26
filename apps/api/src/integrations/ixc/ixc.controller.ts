import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../../auth/auth.guard';
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
      'BGP'
    ])
    .optional(),
  payload: z.record(z.string(), z.unknown()).default({})
});

const ConfigureSchema = z.object({
  tenantId: z.string().uuid().optional(),
  baseUrl: z.string().url(),
  status: z.string().optional(),
  webhookSecret: z.string().min(8).optional(),
  apiToken: z.string().min(8).optional()
});

@Controller('integrations/ixc')
export class IxcController {
  constructor(@Inject(IxcService) private readonly ixcService: IxcService) {}

  @Post('webhook')
  async webhook(
    @Body() body: unknown,
    @Headers('x-ixc-signature') signatureHeader: string | undefined,
    @Req() req: RequestWithAuth
  ) {
    const input = WebhookSchema.parse(body);
    const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(body);
    return this.ixcService.receiveWebhook({ ...input, rawBody, signature: signatureHeader });
  }

  @UseGuards(AuthGuard)
  @Post('configure')
  async configure(
    @Req() req: RequestWithAuth,
    @Body() body: unknown,
    @Query('tenantId') tenantIdParam?: string
  ) {
    assertAnyRole(req.auth, ['super_admin', 'gerente']);
    const input = ConfigureSchema.parse(body);
    const tenantId = tenantIdParam || input.tenantId || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for configure.');
    }
    return this.ixcService.upsertIntegration({
      tenantId,
      baseUrl: input.baseUrl,
      status: input.status,
      webhookSecret: input.webhookSecret,
      apiToken: input.apiToken
    });
  }

  @UseGuards(AuthGuard)
  @Post('reconcile')
  async reconcile(
    @Req() req: RequestWithAuth,
    @Body() body: { tenantId?: string },
    @Query('tenantId') tenantIdParam?: string
  ) {
    assertAnyRole(req.auth, ['super_admin', 'gerente']);
    const tenantId = tenantIdParam || body?.tenantId || req.auth?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId is required for reconcile.');
    }
    return this.ixcService.runManualReconciliation(tenantId);
  }
}
