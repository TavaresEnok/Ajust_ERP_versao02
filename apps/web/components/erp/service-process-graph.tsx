'use client';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';

export interface HumanStage {
  id: string;
  name: string;
  kind: 'task' | 'decision' | 'wait' | 'end';
  sector: string;
  slaMinutes: number;
  roles: string[];
  requiredFields: string[];
  routes: Record<string, string>;
  serviceType: string;
  position?: { x: number; y: number };
}
export interface HumanDefinition {
  code: string;
  name: string;
  version: number;
  description: string;
  start: string;
  slaMode: string;
  sourceTypes: string[];
  nodes: HumanStage[];
}
export interface HumanVisit {
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
export function ServiceProcessGraph({
  definition,
  current,
  history = [],
  onSelect,
  onMove,
}: {
  definition: HumanDefinition;
  current?: string;
  history?: HumanVisit[];
  onSelect?: (id: string) => void;
  onMove?: (id: string, position: { x: number; y: number }) => void;
}) {
  const sectors = [...new Set(definition.nodes.map((n) => n.sector))];
  const laneColors = ['#eff6ff', '#fff7ed', '#f5f3ff', '#ecfdf5'];
  const lanes: Node[] = sectors.map((sector, i) => ({
    id: `lane:${sector}`,
    type: 'group',
    position: { x: -30, y: i * 170 - 35 },
    data: { label: sector },
    draggable: false,
    selectable: false,
    style: {
      width: definition.nodes.length * 255 + 20,
      height: 155,
      background: laneColors[i % laneColors.length],
      color: '#475569',
      border: '1px solid #e2e8f0',
      fontSize: 15,
      fontWeight: 700,
      padding: '6px 12px',
      zIndex: -1,
    },
  }));
  const labels = { task: 'O.S.', decision: 'Decisão', wait: 'Espera', end: 'Fim' };
  const nodes: Node[] = definition.nodes.map((n, i) => ({
    id: n.id,
    position: n.position || { x: i * 255, y: sectors.indexOf(n.sector) * 170 },
    type: n.kind === 'end' ? 'output' : 'default',
    data: {
      label: (
        <div className="text-left">
          <div className="text-[10px] uppercase">
            {n.sector} · {labels[n.kind]}
          </div>
          <strong>{n.name}</strong>
          <div>{n.kind !== 'end' && `${n.slaMinutes} min · meta piloto`}</div>
          {current === n.id && <div>Etapa atual</div>}
        </div>
      ),
    },
    style: {
      width: 215,
      border: current === n.id ? '3px solid #2563eb' : '1px solid #94a3b8',
      background:
        current === n.id
          ? '#dbeafe'
          : history.some((v) => v.nodeId === n.id)
            ? '#dcfce7'
            : '#f8fafc',
      color: '#0f172a',
      borderRadius: n.kind === 'decision' ? 3 : 12,
    },
  }));
  const edges: Edge[] = definition.nodes.flatMap((n) =>
    Object.entries(n.routes).map(([label, target], i) => ({
      id: `${n.id}-${i}`,
      source: n.id,
      target,
      label,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: current === n.id,
    })),
  );
  return (
    <div
      className="h-[440px] rounded-xl border border-border"
      role="region"
      aria-label={`Fluxograma ${definition.name}`}
    >
      <ReactFlow
        nodes={[...lanes, ...nodes]}
        edges={edges}
        fitView
        minZoom={0.1}
        maxZoom={1.8}
        nodesDraggable={!!onMove}
        nodesConnectable={false}
        onNodesChange={(changes) => {
          for (const change of changes)
            if (change.type === 'position' && change.position) onMove?.(change.id, change.position);
        }}
        onNodeClick={(_, n) => {
          if (!n.id.startsWith('lane:')) onSelect?.(n.id);
        }}
        onNodeDragStop={(_, n) => onMove?.(n.id, n.position)}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
