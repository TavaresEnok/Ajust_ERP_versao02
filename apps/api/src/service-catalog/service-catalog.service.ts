import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Priority, Prisma, ServiceCatalogItem, ServiceOrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ServiceCatalogWriteInput = {
  name: string;
  category?: ServiceOrderType;
  description?: string;
  estimatedMinutes?: number;
  defaultPriority?: Priority;
  checklist?: string[] | any;
  active?: boolean;
};

const DEFAULT_ISP_CATALOG = [
  {
    name: 'Servidor DNS Recursivo (Unbound / Bind)',
    category: ServiceOrderType.DNS,
    description: 'Instalação, tunning de cache DNS, DoT/DoH e regras de redirecionamento para clientes do ISP.',
    estimatedMinutes: 180,
    defaultPriority: Priority.ALTA,
    checklist: [
      'Validação de recursos e portas 53 UDP/TCP',
      'Configuração de Root Hints e Forwarders',
      'Configuração de limites de cache e access-control',
      'Testes de resolução e latência com dig/nslookup',
    ],
  },
  {
    name: 'Cluster Proxmox VE (HA, ZFS e Backups PBS)',
    category: ServiceOrderType.PROXMOX,
    description: 'Instalação ou reestruturação de nós Proxmox VE, storage local ZFS, interfaces bond e backup integrado.',
    estimatedMinutes: 240,
    defaultPriority: Priority.ALTA,
    checklist: [
      'Checagem de hardware, CPU flags e interfaces de rede',
      'Configuração de storage pool (ZFS RAID10 ou NFS)',
      'Criação de bridges e VLANs de gerência',
      'Agendamento de rotinas de backup no Proxmox Backup Server',
    ],
  },
  {
    name: 'Sessão BGP e Anúncio de Bloco ASN (PTT / IX.br e Trânsito)',
    category: ServiceOrderType.BGP,
    description: 'Ativação de novas sessões BGP IPv4/IPv6, filtros RPKI, comunidades e otimização de tráfego.',
    estimatedMinutes: 120,
    defaultPriority: Priority.CRITICA,
    checklist: [
      'Validação de IRR, whois e certificados RPKI/ROA',
      'Configuração de BGP Peerings (PTT / Trânsitos)',
      'Aplicação de route-filters, prefix-lists e no-export',
      'Verificação de propagação global via Looking Glasses',
    ],
  },
  {
    name: 'Firewall de Borda e Proteção MikroTik / pfSense',
    category: ServiceOrderType.FIREWALL,
    description: 'Fechamento de portas críticas, proteção contra brute force (SSH, Winbox), FastTrack e QoS.',
    estimatedMinutes: 120,
    defaultPriority: Priority.ALTA,
    checklist: [
      'Bloqueio de serviços desnecessários na interface WAN',
      'Configuração de Raw / Filter Rules contra flood e scan',
      'Isolamento da rede de gerência e VPN WireGuard/IPsec',
      'Testes de throughput e uso de CPU em carga',
    ],
  },
  {
    name: 'Implantação e Otimização CGNAT (Port-Block Allocation)',
    category: ServiceOrderType.ROTEAMENTO_CGNAT,
    description: 'Configuração de bloco 100.64.0.0/10 com distribuição balanceada de portas públicas e logging de conexões.',
    estimatedMinutes: 150,
    defaultPriority: Priority.ALTA,
    checklist: [
      'Cálculo de blocos e razão de portas (ex: 1:32 ou 1:16)',
      'Criação de regras de Jump e PBA',
      'Ativação de exportação NetFlow/Syslog para guarda de logs',
      'Validação de testes de conectividade em clientes reais',
    ],
  },
  {
    name: 'Auditoria e Diagnóstico Geral de Rede de Provedor',
    category: ServiceOrderType.AUDITORIA,
    description: 'Mapeamento completo da infraestrutura de rede, topologia, roteamento e segurança com relatório técnico.',
    estimatedMinutes: 300,
    defaultPriority: Priority.NORMAL,
    checklist: [
      'Levantamento de equipamentos ativos e versões de firmware',
      'Análise de gargalos de enlace e saturação de portas',
      'Verificação de conformidade com boas práticas do NIC.br',
      'Entrega de relatório gerencial e plano de ação',
    ],
  },
  {
    name: 'Infraestrutura de Datacenter e Enlaces de Borda',
    category: ServiceOrderType.INFRAESTRUTURA,
    description: 'Substituição de switches de agregação, nobreaks, caixas de fusão e cabos ópticos de distribuição.',
    estimatedMinutes: 180,
    defaultPriority: Priority.NORMAL,
    checklist: [
      'Planejamento de janela de manutenção programada',
      'Backup preventivo de todas as configurações de equipamentos',
      'Troca física e validação de níveis de potência óptica (dBm)',
      'Validação de redundância elétrica e testes de link',
    ],
  },
  {
    name: 'Consultoria Especializada e Projetos Especiais',
    category: ServiceOrderType.CONSULTORIA_GERAL,
    description: 'Apoio técnico para expansão de novos bairros, novos POPs e arquitetura de rede.',
    estimatedMinutes: 240,
    defaultPriority: Priority.NORMAL,
    checklist: [
      'Reunião de alinhamento com a diretoria do provedor',
      'Elaboração de diagrama de rede e cronograma de implantação',
      'Acompanhamento e suporte à equipe local de campo',
    ],
  },
];

@Injectable()
export class ServiceCatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    filter?: { category?: ServiceOrderType; activeOnly?: boolean },
  ): Promise<ServiceCatalogItem[]> {
    let items = await this.prisma.serviceCatalogItem.findMany({
      where: {
        tenantId,
        ...(filter?.category ? { category: filter.category } : {}),
        ...(filter?.activeOnly !== undefined ? { active: filter.activeOnly } : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Se o tenant ainda não tiver itens no catálogo, faz seed automático com os serviços padrão de ISP
    if (items.length === 0 && (!filter || Object.keys(filter).length === 0)) {
      await this.seedDefaults(tenantId);
      items = await this.prisma.serviceCatalogItem.findMany({
        where: { tenantId },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
    }

    return items;
  }

  async getById(tenantId: string, id: string): Promise<ServiceCatalogItem> {
    const item = await this.prisma.serviceCatalogItem.findFirst({
      where: { id, tenantId },
    });
    if (!item) throw new NotFoundException('Item de catálogo não encontrado');
    return item;
  }

  async create(tenantId: string, input: ServiceCatalogWriteInput): Promise<ServiceCatalogItem> {
    return this.prisma.serviceCatalogItem.create({
      data: {
        tenantId,
        name: input.name,
        category: input.category ?? ServiceOrderType.CONSULTORIA_GERAL,
        description: input.description,
        estimatedMinutes: input.estimatedMinutes ?? 120,
        defaultPriority: input.defaultPriority ?? Priority.NORMAL,
        checklist: Array.isArray(input.checklist) ? input.checklist : [],
        active: input.active ?? true,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    input: Partial<ServiceCatalogWriteInput>,
  ): Promise<ServiceCatalogItem> {
    const item = await this.prisma.serviceCatalogItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Item de catálogo não encontrado');

    const data: Prisma.ServiceCatalogItemUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.estimatedMinutes !== undefined ? { estimatedMinutes: input.estimatedMinutes } : {}),
      ...(input.defaultPriority !== undefined ? { defaultPriority: input.defaultPriority } : {}),
      ...(input.checklist !== undefined
        ? { checklist: Array.isArray(input.checklist) ? input.checklist : [] }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    };

    return this.prisma.serviceCatalogItem.update({
      where: { id },
      data,
    });
  }

  async remove(tenantId: string, id: string): Promise<{ success: boolean }> {
    const item = await this.prisma.serviceCatalogItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Item de catálogo não encontrado');

    await this.prisma.serviceCatalogItem.delete({ where: { id } });
    return { success: true };
  }

  async seedDefaults(tenantId: string): Promise<{ seeded: number }> {
    let count = 0;
    for (const item of DEFAULT_ISP_CATALOG) {
      await this.prisma.serviceCatalogItem.create({
        data: {
          tenantId,
          name: item.name,
          category: item.category,
          description: item.description,
          estimatedMinutes: item.estimatedMinutes,
          defaultPriority: item.defaultPriority,
          checklist: item.checklist,
          active: true,
        },
      });
      count++;
    }
    return { seeded: count };
  }
}
