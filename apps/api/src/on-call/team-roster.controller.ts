import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { RequestWithAuth } from '../common/request-with-auth';
import { assertAnyRole, assertManagerRole } from '../common/role-utils';
import { isRosterDate } from './roster-calendar';
import { TeamRosterService } from './team-roster.service';

const DateSchema = z.string().refine(isRosterDate, 'Informe uma data válida (AAAA-MM-DD).');
const MembersSchema = z.array(z.string().uuid()).max(200);
const VersionSchema = z.number().int().min(0);
const PolicySchema = z
  .object({
    effectiveFrom: DateSchema,
    dayUserIds: MembersSchema,
    nightUserIds: MembersSchema,
    expectedVersion: VersionSchema,
  })
  .strict();
const DaySchema = z
  .object({
    userIds: MembersSchema,
    holidayName: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    expectedVersion: VersionSchema,
  })
  .strict();

@Controller('on-call/roster')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class TeamRosterController {
  constructor(@Inject(TeamRosterService) private readonly service: TeamRosterService) {}

  private tenantId(req: RequestWithAuth): string {
    if (!req.auth?.tenantId) throw new UnauthorizedException('Empresa não identificada.');
    return req.auth.tenantId;
  }

  @Get()
  read(@Req() req: RequestWithAuth, @Query('from') from: string, @Query('to') to: string) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    return this.service.read(
      this.tenantId(req),
      req.auth!.userId,
      DateSchema.parse(from),
      DateSchema.parse(to),
    );
  }

  @Put('policy')
  savePolicy(@Req() req: RequestWithAuth, @Body() body: unknown) {
    assertManagerRole(req.auth);
    return this.service.savePolicy(this.tenantId(req), req.auth!.userId, PolicySchema.parse(body));
  }

  @Put('days/:date')
  saveDay(@Req() req: RequestWithAuth, @Param('date') date: string, @Body() body: unknown) {
    assertManagerRole(req.auth);
    return this.service.saveDay(
      this.tenantId(req),
      req.auth!.userId,
      DateSchema.parse(date),
      DaySchema.parse(body),
    );
  }

  @Delete('days/:date')
  restoreDay(
    @Req() req: RequestWithAuth,
    @Param('date') date: string,
    @Query('version') version: string,
  ) {
    assertManagerRole(req.auth);
    return this.service.restoreDay(
      this.tenantId(req),
      req.auth!.userId,
      DateSchema.parse(date),
      z.coerce.number().int().min(1).parse(version),
    );
  }
}
