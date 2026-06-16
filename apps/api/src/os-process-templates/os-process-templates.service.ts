import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Priority, ServiceOrderStatus, ServiceOrderType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

export interface ChildOrderSpec {
  id: string;
  title: string;
  type: ServiceOrderType;
  priority: Priority;
  sector?: string;
  origin?: string;
  description?: string;
  deadlineHours?: number;
  tags?: string[];
}

export interface OsProcessTemplateDefinition {
  childOrders: ChildOrderSpec[];
}

const VALID_OS_TYPES = new Set<string>(Object.values(ServiceOrderType));
const VALID_PRIORITIES = new Set<string>(Object.values(Priority));

@Injectable()
export class OsProcessTemplateService {
  private readonly logger = new Logger(OsProcessTemplateService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.osProcessTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const template = await this.prisma.osProcessTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!template) throw new NotFoundException('Template de OS não encontrado.');
    return template;
  }

  async create(
    tenantId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      enabled?: boolean;
      triggerOsTypes: string[];
      definition: OsProcessTemplateDefinition;
    },
  ) {
    this.validate(data.name, data.triggerOsTypes, data.definition);

    const created = await this.prisma.osProcessTemplate.create({
      data: {
        tenantId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        enabled: data.enabled ?? true,
        triggerOsTypes: data.triggerOsTypes,
        definition: data.definition as any,
      },
    });

    await this.audit.log(tenantId, userId, 'OS_CREATE', 'os_process_template', created.id, {
      op: 'create',
      name: created.name,
    });

    return created;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      enabled?: boolean;
      triggerOsTypes?: string[];
      definition?: OsProcessTemplateDefinition;
    },
  ) {
    await this.findOne(tenantId, id);

    if (
      data.name !== undefined ||
      data.triggerOsTypes !== undefined ||
      data.definition !== undefined
    ) {
      this.validate(
        data.name || '',
        data.triggerOsTypes || ['AUDITORIA'],
        data.definition || {
          childOrders: [{ id: 'x', title: 'x', type: 'AUDITORIA', priority: 'NORMAL' }],
        },
        { nameRequired: data.name !== undefined },
      );
    }

    const updated = await this.prisma.osProcessTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description.trim() || null }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.triggerOsTypes !== undefined && { triggerOsTypes: data.triggerOsTypes }),
        ...(data.definition !== undefined && { definition: data.definition as any }),
      },
    });

    await this.audit.log(tenantId, userId, 'OS_UPDATE', 'os_process_template', id, {
      op: 'update',
    });

    return updated;
  }

  async remove(tenantId: string, userId: string, id: string) {
    await this.findOne(tenantId, id);
    const deleted = await this.prisma.osProcessTemplate.delete({ where: { id } });

    await this.audit.log(tenantId, userId, 'OS_UPDATE', 'os_process_template', id, {
      op: 'delete',
      name: deleted.name,
    });

    return deleted;
  }

  async toggle(tenantId: string, userId: string, id: string) {
    const template = await this.findOne(tenantId, id);
    const toggled = await this.prisma.osProcessTemplate.update({
      where: { id },
      data: { enabled: !template.enabled },
    });

    await this.audit.log(tenantId, userId, 'OS_UPDATE', 'os_process_template', id, {
      op: 'toggle',
      enabled: toggled.enabled,
    });

    return toggled;
  }

  async executeForOrder(
    tenantId: string,
    order: {
      id: string;
      protocol: string;
      type: ServiceOrderType;
      occurrenceId?: string | null;
      sector?: string | null;
      origin?: string | null;
    },
    actorUserId: string,
  ): Promise<void> {
    const templates = await this.prisma.osProcessTemplate.findMany({
      where: { tenantId, enabled: true },
    });

    const matching = templates.filter((t) => {
      const types = t.triggerOsTypes as string[];
      return Array.isArray(types) && types.includes(order.type);
    });

    if (matching.length === 0) return;

    for (const template of matching) {
      const def = template.definition as unknown as OsProcessTemplateDefinition;
      if (!Array.isArray(def.childOrders) || def.childOrders.length === 0) continue;

      const createdProtocols: string[] = [];

      for (const spec of def.childOrders) {
        try {
          const deadlineAt = new Date(Date.now() + (spec.deadlineHours ?? 24) * 60 * 60 * 1000);

          const protocol = `WF-${randomUUID().slice(0, 12)}`;
          const child = await this.prisma.serviceOrder.create({
            data: {
              tenantId,
              protocol,
              occurrenceId: order.occurrenceId ?? undefined,
              sourceSystem: 'ERP',
              type: spec.type,
              priority: spec.priority,
              status: ServiceOrderStatus.ABERTA,
              title: spec.title,
              description:
                spec.description || `OS criada automaticamente pelo template "${template.name}".`,
              sector: spec.sector || order.sector || undefined,
              origin: 'TEMPLATE',
              deadlineAt,
              tags: [`template:${template.id}`, ...(spec.tags || [])],
              internalNotes: `Template: ${template.name} (${template.id}) · OS origem: ${order.protocol}`,
              occurrences: {
                create: {
                  sourceSystem: 'ERP',
                  message: `OS criada automaticamente pelo template "${template.name}". OS origem: ${order.protocol}.`,
                },
              },
            },
            select: { id: true, protocol: true },
          });

          createdProtocols.push(child.protocol);
        } catch (err) {
          this.logger.warn(
            `Template ${template.id}: falha ao criar OS filha "${spec.title}" — ${(err as Error).message}`,
          );
        }
      }

      if (createdProtocols.length > 0) {
        await this.prisma.serviceOrderOccurrence
          .create({
            data: {
              serviceOrderId: order.id,
              actorUserId,
              sourceSystem: 'ERP',
              message: `Template "${template.name}" criou ${createdProtocols.length} OS filha(s): ${createdProtocols.join(', ')}.`,
            },
          })
          .catch((error) => {
            this.logger.warn(
              `Template ${template.id}: falha ao registrar ocorrência de OS filhas — ${(error as Error).message}`,
            );
          });
      }
    }
  }

  private validate(
    name: string,
    triggerOsTypes: string[],
    definition: OsProcessTemplateDefinition,
    opts: { nameRequired?: boolean } = { nameRequired: true },
  ): void {
    if ((opts.nameRequired ?? true) && (!name || !name.trim())) {
      throw new BadRequestException('O nome do template é obrigatório.');
    }

    if (!Array.isArray(triggerOsTypes) || triggerOsTypes.length === 0) {
      throw new BadRequestException('Selecione ao menos um tipo de OS para o template.');
    }

    for (const t of triggerOsTypes) {
      if (!VALID_OS_TYPES.has(t)) {
        throw new BadRequestException(`Tipo de OS inválido: ${t}`);
      }
    }

    const orders = definition?.childOrders;
    if (!Array.isArray(orders) || orders.length === 0) {
      throw new BadRequestException('O template deve ter ao menos uma OS filha.');
    }

    for (const spec of orders) {
      if (!spec.title?.trim()) {
        throw new BadRequestException('Cada OS filha deve ter um título.');
      }
      if (!VALID_OS_TYPES.has(spec.type)) {
        throw new BadRequestException(`Tipo de OS inválido na OS filha: ${spec.type}`);
      }
      if (!VALID_PRIORITIES.has(spec.priority)) {
        throw new BadRequestException(`Prioridade inválida na OS filha: ${spec.priority}`);
      }
    }
  }
}
