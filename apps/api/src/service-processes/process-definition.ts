import { BadRequestException } from '@nestjs/common';
import { ServiceOrderType } from '@prisma/client';
import { z } from 'zod';

export const ProcessDefinitionSchema = z
  .object({
    code: z.string().regex(/^[A-Z_]+$/),
    name: z.string().min(3).max(120),
    version: z.number().int().positive(),
    description: z.string().max(2000),
    sourceTypes: z.array(z.string()),
    start: z.string(),
    slaMode: z.literal('PILOT_PROPOSED'),
    nodes: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z_]+$/),
            name: z.string().min(3),
            kind: z.enum(['task', 'decision', 'wait', 'end']),
            sector: z.string().min(2),
            roles: z.array(z.enum(['super_admin', 'gerente', 'analista'])).min(1),
            serviceType: z.nativeEnum(ServiceOrderType),
            slaMinutes: z.number().int().min(1).max(525600),
            requiredFields: z.array(z.string().min(1)),
            routes: z.record(z.string().min(1), z.string().min(1)),
            position: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(100),
  })
  .strict();

export type ProcessDefinition = z.infer<typeof ProcessDefinitionSchema>;
export type ProcessNode = ProcessDefinition['nodes'][number];
export interface ProcessVisit {
  nodeId: string;
  attempt: number;
  enteredAt: string;
  dueAt: string;
  orderId?: string;
  assigneeUserId?: string;
  completedAt?: string;
  outcome?: string;
  evidence?: Record<string, string>;
  actorId?: string;
}
export interface ProcessState {
  current: ProcessVisit | null;
  history: ProcessVisit[];
  events: { type: string; at: string; actorId: string | null; reason: string }[];
  pausedAt?: string | null;
  imported?: boolean;
}

export function validateDefinition(value: unknown): ProcessDefinition {
  const def = ProcessDefinitionSchema.parse(value);
  const ids = new Set(def.nodes.map((n) => n.id));
  if (ids.size !== def.nodes.length || !ids.has(def.start)) {
    throw new BadRequestException('IDs repetidos ou início inválido no processo.');
  }
  for (const node of def.nodes) {
    const targets = Object.values(node.routes);
    if (node.kind === 'end' ? targets.length !== 0 : targets.length === 0) {
      throw new BadRequestException('Etapas precisam de saída; encerramentos não têm saída.');
    }
    if (targets.some((id) => !ids.has(id))) throw new BadRequestException('Destino inexistente.');
  }
  const reachable = new Set<string>([def.start]);
  for (let changed = true; changed;) {
    changed = false;
    for (const node of def.nodes.filter((n) => reachable.has(n.id))) {
      for (const target of Object.values(node.routes)) {
        if (!reachable.has(target)) {
          reachable.add(target);
          changed = true;
        }
      }
    }
  }
  const finishable = new Set(def.nodes.filter((n) => n.kind === 'end').map((n) => n.id));
  for (let changed = true; changed;) {
    changed = false;
    for (const node of def.nodes) {
      if (!finishable.has(node.id) && Object.values(node.routes).some((id) => finishable.has(id))) {
        finishable.add(node.id);
        changed = true;
      }
    }
  }
  if (reachable.size !== ids.size || finishable.size !== ids.size) {
    throw new BadRequestException('Há etapas desconectadas ou sem caminho até o fim.');
  }
  return def;
}

export function nextVisit(
  def: ProcessDefinition,
  state: ProcessState,
  nodeId: string,
  now: Date,
): ProcessVisit {
  const node = def.nodes.find((n) => n.id === nodeId)!;
  return {
    nodeId,
    attempt: state.history.filter((h) => h.nodeId === nodeId).length + 1,
    enteredAt: now.toISOString(),
    dueAt: new Date(now.getTime() + node.slaMinutes * 60000).toISOString(),
  };
}
