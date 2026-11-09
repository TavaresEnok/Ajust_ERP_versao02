import { Body, Controller, Headers, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { IxcService } from './ixc.service';
const Input = z.object({ tenantId: z.string().uuid(), delta: z.record(z.string(), z.unknown()) });
@Controller('integrations/ixc/internal')
export class IxcInternalController {
  constructor(@Inject(IxcService) private readonly service: IxcService) {}
  @Post('delta')
  apply(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    const expected = process.env.WORKER_API_TOKEN;
    const actual = Buffer.from(authorization || '');
    const token = Buffer.from(`Bearer ${expected || ''}`);
    if (!expected || actual.length !== token.length || !timingSafeEqual(actual, token))
      throw new UnauthorizedException('Token do worker inválido.');
    const input = Input.parse(body);
    return this.service.applyPollingDelta(input.tenantId, input.delta);
  }
}
