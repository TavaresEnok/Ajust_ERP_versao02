import { z } from 'zod';

export const SERVICE_ORDER_TYPES = [
  'ROMPIMENTO',
  'LENTIDAO',
  'CONFIGURACAO_ONU',
  'TROCA_SENHA',
  'CANCELAMENTO',
  'AUDITORIA',
  'INSTALACAO',
  'BGP'
] as const;

export const PRIORITIES = ['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'] as const;

export const STATUS = [
  'ABERTA',
  'EM_ANALISE',
  'AG_CAMPO',
  'AG_TERCEIROS',
  'RESOLVIDA',
  'FECHADA',
  'CANCELADA'
] as const;

export const ServiceOrderSchema = z.object({
  tenantId: z.string().uuid(),
  type: z.enum(SERVICE_ORDER_TYPES),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUS),
  protocol: z.string().min(4),
  title: z.string().min(3),
  description: z.string().min(3)
});

export type ServiceOrderInput = z.infer<typeof ServiceOrderSchema>;

export function computeSlaHours(type: (typeof SERVICE_ORDER_TYPES)[number], priority: (typeof PRIORITIES)[number]) {
  const base: Record<(typeof PRIORITIES)[number], number> = {
    BAIXA: 72,
    NORMAL: 24,
    ALTA: 8,
    CRITICA: 4
  };

  if (type === 'ROMPIMENTO' || type === 'BGP') {
    return Math.max(2, base[priority] / 2);
  }

  return base[priority];
}
