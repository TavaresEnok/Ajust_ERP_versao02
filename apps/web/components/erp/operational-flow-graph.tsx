'use client';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import type { FlowDefinition, TrackingStatus } from '@/lib/erp/operational-flow';
import { useAppTheme } from '@/components/theme-provider';

export function OperationalFlowGraph({
  definition,
  active = [],
  completed = [],
  selected,
  onSelect,
  onChange,
  states,
  annotations,
  className = 'h-[360px]',
  minFitZoom,
}: {
  definition: FlowDefinition;
  active?: string[];
  completed?: string[];
  selected?: string;
  onSelect?: (id: string) => void;
  onChange?: (d: FlowDefinition) => void;
  states?: Record<string, TrackingStatus>;
  /** Altura do quadro (o editor de fluxos usa um quadro maior). */
  className?: string;
  /** Zoom mínimo ao enquadrar: no editor, prioriza ler os nomes em vez de ver tudo de uma vez. */
  minFitZoom?: number;
  annotations?: Record<string, string>;
}) {
  const { dark } = useAppTheme();
  const colors = {
    ACTIVE: 'var(--info)',
    COMPLETED: 'var(--success)',
    WAITING: 'var(--warning)',
    FAILED: 'var(--danger)',
    PENDING: '#64748b',
    CANCELED: '#64748b',
  };
  const labels = {
    ACTIVE: '● Etapa atual',
    COMPLETED: '✓ Concluída',
    WAITING: '◷ Aguardando',
    FAILED: '! Bloqueio ou falha',
    PENDING: '○ Sem execução registrada',
    CANCELED: '— Cancelada',
  };
  const nodes: Node[] = definition.nodes.map((n) => ({
    id: n.id,
    position: n.position,
    type: n.kind === 'end' ? 'output' : 'default',
    data: {
      label: (
        <div className="text-left">
          <small>
            {n.kind === 'task'
              ? n.orderKey === 'root'
                ? 'ETAPA'
                : 'ETAPA · O.S. SEPARADA'
              : n.kind === 'fork'
                ? 'DIVIDE EM PARALELO'
                : n.kind === 'join'
                  ? 'ESPERA OS PARALELOS'
                  : 'FIM'}
          </small>
          <div className="my-1 text-[15px] leading-snug font-semibold">{n.name}</div>
          {states && (
            <p className="my-2 text-xs font-semibold">{labels[states[n.id] || 'PENDING']}</p>
          )}
          {annotations?.[n.id] && <p className="mb-2 text-xs">{annotations[n.id]}</p>}
          <small>
            {n.sector}
            {n.kind === 'task' ? ` · ${n.slaMinutes} min` : ''}
          </small>
        </div>
      ),
    },
    style: {
      width: 225,
      padding: 12,
      borderRadius: 12,
      border: `2px solid ${states ? colors[states[n.id] || 'PENDING'] : selected === n.id ? 'var(--primary)' : active.includes(n.id) ? 'var(--info)' : completed.includes(n.id) ? 'var(--success)' : dark ? '#475569' : '#cbd5e1'}`,
      boxShadow:
        selected === n.id
          ? '0 0 0 3px #8b5cf655'
          : states?.[n.id] === 'ACTIVE'
            ? '0 0 0 3px #0284c733'
            : undefined,
      background: dark
        ? states?.[n.id] === 'ACTIVE'
          ? '#0c3048'
          : states?.[n.id] === 'COMPLETED'
            ? '#103726'
            : states?.[n.id] === 'WAITING'
              ? '#3c2b12'
              : states?.[n.id] === 'FAILED'
                ? '#401c21'
                : '#172033'
        : active.includes(n.id)
          ? '#e0f2fe'
          : completed.includes(n.id)
            ? '#f0fdf4'
            : states?.[n.id] === 'WAITING'
              ? '#fffbeb'
              : states?.[n.id] === 'FAILED'
                ? '#fef2f2'
                : '#fff',
      color: dark ? '#e2e8f0' : '#1e293b',
    },
  }));
  const edges: Edge[] = definition.nodes.flatMap((n) =>
    Object.entries(n.routes).map(([outcome, target]) => ({
      id: `${n.id}:${outcome}`,
      source: n.id,
      target,
      label: outcome,
      data: { outcome },
      type: 'smoothstep',
      reconnectable: !!onChange,
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: active.includes(n.id),
    })),
  );
  function connect(c: Connection) {
    if (!onChange || !c.source || !c.target || c.source === c.target) return;
    const source = definition.nodes.find((n) => n.id === c.source)!;
    if (source.kind === 'end') return;
    let label = 'Concluído';
    let i = 1;
    while (source.routes[label]) label = `Resultado ${i++}`;
    onChange({
      ...definition,
      nodes: definition.nodes.map((n) =>
        n.id === c.source ? { ...n, routes: { ...n.routes, [label]: c.target! } } : n,
      ),
    });
  }
  return (
    <div
      className={`workflow-canvas min-w-0 rounded-xl border border-border ${className}`}
      aria-label="Diagrama do fluxo de atendimento"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        colorMode={dark ? 'dark' : 'light'}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1, minZoom: minFitZoom }}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={!!onChange}
        nodesConnectable={!!onChange}
        deleteKeyCode={null}
        onNodeClick={(_, n) => onSelect?.(n.id)}
        onNodeDragStop={(_, moved) =>
          onChange?.({
            ...definition,
            nodes: definition.nodes.map((n) =>
              n.id === moved.id ? { ...n, position: moved.position } : n,
            ),
          })
        }
        onNodesChange={(changes) => {
          if (!onChange) return;
          const positions = changes.filter((c) => c.type === 'position' && c.position);
          if (positions.length)
            onChange({
              ...definition,
              nodes: definition.nodes.map((n) => {
                const p = positions.find((c) => c.type === 'position' && c.id === n.id);
                return p?.type === 'position' && p.position ? { ...n, position: p.position } : n;
              }),
            });
        }}
        onConnect={connect}
        onReconnect={(old, c) => {
          if (!onChange || !c.source || !c.target || c.source === c.target) return;
          const outcome = String(old.data?.outcome);
          const targetSource = definition.nodes.find((n) => n.id === c.source);
          if (
            !targetSource ||
            targetSource.kind === 'end' ||
            (c.source !== old.source && outcome in targetSource.routes)
          )
            return;
          const next = definition.nodes.map((n) => {
            const routes = { ...n.routes };
            if (n.id === old.source) delete routes[outcome];
            if (n.id === c.source) routes[outcome] = c.target!;
            return { ...n, routes };
          });
          onChange({ ...definition, nodes: next });
        }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
