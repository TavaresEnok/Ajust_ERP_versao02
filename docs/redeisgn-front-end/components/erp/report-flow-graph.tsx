"use client";
import { useMemo } from "react";
import { ReactFlow, Background, Controls, MarkerType, type Node, type Edge } from "@xyflow/react";
import { useAppTheme } from "@/components/theme-provider";
import { orderStatuses } from "@/lib/erp/contracts";

export function ReportFlowGraph({ data }: { data: unknown }) {
  const { dark } = useAppTheme();
  const graph = useMemo(() => {
    const payload = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const nodes: Node[] = rawNodes.flatMap((row: unknown, index: number) => {
      if (!row || typeof row !== "object") return [];
      const node = row as Record<string, unknown>;
      if (typeof node.status !== "string" || typeof node.total !== "number" || !Number.isFinite(node.total)) return [];
      const label = `${orderStatuses[node.status as keyof typeof orderStatuses] || node.status} · ${node.total} ordens${typeof node.overdue === "number" ? ` · ${node.overdue} em atraso` : ""}`;
      return [{ id: node.status, position: { x: index % 3 * 270, y: Math.floor(index / 3) * 170 }, data: { label } }];
    });
    const rawEdges = Array.isArray(payload.edges) ? payload.edges : [];
    const edges: Edge[] = rawEdges.flatMap((row: unknown, index: number) => {
      if (!row || typeof row !== "object") return [];
      const edge = row as Record<string, unknown>;
      if (typeof edge.from !== "string" || typeof edge.to !== "string" || typeof edge.count !== "number" || !nodes.some(node => node.id === edge.from) || !nodes.some(node => node.id === edge.to)) return [];
      return [{ id: String(index), source: edge.from, target: edge.to, label: `${edge.count} transições${typeof edge.avgTransitionMinutes === "number" ? ` · ${edge.avgTransitionMinutes} min` : ""}`, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }];
    });
    return { nodes, edges };
  }, [data]);
  if (!graph.nodes.length) return <p className="px-6 pb-5 text-xs text-muted-foreground">Sem etapas retornadas para o mapa de transições.</p>;
  return <figure className="px-6 pb-6"><figcaption className="section-title mb-3">Mapa das transições observadas</figcaption><div className="workflow-canvas h-80 overflow-hidden rounded-lg border border-border" aria-label="Fluxo observado de ordens"><ReactFlow nodes={graph.nodes} edges={graph.edges} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} colorMode={dark ? "dark" : "light"} fitView fitViewOptions={{ padding: 0.3, maxZoom: 1 }} zoomOnScroll={false} preventScrolling={false} ariaLabelConfig={{ "controls.zoomIn.ariaLabel": "Aproximar fluxo", "controls.zoomOut.ariaLabel": "Afastar fluxo", "controls.fitView.ariaLabel": "Enquadrar fluxo" }}><Background /><Controls showInteractive={false} /></ReactFlow></div><p className="mt-3 text-[10px] text-muted-foreground">Somente conexões retornadas pelo relatório, não regras de transição permitida. Contagens e tempos permanecem disponíveis nas tabelas.</p></figure>;
}
