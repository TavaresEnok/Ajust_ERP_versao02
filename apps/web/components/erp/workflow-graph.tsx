'use client';
import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type NodeChange,
  type Node,
  type Edge,
} from '@xyflow/react';
import { useAppTheme } from '@/components/theme-provider';
import { type WorkflowDefinition, type WorkflowNode } from '@/lib/erp/contracts';
import { workflowSubtypes } from '@/lib/erp/workflow';

function FitNodes({ count }: { count: number }) {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (initialized && count) void fitView({ padding: 0.25, maxZoom: 1 });
  }, [initialized, count, fitView]);
  return null;
}
export function WorkflowGraph({
  definition,
  onChange,
  onEdit,
}: {
  definition: WorkflowDefinition;
  onChange: (value: WorkflowDefinition) => void;
  onEdit: (node: WorkflowNode) => void;
}) {
  const { dark } = useAppTheme();
  const nodes: Node[] = useMemo(
    () =>
      definition.nodes.map((node) => ({
        id: node.id,
        position: node.position,
        type: node.type === 'trigger' ? 'input' : 'default',
        data: {
          label: `${node.type === 'trigger' ? 'Gatilho' : node.type === 'condition' ? 'Condição' : 'Ação'} · ${(workflowSubtypes[node.type] as Record<string, string>)[node.subtype] || node.subtype}`,
        },
        ariaLabel: `Configurar ${node.subtype}`,
      })),
    [definition.nodes],
  );
  const edges: Edge[] = useMemo(
    () =>
      definition.edges.map((edge) => ({
        ...edge,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [definition.edges],
  );
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const positions = changes.filter((change) => change.type === 'position' && change.position);
      if (!positions.length) return;
      onChange({
        ...definition,
        nodes: definition.nodes.map((node) => {
          const position = positions.find(
            (change) => change.type === 'position' && change.id === node.id,
          );
          return position?.type === 'position' && position.position
            ? { ...node, position: position.position }
            : node;
        }),
      });
    },
    [definition, onChange],
  );
  const onConnect = useCallback(
    (connection: Connection) => {
      if (
        connection.source === connection.target ||
        definition.edges.some(
          (edge) => edge.source === connection.source && edge.target === connection.target,
        )
      )
        return;
      const source = definition.nodes.find((node) => node.id === connection.source);
      const branches = definition.edges.filter((edge) => edge.source === source?.id);
      const label =
        source?.type === 'condition' &&
        !['gateway_parallel', 'gateway_parallel_join'].includes(source.subtype)
          ? branches.some((edge) => edge.label === 'true')
            ? 'false'
            : 'true'
          : source?.subtype === 'gateway_parallel_join'
            ? 'true'
            : undefined;
      onChange({
        ...definition,
        edges: [
          ...definition.edges,
          {
            id: crypto.randomUUID(),
            source: connection.source,
            target: connection.target,
            ...(label ? { label } : {}),
          },
        ],
      });
    },
    [definition, onChange],
  );
  const onNodeDoubleClick = useCallback(
    (_: unknown, node: Node) => {
      const selected = definition.nodes.find((item) => item.id === node.id);
      if (selected) onEdit(selected);
    },
    [definition.nodes, onEdit],
  );
  return (
    <div
      className="workflow-canvas mx-5 mb-5 h-80 min-w-0 overflow-hidden rounded-lg border border-border"
      aria-label="Grafo de automação"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        colorMode={dark ? 'dark' : 'light'}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={null}
        zoomOnScroll={false}
        preventScrolling={false}
        ariaLabelConfig={{
          'controls.zoomIn.ariaLabel': 'Aproximar grafo',
          'controls.zoomOut.ariaLabel': 'Afastar grafo',
          'controls.fitView.ariaLabel': 'Enquadrar nós',
          'controls.interactive.ariaLabel': 'Alternar interação',
          'node.a11yDescription.default':
            'Use as setas para mover o nó. Configure os parâmetros na lista abaixo.',
          'edge.a11yDescription.default':
            'Conexão entre os nós. Os rótulos são editados na lista de conexões.',
        }}
      >
        <FitNodes count={nodes.length} />
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
