'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Zap, GitBranch, Play, Plus, Trash2, Save, ToggleLeft, ToggleRight, X, ChevronRight, Loader2, Sparkles } from 'lucide-react';

const cn = (...c: any[]) => c.filter(Boolean).join(' ');

// ─── Types ────────────────────────────────────────────────────────────────────
interface WFNode {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  subtype: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}
interface WFEdge { id: string; source: string; target: string; label?: string; }
interface WorkflowDef {
  nodes: WFNode[];
  edges: WFEdge[];
  versions?: Array<{
    version: number;
    createdAt: string;
    createdBy?: string | null;
    name: string;
    description?: string;
    definition: {
      nodes: WFNode[];
      edges: WFEdge[];
      governance?: {
        ownerTeam?: string;
        requiresApproval?: boolean;
        changeTicketRequired?: boolean;
        maxExecutionsPerHour?: number;
        stopOnFailure?: boolean;
      };
    };
  }>;
  governance?: {
    ownerTeam?: string;
    requiresApproval?: boolean;
    changeTicketRequired?: boolean;
    maxExecutionsPerHour?: number;
    stopOnFailure?: boolean;
  };
}
interface WorkflowRule {
  id: string; name: string; description?: string; enabled: boolean;
  definition: WorkflowDef; runCount: number; lastRunAt?: string; createdAt: string;
}

// ─── Node Palette ─────────────────────────────────────────────────────────────
const TRIGGERS = [
  { subtype: 'start_implantacao', label: 'Início da Implantação', icon: '🟢', desc: 'Evento inicial do playbook operacional' },
  { subtype: 'start_os_criada', label: 'O.S Criada', icon: '📥', desc: 'Inicia ao abrir uma O.S de implantação' },
];
const CONDITIONS = [
  { subtype: 'gateway_parallel', label: 'Gateway Paralelo (AND)', icon: '🔀', fields: [] },
  { subtype: 'gateway_parallel_join', label: 'Gateway Convergente (AND Join)', icon: '🔗', fields: [] },
  { subtype: 'gateway_decision', label: 'Gateway Exclusivo (XOR)', icon: '❓', fields: ['field', 'operator', 'value'] },
];
const ACTIONS = [
  { subtype: 'task_service', label: 'Tarefa de Serviço', icon: '🧩', fields: ['taskName', 'team'] },
  { subtype: 'action_notify_slack', label: 'Notificar Slack/Teams', icon: '💬', fields: ['webhookUrl', 'message'] },
  { subtype: 'action_assign', label: 'Atribuir Analista', icon: '👤', fields: ['analystId'] },
  { subtype: 'action_escalate', label: 'Escalonar Prioridade', icon: '🚨', fields: ['to'] },
  { subtype: 'action_webhook', label: 'Disparar Webhook', icon: '🔗', fields: ['url', 'method'] },
  { subtype: 'action_csat', label: 'Enviar CSAT', icon: '⭐', fields: ['delay'] },
  { subtype: 'end_flow', label: 'Fim do Fluxo', icon: '🏁', fields: [] },
];

// ─── Node colours ─────────────────────────────────────────────────────────────
const NODE_COLORS: Record<WFNode['type'], { bg: string; border: string; icon: string; badge: string }> = {
  trigger:   { bg: 'bg-violet-500/10', border: 'border-violet-500/50', icon: 'text-violet-400', badge: 'bg-violet-500' },
  condition: { bg: 'bg-amber-500/10',  border: 'border-amber-500/50',  icon: 'text-amber-400',  badge: 'bg-amber-500'  },
  action:    { bg: 'bg-emerald-500/10',border: 'border-emerald-500/50',icon: 'text-emerald-400',badge: 'bg-emerald-500'},
};

const NODE_ICON: Record<WFNode['type'], React.ReactNode> = {
  trigger:   <Zap size={14} />,
  condition: <GitBranch size={14} />,
  action:    <Play size={14} />,
};

const allNodeDefs = [...TRIGGERS.map(t => ({...t, type: 'trigger' as const})),
                    ...CONDITIONS.map(c => ({...c, type: 'condition' as const})),
                    ...ACTIONS.map(a => ({...a, type: 'action' as const}))];

const getLabelForNode = (node: WFNode) => {
  const def = allNodeDefs.find(d => d.subtype === node.subtype);
  return def?.label ?? node.subtype;
};
const getIconForNode = (node: WFNode) => {
  const def = allNodeDefs.find(d => d.subtype === node.subtype);
  return (def as any)?.icon ?? '⚙️';
};

const canCreateOutgoing = (node: WFNode, outgoingCount: number) => {
  if (node.type !== 'condition') return outgoingCount < 1;
  if (node.subtype === 'gateway_parallel') return true;
  if (node.subtype === 'gateway_decision') return outgoingCount < 2;
  if (node.subtype === 'gateway_parallel_join') return outgoingCount < 1;
  return outgoingCount < 2;
};

// ─── Canvas Node Component ────────────────────────────────────────────────────
function CanvasNode({
  node, selected, onSelect, onDragStart, onDelete, onConnectStart, onConnectEnd
}: {
  node: WFNode; selected: boolean;
  onSelect: () => void; onDragStart: (e: React.MouseEvent) => void; onDelete: () => void;
  onConnectStart: (nodeId: string) => void;
  onConnectEnd: (nodeId: string) => void;
}) {
  const col = NODE_COLORS[node.type];
  return (
    <div
      className={cn(
        'absolute rounded-xl border-2 p-3 w-52 cursor-grab select-none shadow-lg transition-all',
        col.bg, col.border,
        selected ? 'ring-2 ring-white/40 scale-105' : 'hover:scale-105'
      )}
      style={{ left: node.position.x, top: node.position.y }}
      onMouseDown={(e) => { onSelect(); onDragStart(e); }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn('flex-shrink-0 p-1 rounded text-xs', col.badge + ' text-white')}>{NODE_ICON[node.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{node.type}</p>
            <p className="text-xs font-semibold text-white truncate">{getIconForNode(node)} {getLabelForNode(node)}</p>
          </div>
        </div>
        <button
          className="text-slate-500 hover:text-rose-400 transition-colors flex-shrink-0"
          onMouseDown={e => { e.stopPropagation(); onDelete(); }}
        >
          <X size={12} />
        </button>
      </div>
      <button
        type="button"
        className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-indigo-600 border-2 border-indigo-300 cursor-crosshair hover:scale-110"
        onMouseDown={(e) => { e.stopPropagation(); onConnectStart(node.id); }}
        title="Iniciar conexão"
      />
      <button
        type="button"
        className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-600 border-2 border-emerald-300 cursor-pointer hover:scale-110"
        onMouseDown={(e) => { e.stopPropagation(); onConnectEnd(node.id); }}
        title="Finalizar conexão"
      />
    </div>
  );
}

// ─── SVG Edges ────────────────────────────────────────────────────────────────
function EdgeLine({ from, to }: { from: {x:number;y:number}; to: {x:number;y:number} }) {
  const cx1 = from.x + 80;
  const cy1 = from.y;
  const cx2 = to.x - 80;
  const cy2 = to.y;
  return (
    <path
      d={`M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`}
      fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="6 3"
      markerEnd="url(#arrowhead)"
      className="opacity-70"
    />
  );
}

// ─── Main Visual Canvas ───────────────────────────────────────────────────────
function WorkflowCanvas({
  dark, definition, onChange, selectedNodeId, onSelectNode
}: {
  dark: boolean;
  definition: WorkflowDef;
  onChange: (def: WorkflowDef) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const dragging = useRef<{ nodeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    const node = definition.nodes.find(n => n.id === nodeId);
    if (!node) return;
    dragging.current = { nodeId, startX: e.clientX, startY: e.clientY, origX: node.position.x, origY: node.position.y };
    e.preventDefault();
  }, [definition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (bounds) {
      const localX = (e.clientX - bounds.left - pan.x) / zoom;
      const localY = (e.clientY - bounds.top - pan.y) / zoom;
      setPointer({ x: localX, y: localY });
    }

    if (panRef.current) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPan({ x: panRef.current.originX + dx, y: panRef.current.originY + dy });
      return;
    }
    if (!dragging.current) return;
    const dx = (e.clientX - dragging.current.startX) / zoom;
    const dy = (e.clientY - dragging.current.startY) / zoom;
    onChange({
      ...definition,
      nodes: definition.nodes.map(n =>
        n.id === dragging.current!.nodeId
          ? { ...n, position: { x: Math.max(0, dragging.current!.origX + dx), y: Math.max(0, dragging.current!.origY + dy) } }
          : n
      )
    });
  }, [definition, onChange, pan.x, pan.y, zoom]);

  const handleMouseUp = useCallback(() => { dragging.current = null; panRef.current = null; }, []);

  const deleteNode = (id: string) => {
    onChange({
      nodes: definition.nodes.filter(n => n.id !== id),
      edges: definition.edges.filter(e => e.source !== id && e.target !== id),
    });
    if (selectedNodeId === id) onSelectNode(null);
  };

  // Calculate edge paths: connect centre-right of source to centre-left of target
  const getNodeCenter = (id: string): { x: number; y: number } => {
    const node = definition.nodes.find(n => n.id === id);
    if (!node) return { x: 0, y: 0 };
    return { x: node.position.x + 208, y: node.position.y + 44 };
  };

  const getNodeLeftPort = (id: string): { x: number; y: number } => {
    const node = definition.nodes.find(n => n.id === id);
    if (!node) return { x: 0, y: 0 };
    return { x: node.position.x, y: node.position.y + 44 };
  };

  const canvasEdges = definition.edges
    .map((edge) => {
      const from = getNodeCenter(edge.source);
      const to = getNodeLeftPort(edge.target);
      return { edge, from, to };
    });

  const teams = useMemo(() => {
    const buckets = new Set<string>();
    for (const node of definition.nodes) {
      const team = String(node.config?.team || '').trim();
      if (team) buckets.add(team);
    }
    if (buckets.size === 0) buckets.add('Workflow');
    return Array.from(buckets);
  }, [definition.nodes]);

  const laneByNode = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of definition.nodes) {
      const team = String(node.config?.team || '').trim() || (definition.governance?.ownerTeam || 'Workflow');
      map.set(node.id, team);
    }
    return map;
  }, [definition.nodes, definition.governance?.ownerTeam]);

  const laneIndex = useMemo(() => {
    const map = new Map<string, number>();
    teams.forEach((team, idx) => map.set(team, idx));
    return map;
  }, [teams]);

  const autoLayout = useCallback(() => {
    const nodes = definition.nodes;
    const edges = definition.edges;
    if (nodes.length === 0) return;

    const incomingCount = new Map<string, number>();
    const outgoing = new Map<string, string[]>();
    for (const n of nodes) {
      incomingCount.set(n.id, 0);
      outgoing.set(n.id, []);
    }
    for (const e of edges) {
      incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1);
      const list = outgoing.get(e.source) || [];
      list.push(e.target);
      outgoing.set(e.source, list);
    }

    const depth = new Map<string, number>();
    const queue: string[] = nodes.filter((n) => (incomingCount.get(n.id) || 0) === 0).map((n) => n.id);
    for (const id of queue) depth.set(id, 0);
    while (queue.length) {
      const cur = queue.shift() as string;
      const curDepth = depth.get(cur) || 0;
      for (const next of outgoing.get(cur) || []) {
        depth.set(next, Math.max(depth.get(next) || 0, curDepth + 1));
        incomingCount.set(next, (incomingCount.get(next) || 0) - 1);
        if ((incomingCount.get(next) || 0) <= 0) queue.push(next);
      }
    }

    const laneCursor = new Map<string, number>();
    const sorted = [...nodes].sort((a, b) => (depth.get(a.id) || 0) - (depth.get(b.id) || 0));
    const positioned = sorted.map((node) => {
      const team = laneByNode.get(node.id) || 'Workflow';
      const lane = laneIndex.get(team) || 0;
      const d = depth.get(node.id) || 0;
      const order = laneCursor.get(team) || 0;
      laneCursor.set(team, order + 1);
      return {
        ...node,
        position: {
          x: 120 + d * 280,
          y: 90 + lane * 170 + (order % 2) * 82,
        },
      };
    });

    onChange({ ...definition, nodes: positioned });
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [definition, laneByNode, laneIndex, onChange]);

  const addEdgeFromPorts = useCallback((source: string, target: string) => {
    if (!source || !target || source === target) return;
    const sourceNode = definition.nodes.find((n) => n.id === source);
    if (!sourceNode) return;

    const duplicated = definition.edges.some((e) => e.source === source && e.target === target);
    if (duplicated) return;

    const sourceEdges = definition.edges.filter((e) => e.source === source);
    if (!canCreateOutgoing(sourceNode, sourceEdges.length)) return;

    const label = sourceNode.subtype === 'gateway_decision'
      ? (sourceEdges.some((e) => (e.label || '').toLowerCase() === 'true') ? 'false' : 'true')
      : undefined;
    const newEdge: WFEdge = { id: `edge_${Date.now()}`, source, target, ...(label ? { label } : {}) };
    onChange({ ...definition, edges: [...definition.edges, newEdge] });
  }, [definition, onChange]);

  const maxX = definition.nodes.reduce((acc, n) => Math.max(acc, n.position.x), 0);
  const maxY = definition.nodes.reduce((acc, n) => Math.max(acc, n.position.y), 0);
  const innerWidth = Math.max(1200, maxX + 340);
  const laneHeight = Math.max(1, teams.length) * 170 + 140;
  const innerHeight = Math.max(620, maxY + 260, laneHeight);

  return (
    <div
      ref={canvasRef}
      className={cn(
        'w-full overflow-auto rounded-xl border select-none',
        'bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#0f172a_100%)]',
        dark ? 'border-slate-700' : 'border-slate-200'
      )}
      style={{ height: 480 }}
      onWheel={(e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => Math.min(2, Math.max(0.35, Number((z + delta).toFixed(2)))));
      }}
      onClick={() => { onSelectNode(null); setConnectFrom(null); }}
      onMouseDown={(e) => {
        if (e.button === 1 || e.altKey) {
          panRef.current = { startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y };
        }
      }}
    >
      <div
        className="relative"
        style={{ width: innerWidth, height: innerHeight }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      >
      <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: innerWidth, height: innerHeight }}>
      {/* Swimlanes */}
      {teams.map((team, idx) => (
        <div
          key={team}
          className={cn('absolute left-0 right-0 border-t border-b', dark ? 'border-slate-700/60 bg-slate-900/20' : 'border-slate-200/60 bg-slate-100/20')}
          style={{ top: idx * 170 + 40, height: 160 }}
        >
          <span className={cn('absolute left-3 top-2 text-[10px] uppercase tracking-wider font-bold', dark ? 'text-slate-400' : 'text-slate-500')}>
            Lane · {team}
          </span>
        </div>
      ))}
      {/* Grid dots */}
      <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
        <pattern id="dotgrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="1" fill="#6366f1" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#dotgrid)" />
      </svg>

      {/* SVG edges layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
          </marker>
        </defs>
        {canvasEdges.map((e) => <EdgeLine key={e.edge.id} from={e.from} to={e.to} />)}
        {connectFrom && pointer && (() => {
          const from = getNodeCenter(connectFrom);
          return <EdgeLine from={from} to={pointer} />;
        })()}
      </svg>

      {/* Nodes */}
      {definition.nodes.map(node => (
        <CanvasNode
          key={node.id}
          node={node}
          selected={selectedNodeId === node.id}
          onSelect={() => onSelectNode(node.id)}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDelete={() => deleteNode(node.id)}
          onConnectStart={(nodeId) => setConnectFrom(nodeId)}
          onConnectEnd={(nodeId) => {
            if (connectFrom) addEdgeFromPorts(connectFrom, nodeId);
            setConnectFrom(null);
          }}
        />
      ))}

      {definition.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <Zap size={40} className="text-slate-600 mb-3" />
          <p className="text-slate-500 text-sm font-semibold">Canvas vazio</p>
          <p className="text-slate-600 text-xs mt-1">Arraste um bloco da paleta à esquerda para começar</p>
        </div>
      )}
      </div>
      <div className="absolute right-2 top-2 flex items-center gap-1 z-10">
        <button
          type="button"
          onClick={autoLayout}
          className="px-2 py-1 rounded bg-violet-700/80 text-violet-100 text-xs flex items-center gap-1"
        >
          <Sparkles size={11} />
          Auto
        </button>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.1).toFixed(2))))} className="px-2 py-1 rounded bg-slate-800/80 text-slate-200 text-xs">-</button>
        <span className="px-2 py-1 rounded bg-slate-800/80 text-slate-200 text-[11px]">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))))} className="px-2 py-1 rounded bg-slate-800/80 text-slate-200 text-xs">+</button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="px-2 py-1 rounded bg-slate-800/80 text-slate-200 text-xs">Reset</button>
      </div>
      <div className="absolute bottom-2 right-2 z-10 rounded border border-slate-600 bg-slate-900/90 p-2">
        <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Minimap</div>
        <svg width="160" height="90" viewBox={`0 0 ${innerWidth} ${innerHeight}`} className="bg-slate-800 rounded">
          {definition.edges.map((e) => {
            const s = definition.nodes.find((n) => n.id === e.source);
            const t = definition.nodes.find((n) => n.id === e.target);
            if (!s || !t) return null;
            return <line key={e.id} x1={s.position.x + 100} y1={s.position.y + 30} x2={t.position.x + 20} y2={t.position.y + 30} stroke="#64748b" strokeWidth="6" />;
          })}
          {definition.nodes.map((n) => (
            <rect key={n.id} x={n.position.x} y={n.position.y} width="120" height="60" rx="8" fill={n.type === 'trigger' ? '#8b5cf6' : n.type === 'condition' ? '#f59e0b' : '#10b981'} opacity="0.8" />
          ))}
        </svg>
      </div>
      </div>
    </div>
  );
}

function EdgeManager({
  dark,
  definition,
  onChange
}: {
  dark: boolean;
  definition: WorkflowDef;
  onChange: (def: WorkflowDef) => void;
}) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [label, setLabel] = useState('');

  const addEdge = () => {
    if (!source || !target || source === target) return;
    const sourceNode = definition.nodes.find((n) => n.id === source);
    if (!sourceNode) return;

    const sourceEdges = definition.edges.filter((e) => e.source === source);
    if (!canCreateOutgoing(sourceNode, sourceEdges.length)) return;

    if (sourceNode.type === 'condition' && sourceNode.subtype === 'gateway_decision' && label) {
      const normalized = label.toLowerCase();
      if (normalized !== 'true' && normalized !== 'false') return;
      const duplicated = sourceEdges.some((e) => (e as any).label?.toLowerCase() === normalized);
      if (duplicated) return;
    }

    const newEdge: any = { id: `edge_${Date.now()}`, source, target };
    if (label && sourceNode.subtype === 'gateway_decision') newEdge.label = label.toLowerCase();

    onChange({ ...definition, edges: [...definition.edges, newEdge] });
    setTarget('');
    setLabel('');
  };

  const removeEdge = (id: string) => {
    onChange({ ...definition, edges: definition.edges.filter((e) => e.id !== id) });
  };

  return (
    <div className={cn('rounded-xl border p-3', dark ? 'bg-slate-900/50 border-slate-700/60' : 'bg-white border-slate-200')}>
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Ramificações</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <select value={source} onChange={(e) => setSource(e.target.value)} className={cn('px-2 py-2 rounded border text-xs', dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300')}>
          <option value="">Origem</option>
          {definition.nodes.map((n) => <option key={n.id} value={n.id}>{getLabelForNode(n)}</option>)}
        </select>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className={cn('px-2 py-2 rounded border text-xs', dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300')}>
          <option value="">Destino</option>
          {definition.nodes.filter((n) => n.id !== source).map((n) => <option key={n.id} value={n.id}>{getLabelForNode(n)}</option>)}
        </select>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="label: true/false (apenas XOR)" className={cn('px-2 py-2 rounded border text-xs', dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300')} />
        <button onClick={addEdge} className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold">Conectar</button>
      </div>
      <div className="mt-3 space-y-1 max-h-28 overflow-y-auto">
        {definition.edges.length === 0 && <p className="text-[11px] text-slate-500">Sem conexões.</p>}
        {definition.edges.map((e: any) => {
          const sourceNode = definition.nodes.find((n) => n.id === e.source);
          const targetNode = definition.nodes.find((n) => n.id === e.target);
          return (
            <div key={e.id} className={cn('flex items-center justify-between px-2 py-1 rounded text-xs', dark ? 'bg-slate-800/70 text-slate-300' : 'bg-slate-50 text-slate-700')}>
              <span>{sourceNode ? getLabelForNode(sourceNode) : e.source} → {targetNode ? getLabelForNode(targetNode) : e.target} {e.label ? `(${e.label})` : ''}</span>
              <button onClick={() => removeEdge(e.id)} className="text-rose-400"><Trash2 size={12} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GovernancePanel({
  dark,
  definition,
  onChange
}: {
  dark: boolean;
  definition: WorkflowDef;
  onChange: (def: WorkflowDef) => void;
}) {
  const gov = definition.governance || {};
  const setGov = (patch: Record<string, unknown>) => onChange({ ...definition, governance: { ...gov, ...patch } });

  return (
    <div className={cn('rounded-xl border p-3', dark ? 'bg-slate-900/50 border-slate-700/60' : 'bg-white border-slate-200')}>
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Governança</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input
          value={gov.ownerTeam || ''}
          onChange={(e) => setGov({ ownerTeam: e.target.value })}
          placeholder="Time dono (ex: NOC L2)"
          className={cn('px-2 py-2 rounded border text-xs', dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300')}
        />
        <input
          type="number"
          value={gov.maxExecutionsPerHour || 0}
          onChange={(e) => setGov({ maxExecutionsPerHour: Number(e.target.value) || 0 })}
          placeholder="Máx execuções/h"
          className={cn('px-2 py-2 rounded border text-xs', dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300')}
        />
      </div>
      <div className="flex flex-wrap gap-3 mt-3 text-xs">
        <label className="flex items-center gap-1 text-slate-400">
          <input type="checkbox" checked={!!gov.requiresApproval} onChange={(e) => setGov({ requiresApproval: e.target.checked })} />
          Exige aprovação
        </label>
        <label className="flex items-center gap-1 text-slate-400">
          <input type="checkbox" checked={!!gov.changeTicketRequired} onChange={(e) => setGov({ changeTicketRequired: e.target.checked })} />
          Exige ticket de mudança
        </label>
        <label className="flex items-center gap-1 text-slate-400">
          <input type="checkbox" checked={gov.stopOnFailure !== false} onChange={(e) => setGov({ stopOnFailure: e.target.checked })} />
          Parar em falha
        </label>
      </div>
    </div>
  );
}

function NodeConfigPanel({
  dark,
  node,
  onUpdate
}: {
  dark: boolean;
  node: WFNode | null;
  onUpdate: (patch: Record<string, any>) => void;
}) {
  if (!node) {
    return (
      <div className={cn('rounded-xl border p-3 text-xs', dark ? 'bg-slate-900/50 border-slate-700/60 text-slate-500' : 'bg-white border-slate-200 text-slate-500')}>
        Selecione um nó para configurar parâmetros obrigatórios.
      </div>
    );
  }

  const requiredBySubtype: Record<string, string[]> = {
    gateway_decision: ['field', 'operator', 'value'],
    task_service: ['taskName', 'team'],
    action_notify_slack: ['webhookUrl', 'message'],
    action_assign: ['analystId'],
    action_escalate: ['to'],
    action_webhook: ['url', 'method'],
    action_csat: ['delay'],
  };

  const fields = requiredBySubtype[node.subtype] || [];

  return (
    <div className={cn('rounded-xl border p-3', dark ? 'bg-slate-900/50 border-slate-700/60' : 'bg-white border-slate-200')}>
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Configuração do Nó</p>
      <p className="text-xs text-slate-400 mb-2">{getLabelForNode(node)} ({node.type})</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {fields.length === 0 ? (
          <p className="text-xs text-slate-500">Este tipo não exige campos obrigatórios.</p>
        ) : (
          fields.map((field) => (
            <input
              key={field}
              value={String(node.config?.[field] ?? '')}
              onChange={(e) => onUpdate({ [field]: e.target.value })}
              placeholder={field}
              className={cn('px-2 py-2 rounded border text-xs', dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300')}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Node Palette Panel ───────────────────────────────────────────────────────
function NodePalette({ dark, onAdd }: { dark: boolean; onAdd: (type: WFNode['type'], subtype: string) => void }) {
  const [tab, setTab] = useState<'trigger' | 'condition' | 'action'>('trigger');
  const lists: Record<string, typeof TRIGGERS> = { trigger: TRIGGERS, condition: CONDITIONS as any, action: ACTIONS as any };

  return (
    <div className={cn('flex flex-col rounded-xl border overflow-hidden flex-shrink-0 w-56', dark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200')}>
      <div className="flex border-b border-slate-700/50">
        {(['trigger', 'condition', 'action'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors',
              tab === t ? 'bg-violet-500/20 text-violet-300' : 'text-slate-500 hover:text-slate-300'
            )}>
            {t === 'trigger' ? 'Gatilho' : t === 'condition' ? 'Cond.' : 'Ação'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {lists[tab].map(item => (
          <button key={item.subtype}
            onClick={() => onAdd(tab, item.subtype)}
            className={cn('w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all group',
              NODE_COLORS[tab].bg, NODE_COLORS[tab].border, 'hover:scale-[1.02]'
            )}>
            <span className="flex items-center gap-2">
              <span className="text-base">{(item as any).icon}</span>
              <span className="font-semibold text-white/90">{item.label}</span>
              <ChevronRight size={10} className="ml-auto text-slate-500 group-hover:text-slate-300" />
            </span>
            {(item as any).desc && <p className="text-slate-500 text-[10px] mt-0.5 pl-7">{(item as any).desc}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Workflow List Panel ──────────────────────────────────────────────────────
function WorkflowList({ dark, rules, selected, onSelect, onNew, onToggle, onDelete, loading }: {
  dark: boolean; rules: WorkflowRule[]; selected: WorkflowRule | null;
  onSelect: (r: WorkflowRule) => void; onNew: () => void;
  onToggle: (r: WorkflowRule) => void; onDelete: (r: WorkflowRule) => void; loading: boolean;
}) {
  return (
    <div className={cn('flex flex-col rounded-xl border overflow-hidden flex-shrink-0 w-64', dark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200')}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Workflows</p>
        <button onClick={onNew} className="p-1 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors">
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-slate-700/30">
        {loading && <div className="flex items-center justify-center py-8 text-slate-500"><Loader2 size={18} className="animate-spin" /></div>}
        {!loading && rules.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-xs text-slate-500">Nenhum workflow ainda.</p>
            <button onClick={onNew} className="mt-2 text-xs text-violet-400 hover:underline">Criar primeiro</button>
          </div>
        )}
        {rules.map(r => (
          <button key={r.id} onClick={() => onSelect(r)}
            className={cn('w-full text-left px-4 py-3 transition-colors group', selected?.id === r.id ? 'bg-violet-500/10' : 'hover:bg-slate-700/30')}>
            <div className="flex items-start justify-between gap-1">
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold truncate', dark ? 'text-white' : 'text-slate-800')}>{r.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{r.runCount} execuções</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); onToggle(r); }}
                  className="text-slate-400 hover:text-emerald-400 transition-colors">
                  {r.enabled ? <ToggleRight size={14} className="text-emerald-400" /> : <ToggleLeft size={14} />}
                </button>
                <button onClick={e => { e.stopPropagation(); onDelete(r); }}
                  className="text-slate-400 hover:text-rose-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <span className={cn('inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded font-bold',
              r.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/40 text-slate-400'
            )}>{r.enabled ? 'ATIVO' : 'INATIVO'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function WorkflowBuilderView({ dark, tenantId, onToast }: {
  dark: boolean; tenantId: string; onToast: (m: string) => void;
}) {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [selected, setSelected] = useState<WorkflowRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDef, setEditDef] = useState<WorkflowDef>({ nodes: [], edges: [], governance: {} });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const versions = selected?.definition?.versions || [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workflows', { cache: 'no-store' });
      if (res.ok) setRules(await res.json());
    } catch { onToast('Falha ao carregar workflows.'); }
    finally { setLoading(false); }
  }, [onToast]);

  useEffect(() => { if (tenantId) load(); }, [tenantId, load]);

  const selectRule = (r: WorkflowRule) => {
    setSelected(r);
    setEditName(r.name);
    setEditDef((r.definition as WorkflowDef) || { nodes: [], edges: [], governance: {} });
    setSelectedNodeId(null);
  };

  const newRule = () => {
    const draft: WorkflowRule = {
      id: '__new__', name: 'Novo Workflow', enabled: true,
      definition: { nodes: [], edges: [], governance: {} }, runCount: 0, createdAt: new Date().toISOString()
    };
    setSelected(draft);
    setEditName('Novo Workflow');
    setEditDef({ nodes: [], edges: [], governance: {} });
    setSelectedNodeId(null);
  };

  const addNode = (type: WFNode['type'], subtype: string) => {
    const nodeCount = editDef.nodes.length;
    const newNode: WFNode = {
      id: `node_${Date.now()}`, type, subtype, config: {},
      position: { x: 40 + nodeCount * 230, y: 160 }
    };
    setEditDef(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    setSelectedNodeId(newNode.id);
  };

  const selectedNode = editDef.nodes.find((n) => n.id === selectedNodeId) || null;
  const updateSelectedNodeConfig = (patch: Record<string, any>) => {
    if (!selectedNodeId) return;
    setEditDef((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => n.id === selectedNodeId ? { ...n, config: { ...(n.config || {}), ...patch } } : n),
    }));
  };

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    const nodes = editDef.nodes;
    const edges = editDef.edges;
    const nodeIds = new Set(nodes.map((n) => n.id));

    const triggerCount = nodes.filter((n) => n.type === 'trigger').length;
    if (triggerCount !== 1) issues.push(`Deve existir exatamente 1 gatilho (atual: ${triggerCount}).`);
    if (!nodes.some((n) => n.type === 'action')) issues.push('É obrigatório ter ao menos 1 ação.');

    for (const e of edges) {
      if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) issues.push(`Aresta inválida: ${e.id}.`);
      if (e.source === e.target) issues.push(`Nó ${e.source} não pode apontar para ele mesmo.`);
    }

    const outgoing = new Map<string, WFEdge[]>();
    const incoming = new Map<string, WFEdge[]>();
    for (const e of edges) {
      const list = outgoing.get(e.source) || [];
      list.push(e);
      outgoing.set(e.source, list);

      const inList = incoming.get(e.target) || [];
      inList.push(e);
      incoming.set(e.target, inList);
    }
    for (const n of nodes) {
      const out = outgoing.get(n.id) || [];
      const inEdges = incoming.get(n.id) || [];
      if (n.type === 'condition') {
        if (n.subtype === 'gateway_parallel') {
          if (inEdges.length !== 1) issues.push(`Gateway paralelo (split) ${n.id} precisa de 1 entrada.`);
          if (out.length < 2) issues.push(`Gateway paralelo ${n.id} precisa de ao menos 2 saídas.`);
        } else if (n.subtype === 'gateway_parallel_join') {
          if (inEdges.length < 2) issues.push(`Gateway convergente (join) ${n.id} precisa de ao menos 2 entradas.`);
          if (out.length !== 1) issues.push(`Gateway convergente (join) ${n.id} precisa de 1 saída.`);
        } else {
          if (out.length > 2) issues.push(`Condição ${n.id} tem mais de 2 saídas.`);
          if (out.length === 2) {
            const labels = new Set(out.map((e) => (e.label || '').toLowerCase()));
            if (!labels.has('true') || !labels.has('false')) issues.push(`Gateway decisório ${n.id} precisa de branches true/false.`);
          }
        }
      } else if (out.length > 1) {
        issues.push(`Nó ${n.id} deve ter no máximo 1 saída.`);
      }
    }

    const trigger = nodes.find((n) => n.type === 'trigger');
    if (trigger) {
      const reachable = new Set<string>();
      const q = [trigger.id];
      while (q.length) {
        const cur = q.shift() as string;
        if (reachable.has(cur)) continue;
        reachable.add(cur);
        for (const e of edges.filter((x) => x.source === cur)) q.push(e.target);
      }
      for (const n of nodes) {
        if (!reachable.has(n.id)) issues.push(`Nó órfão: ${getLabelForNode(n)} (${n.id}).`);
      }
    }

    const visit = new Set<string>();
    const stack = new Set<string>();
    const hasCycleFrom = (id: string): boolean => {
      if (stack.has(id)) return true;
      if (visit.has(id)) return false;
      visit.add(id);
      stack.add(id);
      for (const e of edges.filter((x) => x.source === id)) {
        if (hasCycleFrom(e.target)) return true;
      }
      stack.delete(id);
      return false;
    };
    for (const n of nodes) {
      if (hasCycleFrom(n.id)) {
        issues.push('Ciclo detectado no grafo. Remova loops.');
        break;
      }
    }

    return issues;
  }, [editDef]);

  const save = async () => {
    if (!selected) return;
    if (validationIssues.length > 0) {
      onToast('Workflow inválido. Corrija os problemas destacados antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: editName, definition: editDef };
      const isNew = selected.id === '__new__';
      const url = isNew ? '/api/workflows' : `/api/workflows/${selected.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (res.ok) {
        onToast(isNew ? 'Workflow criado!' : 'Workflow salvo!');
        await load();
      } else { onToast('Erro ao salvar.'); }
    } finally { setSaving(false); }
  };

  const rollback = async (version: number) => {
    if (!selected || selected.id === '__new__') return;
    const res = await fetch(`/api/workflows/${selected.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version }),
    });
    if (!res.ok) {
      onToast('Falha ao fazer rollback.');
      return;
    }
    onToast(`Workflow restaurado para versão ${version}.`);
    await load();
  };

  const applyOltTemplate = () => {
    const nodes: WFNode[] = [
      { id: 'n_start', type: 'trigger', subtype: 'start_implantacao', config: {}, position: { x: 60, y: 220 } },
      { id: 'n_olt', type: 'action', subtype: 'task_service', config: { taskName: 'Configurar OLT', team: 'NOC L2', autoCreateOs: true }, position: { x: 320, y: 220 } },
      { id: 'n_split', type: 'condition', subtype: 'gateway_parallel', config: {}, position: { x: 580, y: 220 } },
      { id: 'n_backup', type: 'action', subtype: 'task_service', config: { taskName: 'Cadastrar no Backup Center', team: 'Infraestrutura', autoCreateOs: true }, position: { x: 840, y: 120 } },
      { id: 'n_zabbix', type: 'action', subtype: 'task_service', config: { taskName: 'Cadastrar no Zabbix', team: 'Observabilidade', autoCreateOs: true }, position: { x: 840, y: 320 } },
      { id: 'n_join', type: 'condition', subtype: 'gateway_parallel_join', config: {}, position: { x: 1120, y: 220 } },
      { id: 'n_fluxo', type: 'action', subtype: 'task_service', config: { taskName: 'Cadastrar no fluxograma de rede', team: 'Arquitetura de Rede', autoCreateOs: true }, position: { x: 1340, y: 220 } },
      { id: 'n_apresentar', type: 'action', subtype: 'task_service', config: { taskName: 'Fazer apresentação para o cliente', team: 'Projeto', autoCreateOs: true }, position: { x: 1600, y: 220 } },
      { id: 'n_end', type: 'action', subtype: 'end_flow', config: {}, position: { x: 1860, y: 220 } },
    ];

    const edges: WFEdge[] = [
      { id: 'e1', source: 'n_start', target: 'n_olt' },
      { id: 'e2', source: 'n_olt', target: 'n_split' },
      { id: 'e3', source: 'n_split', target: 'n_backup' },
      { id: 'e4', source: 'n_split', target: 'n_zabbix' },
      { id: 'e5', source: 'n_backup', target: 'n_join' },
      { id: 'e6', source: 'n_zabbix', target: 'n_join' },
      { id: 'e7', source: 'n_join', target: 'n_fluxo' },
      { id: 'e8', source: 'n_fluxo', target: 'n_apresentar' },
      { id: 'e9', source: 'n_apresentar', target: 'n_end' },
    ];

    setEditName('Playbook Operacional - Implantação OLT');
    setEditDef({
      nodes,
      edges,
      governance: {
        ownerTeam: 'Operações',
        requiresApproval: true,
        changeTicketRequired: true,
        maxExecutionsPerHour: 30,
        stopOnFailure: true,
      },
    });
    setSelectedNodeId('n_olt');
    onToast('Template BPMN de implantação aplicado.');
  };

  const toggleRule = async (r: WorkflowRule) => {
    if (r.id === '__new__') return;
    const res = await fetch(`/api/workflows/${r.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !r.enabled })
    });
    if (res.ok) { onToast(`Workflow ${r.enabled ? 'desativado' : 'ativado'}`); load(); }
  };

  const deleteRule = async (r: WorkflowRule) => {
    if (r.id === '__new__') { setSelected(null); return; }
    if (!confirm(`Deletar "${r.name}"?`)) return;
    await fetch(`/api/workflows/${r.id}`, { method: 'DELETE' });
    onToast('Workflow deletado.'); if (selected?.id === r.id) setSelected(null); load();
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className={cn('text-2xl font-bold flex items-center gap-2', dark ? 'text-white' : 'text-slate-800')}>
            <Zap size={24} className="text-violet-400" />
            Construtor de Fluxos de Serviço
          </h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>
            Fluxos de O.S. (BPM/BPMN) · Workflow Engine de Playbooks Operacionais
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected && (
          <div className="flex items-center gap-3">
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className={cn('px-3 py-2 rounded-lg border text-sm font-semibold bg-transparent',
                dark ? 'border-slate-700 text-white' : 'border-slate-200 text-slate-800')}
              placeholder="Nome do workflow"
            />
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar
            </button>
          </div>
          )}
          <button
            onClick={applyOltTemplate}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            Template Implantação OLT
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* List */}
        <WorkflowList
          dark={dark} rules={rules} selected={selected}
          onSelect={selectRule} onNew={newRule}
          onToggle={toggleRule} onDelete={deleteRule} loading={loading}
        />

        {/* Canvas area */}
        {selected ? (
          <div className="flex gap-4 flex-1 min-w-0">
            {/* Palette */}
            <NodePalette dark={dark} onAdd={addNode} />
            {/* Canvas */}
            <div className="flex-1 min-w-0">
              <WorkflowCanvas
                dark={dark}
                definition={editDef}
                onChange={setEditDef}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
              />
              <div className="mt-3 space-y-3">
                <NodeConfigPanel dark={dark} node={selectedNode} onUpdate={updateSelectedNodeConfig} />
                <EdgeManager dark={dark} definition={editDef} onChange={setEditDef} />
                <GovernancePanel dark={dark} definition={editDef} onChange={setEditDef} />
                <div className={cn('rounded-xl border p-3', dark ? 'bg-slate-900/50 border-slate-700/60' : 'bg-white border-slate-200')}>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Versões / Rollback</p>
                  {versions.length === 0 ? (
                    <p className="text-xs text-slate-500">Sem versões ainda (salve alterações para criar histórico).</p>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-auto">
                      {[...versions].reverse().map((v) => (
                        <div key={v.version} className={cn('flex items-center justify-between px-2 py-1 rounded text-xs', dark ? 'bg-slate-800/70 text-slate-300' : 'bg-slate-50 text-slate-700')}>
                          <span>v{v.version} · {new Date(v.createdAt).toLocaleString('pt-BR')}</span>
                          <button onClick={() => rollback(v.version)} className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30">Rollback</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className={cn('rounded-xl border p-3', validationIssues.length ? 'border-rose-500/40 bg-rose-500/5' : (dark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50'))}>
                  <p className="text-[10px] uppercase tracking-widest font-bold mb-2 text-slate-400">Validação do Fluxo</p>
                  {validationIssues.length === 0 ? (
                    <p className="text-xs text-emerald-400">Sem inconsistências estruturais.</p>
                  ) : (
                    <ul className="text-xs text-rose-300 space-y-1">
                      {validationIssues.map((issue, idx) => <li key={idx}>• {issue}</li>)}
                    </ul>
                  )}
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-5 mt-3 px-2">
                {(['trigger', 'condition', 'action'] as const).map(t => (
                  <div key={t} className="flex items-center gap-1.5">
                    <div className={cn('w-3 h-3 rounded-sm', NODE_COLORS[t].badge)} />
                    <span className="text-[10px] text-slate-500 capitalize">
                      {t === 'trigger' ? 'Gatilho' : t === 'condition' ? 'Condição' : 'Ação'}
                    </span>
                  </div>
                ))}
                <span className="text-[10px] text-slate-600 ml-auto">
                  💡 Arraste nós, conecte pelas portas (saída azul → entrada verde), use Auto para layout por lanes
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className={cn('flex-1 rounded-xl border flex flex-col items-center justify-center text-center',
            dark ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200 bg-slate-50')}>
            <Zap size={48} className="text-violet-500/30 mb-4" />
            <p className={cn('text-lg font-bold', dark ? 'text-slate-400' : 'text-slate-500')}>
              Selecione ou crie um workflow
            </p>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">
              Automate fluxos de atendimento com lógica visual sem código
            </p>
            <button onClick={newRule}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition-colors">
              <Plus size={16} /> Novo Workflow
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
