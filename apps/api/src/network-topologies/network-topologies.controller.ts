import { obsoleteRevisionIds } from './revision-retention';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { TenantIsolationGuard } from '../auth/tenant-isolation.guard';
import { assertAnyRole } from '../common/role-utils';
import { RequestWithAuth } from '../common/request-with-auth';
import { decryptSecret, encryptSecret } from '../common/secrets.crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_DIAGRAM_BYTES, validateDrawioXml } from './drawio-xml';

export const TopologyInput = z.object({
  title: z.string().trim().min(1).max(200),
  diagramXml: z.string().min(1).max(MAX_DIAGRAM_BYTES),
  expectedVersion: z.number().int().nonnegative(),
  sourceFileName: z.string().trim().max(250).nullable().optional(),
});
const summary = {
  id: true,
  title: true,
  version: true,
  updatedAt: true,
  updatedByName: true,
  sourceFileName: true,
} as const;

@Controller('network-topologies')
@UseGuards(AuthGuard, TenantIsolationGuard)
export class NetworkTopologiesController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private auth(req: RequestWithAuth) {
    assertAnyRole(req.auth, ['super_admin', 'gerente', 'analista']);
    return req.auth!;
  }
  private async customer(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, tradeName: true, legalName: true },
    });
    if (!customer) throw new NotFoundException('Provedor não encontrado.');
    return customer;
  }

  @Get()
  list(@Req() req: RequestWithAuth) {
    const auth = this.auth(req);
    return this.prisma.customer.findMany({
      where: { tenantId: auth.tenantId!, deletedAt: null },
      select: { id: true, tradeName: true, legalName: true, networkTopology: { select: summary } },
      orderBy: [{ tradeName: 'asc' }, { id: 'asc' }],
    });
  }

  @Get(':customerId')
  async get(@Req() req: RequestWithAuth, @Param('customerId', ParseUUIDPipe) customerId: string) {
    const auth = this.auth(req);
    const customer = await this.customer(auth.tenantId!, customerId);
    const topology = await this.prisma.networkTopology.findFirst({
      where: { customerId, tenantId: auth.tenantId! },
      select: { ...summary, xmlEnc: true },
    });
    if (!topology) return { customer, topology: null };
    const { xmlEnc, ...metadata } = topology;
    return { customer, topology: { ...metadata, diagramXml: decryptSecret(xmlEnc) } };
  }

  @Get(':customerId/history')
  async history(
    @Req() req: RequestWithAuth,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    const auth = this.auth(req);
    await this.customer(auth.tenantId!, customerId);
    return this.prisma.networkTopologyRevision.findMany({
      where: { topology: { customerId, tenantId: auth.tenantId! } },
      select: {
        version: true,
        title: true,
        savedByName: true,
        createdAt: true,
        sourceFileName: true,
      },
      orderBy: { version: 'desc' },
      take: 100,
    });
  }

  @Get(':customerId/history/:version')
  async revision(
    @Req() req: RequestWithAuth,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('version') rawVersion: string,
  ) {
    const auth = this.auth(req);
    await this.customer(auth.tenantId!, customerId);
    const version = z.coerce.number().int().positive().parse(rawVersion);
    const row = await this.prisma.networkTopologyRevision.findFirst({
      where: { version, topology: { customerId, tenantId: auth.tenantId! } },
    });
    if (!row) throw new NotFoundException('Versão não encontrada.');
    return {
      version: row.version,
      title: row.title,
      diagramXml: decryptSecret(row.xmlEnc),
      savedByName: row.savedByName,
      createdAt: row.createdAt,
    };
  }

  @Put(':customerId')
  async save(
    @Req() req: RequestWithAuth,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() body: unknown,
  ) {
    const auth = this.auth(req);
    const input = TopologyInput.parse(body);
    await this.customer(auth.tenantId!, customerId);
    validateDrawioXml(input.diagramXml);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { name: true },
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.networkTopology.findFirst({
          where: { customerId, tenantId: auth.tenantId! },
        });
        if ((current?.version || 0) !== input.expectedVersion)
          throw new ConflictException(
            'Outra pessoa salvou uma versão mais recente. Baixe suas alterações e recarregue a topologia antes de continuar.',
          );
        const data = {
          title: input.title,
          xmlEnc: encryptSecret(input.diagramXml),
          updatedByUserId: auth.userId,
          updatedByName: user.name,
          sourceFileName: input.sourceFileName ?? null,
        };
        let id: string;
        const version = input.expectedVersion + 1;
        if (current) {
          const updated = await tx.networkTopology.updateMany({
            where: { id: current.id, tenantId: auth.tenantId!, version: input.expectedVersion },
            data: { ...data, version },
          });
          if (updated.count !== 1)
            throw new ConflictException(
              'Outra pessoa alterou esta topologia. Recarregue antes de salvar.',
            );
          id = current.id;
        } else {
          const created = await tx.networkTopology.create({
            data: { ...data, tenantId: auth.tenantId!, customerId, version },
          });
          id = created.id;
        }
        await tx.networkTopologyRevision.create({
          data: {
            topologyId: id,
            version,
            title: data.title,
            xmlEnc: data.xmlEnc,
            sourceFileName: data.sourceFileName,
            savedByUserId: auth.userId,
            savedByName: user.name,
          },
        });
        const history = await tx.networkTopologyRevision.findMany({
          where: { topologyId: id },
          select: { id: true, createdAt: true, version: true },
        });
        const obsolete = obsoleteRevisionIds(history);
        if (obsolete.length)
          await tx.networkTopologyRevision.deleteMany({
            where: { topologyId: id, id: { in: obsolete } },
          });
        return tx.networkTopology.findUniqueOrThrow({ where: { id }, select: summary });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException(
          'Outra pessoa acabou de salvar esta topologia. Recarregue antes de continuar.',
        );
      throw error;
    }
  }
}
