import {
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { assertAnyRole } from '../common/role-utils';
import { RequestWithAuth } from '../common/request-with-auth';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

export const ReportInput = z
  .object({
    shift: z.enum(['DAY', 'NIGHT']),
    referenceDate: z.string().date(),
    content: z.string().trim().min(1).max(50000),
    orderIds: z.array(z.string().uuid()).max(100).default([]),
    expectedVersion: z.number().int().positive().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.content.length < 20)
      ctx.addIssue({
        code: 'custom',
        message: 'Descreva o expediente antes de publicar (mínimo 20 caracteres).',
        path: ['content'],
      });
  });
@Controller('shift-reports')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class ShiftReportsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private auth(req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    return req.auth!;
  }
  @Get()
  list(@Req() req: RequestWithAuth, @Query() raw: unknown) {
    const a = this.auth(req);
    const q = z
      .object({
        mine: z.enum(['true', 'false']).optional(),
        shift: z.enum(['DAY', 'NIGHT']).optional(),
        author: z.string().uuid().optional(),
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(raw);
    return this.prisma.shiftReport.findMany({
      where: {
        tenantId: a.tenantId!,
        ...(q.mine === 'true' ? { authorUserId: a.userId } : { publishedAt: { not: null } }),
        ...(q.author ? { authorUserId: q.mine === 'true' ? a.userId : q.author } : {}),
        ...(q.shift ? { shift: q.shift } : {}),
        referenceDate: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) },
      },
      select: {
        id: true,
        authorUserId: true,
        authorName: true,
        shift: true,
        referenceDate: true,
        publishedAt: true,
        version: true,
      },
      orderBy: [{ referenceDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      skip: q.offset,
    });
  }
  @Get('order-search')
  searchOrders(@Req() req: RequestWithAuth, @Query('q') raw: string) {
    const a = this.auth(req);
    // The orders list decorates protocols with '#'; accept the displayed/copied value.
    const q = z
      .string()
      .trim()
      .min(1)
      .max(100)
      .parse(
        z
          .string()
          .max(120)
          .parse(raw)
          .trim()
          .replace(/^#+\s*/, ''),
      );
    return this.prisma.serviceOrder.findMany({
      where: {
        tenantId: a.tenantId!,
        deletedAt: null,
        OR: [
          { id: q },
          { protocol: { contains: q, mode: 'insensitive' } },
          { externalProtocol: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, protocol: true, title: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
    });
  }
  @Get('authors')
  async authors(@Req() req: RequestWithAuth) {
    const a = this.auth(req);
    return this.prisma.shiftReport.findMany({
      where: {
        tenantId: a.tenantId!,
        OR: [{ publishedAt: { not: null } }, { authorUserId: a.userId }],
      },
      distinct: ['authorUserId'],
      select: { authorUserId: true, authorName: true },
      orderBy: { authorName: 'asc' },
    });
  }
  @Get(':id')
  async detail(@Req() req: RequestWithAuth, @Param('id') id: string) {
    const a = this.auth(req);
    const row = await this.prisma.shiftReport.findFirst({
      where: {
        id,
        tenantId: a.tenantId!,
        OR: [{ authorUserId: a.userId }, { publishedAt: { not: null } }],
      },
    });
    if (!row) throw new NotFoundException('Relatório não encontrado.');
    return {
      ...row,
      linkedOrders: await this.prisma.serviceOrder.findMany({
        where: { id: { in: row.orderIds as string[] }, tenantId: a.tenantId!, deletedAt: null },
        select: { id: true, protocol: true, title: true },
      }),
    };
  }
  @Post()
  create(@Req() req: RequestWithAuth, @Body() raw: unknown) {
    return this.save(req, raw);
  }
  @Patch(':id')
  update(@Req() req: RequestWithAuth, @Param('id') id: string, @Body() raw: unknown) {
    return this.save(req, raw, id);
  }
  private async save(req: RequestWithAuth, raw: unknown, id?: string) {
    const a = this.auth(req),
      v = ReportInput.parse(raw);
    return this.prisma.$transaction(async (tx) => {
      const prior = id
        ? await tx.shiftReport.findFirst({
            where: { id, tenantId: a.tenantId!, authorUserId: a.userId },
          })
        : null;
      if (id && !prior) throw new NotFoundException('Somente o autor pode editar este relatório.');
      const ids = [...new Set(v.orderIds)];
      if (
        ids.length !==
        (await tx.serviceOrder.count({
          where: { id: { in: ids }, tenantId: a.tenantId!, deletedAt: null },
        }))
      )
        throw new NotFoundException('O.S. fora da empresa ou indisponível.');
      const author = await tx.user.findUniqueOrThrow({
        where: { id: a.userId },
        select: { name: true },
      });
      const now = new Date();
      const data = {
        shift: v.shift,
        referenceDate: v.referenceDate,
        content: v.content,
        orderIds: ids,
        publishedAt: prior?.publishedAt || now,
      };
      const revisions = prior
        ? [
            ...(prior.revisions as Prisma.JsonArray),
            ...(prior.publishedAt
              ? [
                  JSON.parse(
                    JSON.stringify({
                      version: prior.version,
                      at: prior.updatedAt,
                      content: prior.content,
                      startAt: prior.startAt,
                      endAt: prior.endAt,
                      shift: prior.shift,
                      referenceDate: prior.referenceDate,
                      orderIds: prior.orderIds,
                    }),
                  ),
                ]
              : []),
          ]
        : [];
      if (prior) {
        const result = await tx.shiftReport.updateMany({
          where: {
            id: prior.id,
            tenantId: a.tenantId!,
            authorUserId: a.userId,
            version: v.expectedVersion ?? -1,
          },
          data: { ...data, version: { increment: 1 }, revisions },
        });
        if (!result.count)
          throw new ConflictException(
            'O relatório mudou. Reabra antes de salvar para não perder outra edição.',
          );
      }
      const saved = prior
        ? await tx.shiftReport.findUniqueOrThrow({ where: { id: prior.id } })
        : await tx.shiftReport.create({
            data: {
              ...data,
              tenantId: a.tenantId!,
              authorUserId: a.userId,
              authorName: author.name,
            },
          });
      await tx.auditLog.create({
        data: {
          tenantId: a.tenantId!,
          actorUserId: a.userId,
          action: 'SHIFT_REPORT_SAVE',
          resourceType: 'shift_report',
          resourceId: saved.id,
          metadata: { version: saved.version, published: Boolean(saved.publishedAt) },
        },
      });
      return saved;
    });
  }
}
@Module({ imports: [PrismaModule], controllers: [ShiftReportsController] })
export class ShiftReportsModule {}
