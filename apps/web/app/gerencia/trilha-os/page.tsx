'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  GitBranch,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Gauge,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OSStatus } from '@/types';

const STATUS_COLORS: Record<OSStatus, string> = {
  ABERTA: '#2563eb',
  EM_ANALISE: '#d97706',
  AG_CAMPO: '#ea580c',
  EM_EXECUCAO: '#4f46e5',
  AG_TERCEIROS: '#6b7280',
  RESOLVIDA: '#16a34a',
  FECHADA: '#374151',
  CANCELADA: '#dc2626',
};

const STATUS_LABELS: Record<OSStatus, string> = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em Análise',
  AG_CAMPO: 'Ag. Campo',
  EM_EXECUCAO: 'Em Execução',
  AG_TERCEIROS: 'Ag. Terceiros',
  RESOLVIDA: 'Resolvida',
  FECHADA: 'Fechada',
  CANCELADA: 'Cancelada',
};

interface FlowLink {
  from: OSStatus;
  to: OSStatus;
  count: number;
  avgTransitionMinutes?: number;
}

const FLOW_NODES_CONFIG: { status: OSStatus; x: number; y: number }[] = [
  { status: 'ABERTA', x: 40, y: 80 },
  { status: 'EM_ANALISE', x: 220, y: 80 },
  { status: 'AG_CAMPO', x: 220, y: 240 },
  { status: 'AG_TERCEIROS', x: 220, y: 360 },
  { status: 'EM_EXECUCAO', x: 420, y: 100 },
  { status: 'RESOLVIDA', x: 620, y: 100 },
  { status: 'FECHADA', x: 820, y: 140 },
  { status: 'CANCELADA', x: 620, y: 300 },
];

const NODE_WIDTH = 120;
const NODE_HEIGHT = 52;
const CANVAS_W = 1000;
const CANVAS_H = 460;

interface Bottleneck {
  status: OSStatus;
  stuck: number;
  avgTime: string;
  pct: number;
  avgMinutes: number;
}

interface FlowReportNode {
  status: string;
  total: number;
  overdue: number;
  avgAgeMinutes: number;
}

interface FlowReport {
  nodes: FlowReportNode[];
  edges: Array<{ from: string; to: string; count: number; avgTransitionMinutes: number }>;
  totalOrders: number;
}

function isKnownStatus(status: string): status is OSStatus {
  return status in STATUS_LABELS;
}

function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(Number(totalMinutes || 0)));
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`;
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export default function TrilhaOSPage() {
  const [flow, setFlow] = useState<FlowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadFlow = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/reports/service-order-flow', { cache: 'no-store' });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Falha ao carregar trilha de O.S.');
        }
        const payload = await response.json();
        if (active) {
          setFlow({
            nodes: Array.isArray(payload?.nodes) ? payload.nodes : [],
            edges: Array.isArray(payload?.edges) ? payload.edges : [],
            totalOrders: Number(payload?.totalOrders || 0),
          });
        }
      } catch (err) {
        if (active)
          setError(err instanceof Error ? err.message : 'Falha ao carregar trilha de O.S.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadFlow();
    return () => {
      active = false;
    };
  }, []);

  const reportNodes = useMemo(() => flow?.nodes ?? [], [flow]);
  const flowLinks = useMemo<FlowLink[]>(() => {
    return (flow?.edges ?? [])
      .filter((edge) => isKnownStatus(edge.from) && isKnownStatus(edge.to))
      .map((edge) => ({
        from: edge.from as OSStatus,
        to: edge.to as OSStatus,
        count: Number(edge.count || 0),
        avgTransitionMinutes: Number(edge.avgTransitionMinutes || 0),
      }));
  }, [flow]);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<OSStatus, number>> = {};
    for (const node of reportNodes) {
      if (isKnownStatus(node.status)) {
        counts[node.status] = Number(node.total || 0);
      }
    }
    return counts;
  }, [reportNodes]);

  const totalOrders = Number(flow?.totalOrders || 0);
  const closedCount = (statusCounts.FECHADA || 0) + (statusCounts.RESOLVIDA || 0);
  const cancelledCount = statusCounts.CANCELADA || 0;
  const fieldCount = statusCounts.AG_CAMPO || 0;
  const thirdPartyCount = statusCounts.AG_TERCEIROS || 0;
  const weightedAgeMinutes = useMemo(() => {
    const total = reportNodes.reduce((sum, node) => sum + Number(node.total || 0), 0);
    if (!total) return 0;
    const weighted = reportNodes.reduce(
      (sum, node) => sum + Number(node.avgAgeMinutes || 0) * Number(node.total || 0),
      0,
    );
    return Math.round(weighted / total);
  }, [reportNodes]);
  const bottlenecks = useMemo<Bottleneck[]>(() => {
    return reportNodes
      .filter((node) => isKnownStatus(node.status) && Number(node.total || 0) > 0)
      .map((node) => ({
        status: node.status as OSStatus,
        stuck: Number(node.total || 0),
        avgTime: formatMinutes(Number(node.avgAgeMinutes || 0)),
        avgMinutes: Number(node.avgAgeMinutes || 0),
        pct: pct(Number(node.total || 0), totalOrders),
      }))
      .sort((a, b) => b.stuck - a.stuck || b.avgMinutes - a.avgMinutes);
  }, [reportNodes, totalOrders]);
  const maxAvgMinutes = Math.max(1, ...bottlenecks.map((item) => item.avgMinutes));
  const topBottleneck = bottlenecks[0] || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary tracking-[-0.03em]">Trilha OS</h1>
        <p className="text-sm text-content-secondary mt-0.5">
          Fluxo e jornada das ordens de serviço
        </p>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-5 text-sm text-content-secondary">
          Carregando trilha real de O.S...
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-5 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && totalOrders === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-8 text-center">
          <GitBranch className="w-8 h-8 mx-auto text-content-tertiary mb-3" />
          <h2 className="text-sm font-semibold text-content-primary">Sem O.S. no pipeline</h2>
          <p className="text-sm text-content-secondary mt-1">
            A trilha será preenchida automaticamente quando houver ordens reais no período.
          </p>
        </div>
      )}

      {/* Flow Diagram Section */}
      {!loading && !error && totalOrders > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-content-secondary" />
            <h2 className="text-sm font-semibold text-content-primary">Diagrama de Fluxo</h2>
            <span className="text-2xs text-content-tertiary ml-2">
              {totalOrders} ordens no pipeline
            </span>
          </div>
          <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50/30">
            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                className="w-full max-w-[1000px] mx-auto"
                style={{ minWidth: '800px', height: 'auto' }}
              >
                <defs>
                  {flowLinks.map((link, i) => {
                    const fromNode = FLOW_NODES_CONFIG.find((n) => n.status === link.from)!;
                    const toNode = FLOW_NODES_CONFIG.find((n) => n.status === link.to)!;
                    return (
                      <linearGradient
                        key={`grad-${i}`}
                        id={`linkGrad-${i}`}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor={STATUS_COLORS[link.from]} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={STATUS_COLORS[link.to]} stopOpacity={0.6} />
                      </linearGradient>
                    );
                  })}
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
                  </filter>
                </defs>

                {/* Flow Links (curved arrows) */}
                {flowLinks.map((link, i) => {
                  const fromNode = FLOW_NODES_CONFIG.find((n) => n.status === link.from)!;
                  const toNode = FLOW_NODES_CONFIG.find((n) => n.status === link.to)!;
                  const x1 = fromNode.x + NODE_WIDTH;
                  const y1 = fromNode.y + NODE_HEIGHT / 2;
                  const x2 = toNode.x;
                  const y2 = toNode.y + NODE_HEIGHT / 2;
                  const dx = x2 - x1;
                  const cy = (y1 + y2) / 2;
                  const midX = x1 + dx * 0.5;
                  const strokeW = Math.max(1.5, link.count * 1.8);

                  const pathD =
                    Math.abs(y1 - y2) < 20
                      ? `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
                      : `M ${x1} ${y1} C ${x1 + dx * 0.3} ${y1}, ${x2 - dx * 0.3} ${y2}, ${x2} ${y2}`;

                  return (
                    <g key={`link-${i}`}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={`url(#linkGrad-${i})`}
                        strokeWidth={strokeW}
                        strokeLinecap="round"
                        opacity={0.5}
                      />
                      <path
                        d={pathD}
                        fill="none"
                        stroke={`url(#linkGrad-${i})`}
                        strokeWidth={strokeW}
                        strokeLinecap="round"
                        opacity={0.3}
                        className="hover:opacity-50 transition-opacity"
                      />
                      {/* Arrow head */}
                      <polygon
                        points={`${x2 - 2},${y2 - 5} ${x2 + 6},${y2} ${x2 - 2},${y2 + 5}`}
                        opacity={0.7}
                      >
                        <animate
                          attributeName="fill"
                          values={`${STATUS_COLORS[link.from]};${STATUS_COLORS[link.to]};${STATUS_COLORS[link.from]}`}
                          dur="3s"
                          repeatCount="indefinite"
                        />
                      </polygon>
                      {/* Count badge on link */}
                      <rect
                        x={midX - 12}
                        y={cy - 9}
                        width={24}
                        height={18}
                        rx={9}
                        fill="white"
                        stroke={`rgba(0,0,0,0.1)`}
                        strokeWidth={0.5}
                      />
                      <text
                        x={midX}
                        y={cy + 4}
                        textAnchor="middle"
                        className="text-[9px] font-bold"
                        fill={STATUS_COLORS[link.from]}
                      >
                        {link.count}
                      </text>
                    </g>
                  );
                })}

                {/* Flow Nodes */}
                {FLOW_NODES_CONFIG.map((node) => {
                  const color = STATUS_COLORS[node.status];
                  const count = statusCounts[node.status] || 0;
                  return (
                    <g key={node.status} filter="url(#shadow)">
                      <rect
                        x={node.x}
                        y={node.y}
                        width={NODE_WIDTH}
                        height={NODE_HEIGHT}
                        rx={10}
                        fill={color}
                        opacity={0.95}
                      />
                      {/* Inner glow */}
                      <rect
                        x={node.x + 3}
                        y={node.y + 3}
                        width={NODE_WIDTH - 6}
                        height={NODE_HEIGHT / 2 - 3}
                        rx={7}
                        fill="white"
                        opacity={0.1}
                      />
                      <text
                        x={node.x + NODE_WIDTH / 2}
                        y={node.y + 18}
                        textAnchor="middle"
                        className="text-[11px] font-semibold"
                        fill="white"
                      >
                        {STATUS_LABELS[node.status]}
                      </text>
                      <text
                        x={node.x + NODE_WIDTH / 2}
                        y={node.y + 38}
                        textAnchor="middle"
                        className="text-[13px] font-bold"
                        fill="white"
                      >
                        {count}
                      </text>
                    </g>
                  );
                })}

                {/* Legend */}
                <g transform="translate(40, 420)">
                  <text className="text-[10px] font-medium" fill="#6b7280">
                    ABERTA
                  </text>
                  <rect x="48" y="-6" width="6" height="6" rx="1" fill="#2563eb" />
                  <text x="60" y="4" className="text-[10px] font-medium" fill="#6b7280">
                    EM ANÁLISE
                  </text>
                  <rect x="125" y="-6" width="6" height="6" rx="1" fill="#d97706" />
                  <text x="137" y="4" className="text-[10px] font-medium" fill="#6b7280">
                    CAMPO
                  </text>
                  <rect x="175" y="-6" width="6" height="6" rx="1" fill="#ea580c" />
                  <text x="187" y="4" className="text-[10px] font-medium" fill="#6b7280">
                    EXECUÇÃO
                  </text>
                  <rect x="240" y="-6" width="6" height="6" rx="1" fill="#4f46e5" />
                  <text x="252" y="4" className="text-[10px] font-medium" fill="#6b7280">
                    RESOLVIDA
                  </text>
                  <rect x="312" y="-6" width="6" height="6" rx="1" fill="#16a34a" />
                  <text x="324" y="4" className="text-[10px] font-medium" fill="#6b7280">
                    FECHADA
                  </text>
                  <rect x="378" y="-6" width="6" height="6" rx="1" fill="#374151" />
                  <text x="390" y="4" className="text-[10px] font-medium" fill="#6b7280">
                    CANCELADA
                  </text>
                  <rect x="450" y="-6" width="6" height="6" rx="1" fill="#dc2626" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && totalOrders > 0 && (
        <>
          {/* Status Distribution Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(Object.entries(statusCounts) as [OSStatus, number][]).map(([status, count]) => (
              <div
                key={status}
                className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[status] }}
                  />
                  <span className="text-xs font-medium text-content-secondary">
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                <p className="text-2xl font-bold text-content-primary tabular-nums">{count}</p>
                <p className="text-2xs text-content-tertiary mt-0.5">
                  {((count / totalOrders) * 100).toFixed(1)}% do total
                </p>
              </div>
            ))}
          </div>

          {/* Status Breakdown - Transition Times */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)]">
              <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-2">
                <Clock className="w-4 h-4 text-content-secondary" />
                <h2 className="text-sm font-semibold text-content-primary">
                  Tempo Médio por Transição
                </h2>
              </div>
              <div className="p-5 space-y-3">
                {flowLinks.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-subtle hover:bg-bg-hover transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[t.from] }}
                      />
                      <span className="text-xs font-medium text-content-primary whitespace-nowrap">
                        {STATUS_LABELS[t.from]}
                      </span>
                      <ArrowRight className="w-3 h-3 text-content-tertiary flex-shrink-0" />
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[t.to] }}
                      />
                      <span className="text-xs font-medium text-content-primary whitespace-nowrap">
                        {STATUS_LABELS[t.to]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Clock className="w-3.5 h-3.5 text-content-tertiary" />
                      <span className="text-sm font-semibold text-content-primary tabular-nums">
                        {formatMinutes(t.avgTransitionMinutes || 0)}
                      </span>
                    </div>
                  </div>
                ))}
                {flowLinks.length === 0 && (
                  <div className="py-6 text-sm text-content-tertiary text-center">
                    Ainda não há eventos de transição suficientes.
                  </div>
                )}
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Gauge className="w-4 h-4 text-content-secondary" />
                  <h2 className="text-sm font-semibold text-content-primary">
                    Indicadores de Fluxo
                  </h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-content-secondary">Taxa de cancelamento</span>
                      <span className="text-sm font-semibold text-[#dc2626]">
                        {pct(cancelledCount, totalOrders).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-bg-subtle rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#dc2626] rounded-full"
                        style={{ width: `${pct(cancelledCount, totalOrders)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-content-secondary">Taxa de resolução</span>
                      <span className="text-sm font-semibold text-[#16a34a]">
                        {pct(closedCount, totalOrders).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-bg-subtle rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#16a34a] rounded-full"
                        style={{ width: `${pct(closedCount, totalOrders)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-content-secondary">
                        Chegada ao campo (via análise)
                      </span>
                      <span className="text-sm font-semibold text-[#ea580c]">
                        {pct(fieldCount, totalOrders).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-bg-subtle rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#ea580c] rounded-full"
                        style={{ width: `${pct(fieldCount, totalOrders)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-content-secondary">
                        Dependência de terceiros
                      </span>
                      <span className="text-sm font-semibold text-[#6b7280]">
                        {pct(thirdPartyCount, totalOrders).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-bg-subtle rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#6b7280] rounded-full"
                        style={{ width: `${pct(thirdPartyCount, totalOrders)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-content-secondary" />
                  <h2 className="text-sm font-semibold text-content-primary">Tempo Total Médio</h2>
                </div>
                <p className="text-3xl font-bold text-content-primary tabular-nums">
                  {formatMinutes(weightedAgeMinutes)}
                </p>
                <p className="text-xs text-content-secondary mt-1">
                  Idade média das O.S. no status atual
                </p>
              </div>
            </div>
          </div>

          {/* Bottlenecks Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)]">
              <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-content-secondary" />
                <h2 className="text-sm font-semibold text-content-primary">Gargalos</h2>
                <span className="text-2xs text-content-tertiary ml-2">
                  Status com mais ordens paradas
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[rgba(0,0,0,0.06)]">
                      <th className="px-5 py-3 text-left text-2xs font-semibold text-content-tertiary uppercase tracking-[0.05em]">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-2xs font-semibold text-content-tertiary uppercase tracking-[0.05em]">
                        Ordens Paradas
                      </th>
                      <th className="px-3 py-3 text-left text-2xs font-semibold text-content-tertiary uppercase tracking-[0.05em]">
                        Tempo Médio Parado
                      </th>
                      <th className="px-3 py-3 text-left text-2xs font-semibold text-content-tertiary uppercase tracking-[0.05em]">
                        % do Total
                      </th>
                      <th className="px-5 py-3 text-left text-2xs font-semibold text-content-tertiary uppercase tracking-[0.05em]">
                        Nível
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bottlenecks.map((b) => {
                      const isHigh = b.pct >= 25;
                      const isMedium = b.pct >= 18 && b.pct < 25;
                      return (
                        <tr
                          key={b.status}
                          className={cn(
                            'border-b border-[rgba(0,0,0,0.04)] hover:bg-bg-hover transition-colors',
                            isHigh && 'bg-red-50/50',
                          )}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: STATUS_COLORS[b.status] }}
                              />
                              <span className="text-sm font-medium text-content-primary">
                                {STATUS_LABELS[b.status]}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                'text-sm font-semibold tabular-nums',
                                isHigh ? 'text-[#dc2626]' : 'text-content-primary',
                              )}
                            >
                              {b.stuck}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                'text-sm tabular-nums',
                                isHigh ? 'text-[#dc2626] font-medium' : 'text-content-secondary',
                              )}
                            >
                              {b.avgTime}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                'text-sm font-semibold tabular-nums',
                                isHigh ? 'text-[#dc2626]' : 'text-content-primary',
                              )}
                            >
                              {b.pct}%
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 text-2xs font-medium rounded-full',
                                isHigh
                                  ? 'bg-red-100 text-[#dc2626]'
                                  : isMedium
                                    ? 'bg-amber-100 text-[#d97706]'
                                    : 'bg-green-100 text-[#16a34a]',
                              )}
                            >
                              {isHigh ? 'Alto' : isMedium ? 'Médio' : 'Baixo'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {bottlenecks.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-8 text-sm text-content-tertiary text-center"
                        >
                          Sem gargalos identificados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-content-secondary" />
                <h2 className="text-sm font-semibold text-content-primary">
                  Tempo Médio por Status
                </h2>
              </div>
              <div className="space-y-4">
                {bottlenecks.map((b) => {
                  const barPct = Math.round((b.avgMinutes / maxAvgMinutes) * 100);
                  const isHigh = b.pct >= 25;
                  return (
                    <div key={b.status}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: STATUS_COLORS[b.status] }}
                          />
                          <span className="text-xs text-content-secondary">
                            {STATUS_LABELS[b.status]}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'text-xs font-semibold tabular-nums',
                            isHigh ? 'text-[#dc2626]' : 'text-content-primary',
                          )}
                        >
                          {b.avgTime}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-bg-subtle rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            isHigh ? 'bg-[#dc2626]' : 'opacity-80',
                          )}
                          style={{
                            width: `${barPct}%`,
                            backgroundColor: isHigh ? '#dc2626' : STATUS_COLORS[b.status],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {bottlenecks.length === 0 && (
                  <div className="py-6 text-sm text-content-tertiary text-center">
                    Sem dados de tempo por status.
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-[rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-2 text-xs text-content-tertiary">
                  <XCircle className="w-3.5 h-3.5 text-[#dc2626]" />
                  <span>
                    {topBottleneck ? (
                      <>
                        <strong className="text-[#dc2626] font-semibold">
                          {STATUS_LABELS[topBottleneck.status]}
                        </strong>{' '}
                        é o maior gargalo com {topBottleneck.pct.toFixed(1)}% das ordens no status
                      </>
                    ) : (
                      'Sem gargalo dominante na trilha atual'
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
