'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { orderStatuses } from '@/lib/erp/contracts';
import {
  flowStatuses,
  trackingSteps,
  type FlowInstance,
  type FlowOrder,
} from '@/lib/erp/operational-flow';
const Graph = dynamic(
  () => import('./operational-flow-graph').then((m) => m.OperationalFlowGraph),
  { ssr: false },
);
const labels = {
  ACTIVE: 'Etapa atual',
  COMPLETED: 'Concluída',
  WAITING: 'Aguardando',
  FAILED: 'Bloqueio ou falha',
  PENDING: 'Sem execução registrada',
  CANCELED: 'Cancelada',
};
const tones = {
  ACTIVE: 'border-info bg-info/10',
  COMPLETED: 'border-success bg-success/10',
  WAITING: 'border-warning bg-warning/10',
  FAILED: 'border-danger bg-danger/10',
  PENDING: 'border-border',
  CANCELED: 'border-border',
};

export function ImportedFlowSummary({
  instance,
  root,
  base,
}: {
  instance: FlowInstance;
  root?: FlowOrder;
  base: string;
}) {
  const superseded = instance.status === 'SUPERSEDED';
  const reviewed = instance.state.classificationReviewed === true;
  const sourceType = instance.state.originalSourceType || instance.definition.sourceTypes[0];
  const sourceStatus = root
    ? orderStatuses[root.status as keyof typeof orderStatuses] || root.status
    : 'Não informado';

  return (
    <div className="rounded-xl border-2 border-warning/50 bg-warning/5 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-warning">
        {superseded ? 'Versão anterior' : 'Sem execução do fluxo registrada'}
      </p>
      <h3 className="mt-2 text-lg font-semibold">
        {superseded
          ? 'Esta versão não mostra o acompanhamento atual.'
          : 'Ainda não há uma etapa atual para esta O.S.'}
      </h3>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        {superseded
          ? 'Esta execução foi substituída. Consulte a revisão atual para acompanhar o trabalho.'
          : 'Esta O.S. ainda não tem etapas registradas neste fluxo. O status informa a situação da ordem, mas não identifica sozinho o trabalho técnico atual.'}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Situação real da O.S.</p>
          <p className="mt-1 font-semibold">
            {root ? `${root.protocol} · ${sourceStatus}` : sourceStatus}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Classificação da demanda</p>
          <p className="mt-1 font-semibold">{sourceType || 'Não informado'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Fluxo no Ajust</p>
          <p className="mt-1 font-semibold">
            {reviewed ? instance.definition.name : 'Classificação pendente'}
          </p>
          {reviewed && <p className="mt-1 text-xs text-muted-foreground">Tipo revisado</p>}
        </div>
      </div>
      {instance.state.classificationBasis && (
        <p className="mt-3 text-xs text-muted-foreground">
          Revisão do tipo: {instance.state.classificationBasis}
        </p>
      )}
      {root && (
        <Link className="text-link mt-4 inline-block" href={`${base}/ordens/${root.id}`}>
          Consultar O.S. e histórico original →
        </Link>
      )}
      {superseded && instance.state.successorId && (
        <Link
          className="text-link ml-4 mt-4 inline-block"
          href={`${base}/processos/${instance.state.successorId}`}
        >
          Abrir acompanhamento atual →
        </Link>
      )}
    </div>
  );
}

export function ExecutionTracking({
  instance,
  base,
  userId,
}: {
  instance: FlowInstance;
  base: string;
  userId?: string;
}) {
  const [selected, setSelected] = useState('');
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const history = ['HISTORICAL', 'SUPERSEDED'].includes(instance.status);
  const steps = trackingSteps(instance);
  const links = instance.links || [];
  const orders = [
    ...new Map(
      [...links.map((l) => l.order), ...(instance.orders || [])].map((o) => [o.id, o]),
    ).values(),
  ];
  const root = orders.find((o) => o.id === instance.rootOrderId);
  const stateMap = Object.fromEntries(steps.map((s) => [s.nodeId, s.displayStatus]));
  const current = steps.filter((s) => ['ACTIVE', 'WAITING', 'FAILED'].includes(s.displayStatus));
  const annotations = Object.fromEntries(
    instance.definition.nodes.map((n) => {
      const s = steps.find((s) => s.nodeId === n.id);
      const order =
        orders.find((o) => o.id === s?.orderId) ||
        links.find((l) => l.orderKey === n.orderKey)?.order;
      return [
        n.id,
        order ? `${order.protocol} · ${order.analystName || 'Aguardando atribuição'}` : '',
      ];
    }),
  );
  const selectedNode = instance.definition.nodes.find((n) => n.id === selected);
  const selectedStep = steps.find((s) => s.nodeId === selected);
  const selectedOrder =
    orders.find((o) => o.id === selectedStep?.orderId) ||
    links.find((l) => l.orderKey === selectedNode?.orderKey)?.order;
  function nodeDetails(nodeId: string) {
    const node = instance.definition.nodes.find((n) => n.id === nodeId);
    const step = steps.find((s) => s.nodeId === nodeId);
    const order = orders.find((o) => o.id === step?.orderId);
    return (
      <article
        key={nodeId}
        className={`rounded-xl border-l-4 p-5 ${tones[step?.displayStatus || 'PENDING']}`}
      >
        <p className="text-xs font-semibold">
          {labels[step?.displayStatus || 'PENDING']}
          {order?.assigneeUserId === userId ? ' · Sua O.S.' : ''}
        </p>
        <h3 className="mt-2 font-semibold">{node?.name || nodeId}</h3>
        <p className="mt-2 text-sm">
          {order?.protocol || 'Dependência do fluxo'} ·{' '}
          {order?.analystName || 'Aguardando atribuição'} · {node?.sector}
        </p>
        {step?.dueAt && !order?.pausedAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            Prazo da O.S.:{' '}
            {new Date(step.dueAt).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })} ·{' '}
            {new Date(step.dueAt).getTime() < now ? 'Prazo ultrapassado' : 'Dentro do prazo'}
          </p>
        )}
        <p className="mt-3 text-sm">
          {step?.displayStatus === 'ACTIVE'
            ? 'Próxima ação: executar o trabalho e registrar o resultado na O.S.'
            : step?.displayStatus === 'FAILED'
              ? 'Próxima ação: solicitar ao coordenador a revisão do bloqueio.'
              : order?.pausedAt
                ? 'O.S. pausada. Consulte a justificativa e retome quando o impedimento for resolvido.'
                : 'Aguardando liberação ou conclusão das atividades anteriores.'}
        </p>
        {node?.kind === 'join' && (
          <p className="mt-2 text-xs">
            Aguarda:{' '}
            {node.waitFor
              .map((id) => instance.definition.nodes.find((n) => n.id === id)?.name || id)
              .join(', ')}
          </p>
        )}
        {order && (
          <Link className="text-link mt-4 inline-block" href={`${base}/ordens/${order.id}`}>
            Abrir O.S. →
          </Link>
        )}
      </article>
    );
  }
  const diagram = (
    <Graph
      definition={instance.definition}
      states={history ? undefined : stateMap}
      annotations={history ? undefined : annotations}
      active={steps.filter((s) => s.displayStatus === 'ACTIVE').map((s) => s.nodeId)}
      completed={steps.filter((s) => s.displayStatus === 'COMPLETED').map((s) => s.nodeId)}
      selected={selected}
      onSelect={setSelected}
    />
  );
  return (
    <section className="space-y-5" aria-label="Acompanhamento do atendimento">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{instance.occurrence.provider}</h2>
          <p className="mt-2 font-semibold">
            {history
              ? `O.S.: ${root?.protocol || '—'} · ${root?.title || instance.definition.name}`
              : `Fluxo: ${instance.definition.name}`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {history
              ? instance.status === 'HISTORICAL'
                ? 'Sem etapas registradas para esta execução'
                : 'Versão anterior · consulta'
              : flowStatuses[instance.status] || instance.status}
            {instance.state.mode === 'DEMO' ? ' · Demonstração simulada' : ''}
          </p>
        </div>
        <Link className="text-link" href={`${base}/ocorrencias/${instance.occurrence.id}/ordens`}>
          Abrir ocorrência →
        </Link>
      </div>
      {history ? (
        <ImportedFlowSummary instance={instance} root={root} base={base} />
      ) : (
        <>
          {instance.state.error && (
            <p role="alert" className="rounded-lg border border-danger bg-danger/10 p-4 text-sm">
              Bloqueio no atendimento: {instance.state.error}
            </p>
          )}
          {current.length > 0 && (
            <h3 className="text-base font-semibold">
              {current.some((s) => s.displayStatus === 'ACTIVE')
                ? `${current.filter((s) => s.displayStatus === 'ACTIVE').length > 1 ? 'Etapas atuais' : 'Etapa atual'} do atendimento`
                : 'Próxima etapa aguardando liberação'}
            </h3>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {current.map((s) => nodeDetails(s.nodeId))}
          </div>
          {!current.length && (
            <p className="rounded-lg border border-border p-4 text-sm">
              {instance.status === 'COMPLETED'
                ? 'Fluxo concluído. Consulte abaixo o trabalho de cada O.S.'
                : instance.status === 'CANCELED'
                  ? 'Fluxo cancelado. Consulte abaixo a situação de cada O.S.'
                  : 'Nenhuma etapa atual registrada. Consulte o coordenador para verificar este atendimento.'}
            </p>
          )}
        </>
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="data-table w-full">
          <thead>
            <tr>
              {['O.S.', 'Trabalho', 'Responsável', 'Situação'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link className="text-link" href={`${base}/ordens/${o.id}`}>
                    {o.protocol}
                  </Link>
                </td>
                <td>{o.title}</td>
                <td>{o.analystName || 'Aguardando atribuição'}</td>
                <td>{orderStatuses[o.status as keyof typeof orderStatuses] || o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {history ? (
        <details
          className="rounded-xl border border-border p-4"
          onToggle={(e) => setReferenceOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-medium">
            Ver desenho do fluxo de referência (não executado)
          </summary>
          <p className="my-4 text-sm text-muted-foreground">
            {instance.status === 'HISTORICAL'
              ? `Modelo de referência: ${instance.definition.name}. Este desenho não representa etapas registradas nesta execução.`
              : 'Modelo da versão anterior. Nenhuma etapa deste desenho está sendo apresentada como trabalho atual.'}
          </p>
          {referenceOpen && diagram}
        </details>
      ) : (
        <>
          <h3 className="text-sm font-semibold">Onde o atendimento está agora</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <span>🔵 Etapa atual</span>
            <span>🟢 Concluída</span>
            <span>🟠 Aguardando</span>
            <span>🔴 Bloqueio ou falha</span>
            <span>⚪ Sem execução registrada</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Clique em uma etapa para consultar a O.S. relacionada. Trabalhos paralelos podem estar
            em execução ao mesmo tempo.
          </p>
          {diagram}
        </>
      )}
      {selectedNode && (
        <div className="rounded-xl border border-border p-5" aria-live="polite">
          <h3 className="font-semibold">{selectedNode.name}</h3>
          <p className="mt-2 text-sm">
            {history
              ? 'Etapa do modelo de referência · posição histórica desconhecida'
              : labels[selectedStep?.displayStatus || 'PENDING']}{' '}
            · {selectedNode.sector}
          </p>
          {selectedOrder && (
            <>
              <p className="mt-2 text-sm">
                {selectedOrder.protocol} ·{' '}
                {orderStatuses[selectedOrder.status as keyof typeof orderStatuses] ||
                  selectedOrder.status}{' '}
                · {selectedOrder.analystName || 'Aguardando atribuição'}
              </p>
              <Link
                className="text-link mt-3 inline-block"
                href={`${base}/ordens/${selectedOrder.id}`}
              >
                Abrir O.S. →
              </Link>
            </>
          )}
        </div>
      )}
      {instance.steps.length > 0 && (
        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Etapas e resultados registrados ({instance.steps.length})
          </summary>
          <div className="mt-4 space-y-3">
            {instance.steps.map((s) => (
              <article key={s.id} className="rounded-lg border border-border p-4 text-sm">
                <p className="font-medium">
                  {instance.definition.nodes.find((n) => n.id === s.nodeId)?.name ||
                    'Etapa registrada'}{' '}
                  · {labels[s.status as keyof typeof labels] || s.status}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(s.enteredAt).toLocaleString('pt-BR')}
                  {s.outcome ? ` · Resultado: ${s.outcome}` : ''}
                </p>
                {Object.entries(s.evidence || {}).map(([name, value]) => (
                  <p key={name} className="mt-2 whitespace-pre-wrap break-words text-xs">
                    <strong>{name}:</strong> {String(value)}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
