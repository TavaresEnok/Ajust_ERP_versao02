import { Injectable, Inject } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AuditService — serviço centralizado de trilha de auditoria.
 *
 * Antes, `logAudit` estava duplicado em auth.service.ts e
 * service-orders.service.ts. Centralizar aqui garante consistência
 * no formato dos logs e facilita extensão futura (ex: exportar para
 * sistema externo de SIEM, adicionar campos, etc).
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async log(
    tenantId: string | null,
    actorUserId: string | null,
    action: AuditAction,
    resourceType: string,
    resourceId: string | null,
    metadata: Record<string, unknown>,
    extra?: { ip?: string; userAgent?: string },
  ): Promise<void> {
    if (
      action === 'OS_UPDATE' &&
      !['service_order', 'service_orders', 'occurrence'].includes(resourceType)
    ) {
      const operation = String(metadata.op || 'update');
      action = ['remove', 'delete'].includes(operation)
        ? 'RESOURCE_DELETE'
        : operation === 'create'
          ? 'RESOURCE_CREATE'
          : 'RESOURCE_UPDATE';
      if (resourceType === 'user' && operation === 'remove') action = 'DELETE_USER';
    }
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        resourceType,
        resourceId,
        metadata: metadata as any,
        ip: extra?.ip,
        userAgent: extra?.userAgent,
      },
    });
  }
}
