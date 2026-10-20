'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  Timer,
  ShieldCheck,
  AlertTriangle,
  Clock3,
  Activity,
  CheckCircle2,
  HeartPulse,
  Radio,
  ChevronRight,
} from 'lucide-react';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import { useVisualSource, useRouteBase } from '@/lib/erp/visual-data';
import { PageHeading, PanelHeading, Metric, StatusBadge, Priority } from './primitives';
import { VolumeChart } from './dashboard-charts';
import { QueryState, ErpEmpty } from './contract-form';
import { HealthReport } from './reports-workspace';
import { DataReport } from './data-report';
export function SlaPage() {
  const base = useRouteBase();
  const query = useVisualSource('orders');
  const [filter, setFilter] = useState('Todas');
  const now = Date.now();
  const active = query.rows
    .filter((row) => !['Resolvida', 'Fechada', 'Cancelada'].includes(String(row.status)))
    .map((row) => {
      const raw = query.raw.find((item) => item.id === row.id);
      const remaining = raw?.deadlineAt
        ? new Date(String(raw.deadlineAt)).getTime() - now
        : undefined;
      return {
        row,
        raw,
        remaining,
        label:
          remaining === undefined
            ? 'Sem prazo'
            : remaining < 0
              ? 'Prazo excedido'
              : remaining <= 7200000
                ? 'Em risco'
                : 'Dentro do prazo',
      };
    })
    .sort((a, b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity));
  return (
    <>
      <PageHeading
        title="Monitor de SLA"
        description="Antecipe os riscos. Entregue dentro do combinado."
      >
        <Link href={`${base}/calendario-sla`} className="text-link">
          Calendário, regras e simulação
        </Link>
        <select
          className="native-select"
          aria-label="Filtrar risco SLA"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          {['Todas', 'Em risco', 'Dentro do prazo', 'Prazo excedido', 'Sem prazo'].map((label) => (
            <option key={label}>{label}</option>
          ))}
        </select>
      </PageHeading>
      <div className="metrics-grid mb-6 grid grid-cols-4 gap-4">
        <Metric
          label="Ordens acompanhadas"
          value={query.connected ? String(active.length) : '—'}
          change="Consulta atual"
          foot="ordens ativas retornadas"
          icon={ShieldCheck}
        />
        <Metric
          label="Dentro do prazo"
          value={
            query.connected
              ? String(active.filter((item) => item.label === 'Dentro do prazo').length)
              : '—'
          }
          change="Consulta atual"
          foot="com prazo maior que duas horas"
          icon={CheckCircle2}
        />
        <Metric
          label="Próximas do prazo"
          value={
            query.connected
              ? String(active.filter((item) => item.label === 'Em risco').length)
              : '—'
          }
          change="Atenção"
          foot="nas próximas duas horas"
          icon={Clock3}
          warning
        />
        <Metric
          label="Prazo excedido"
          value={
            query.connected
              ? String(active.filter((item) => item.label === 'Prazo excedido').length)
              : '—'
          }
          change="Consulta atual"
          foot="prazo retornado pelo ERP"
          icon={AlertTriangle}
        />
      </div>
      <section className="panel">
        <PanelHeading
          title="Atendimentos em acompanhamento"
          description="Ordenados pelo prazo retornado; o cálculo oficial permanece no motor de SLA."
        />
        <QueryState
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.mutate()}
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ordem de serviço</th>
                <th>Provedor</th>
                <th>Prioridade</th>
                <th>Consumo do SLA</th>
                <th>Prazo</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {active
                .filter((item) => filter === 'Todas' || item.label === filter)
                .map(({ row, raw, label }) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        className="font-medium"
                        href={`${base}/ordens/${encodeURIComponent(row.id)}/sla`}
                      >
                        <span className="mb-1 block text-[9px] text-muted-foreground">
                          {String(row.protocol)}
                        </span>
                        {String(row.title)}
                      </Link>
                    </td>
                    <td>{String(row.provider)}</td>
                    <td>
                      <Priority value={String(row.priority)} />
                    </td>
                    <td>
                      {typeof raw?.slaUsagePercent === 'number' ? (
                        <div className="flex items-center gap-2">
                          <div className="progress-track w-24">
                            <span
                              style={{
                                width: `${Math.max(0, Math.min(100, raw.slaUsagePercent))}%`,
                              }}
                            />
                          </div>
                          <span className="text-[9px]">{raw.slaUsagePercent}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não informado</span>
                      )}
                    </td>
                    <td className="text-muted-foreground">{String(row.deadline)}</td>
                    <td>
                      <StatusBadge status={label} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!active.length && !query.isLoading && !query.error && (
          <ErpEmpty connected={query.connected} />
        )}
      </section>
      <div className="mt-5">
        <DataReport
          title="Violações registradas pelo motor"
          path="/sla/breaches"
          fields={[
            { name: 'from', label: 'De', type: 'datetime-local' },
            { name: 'to', label: 'Até', type: 'datetime-local' },
          ]}
          tables={[
            {
              columns: [
                { key: 'orderId', label: 'Ordem' },
                { key: 'createdAt', label: 'Registro' },
                { key: 'reason', label: 'Motivo' },
              ],
            },
          ]}
        />
      </div>
    </>
  );
}
export function HealthPage() {
  const base = useRouteBase();
  const { scope } = useErp();
  const manager = !scope || ['super_admin', 'gerente'].includes(scope.role);
  const query = useErpQuery<{
    services?: { database?: { ok?: boolean }; redis?: { ok?: boolean } };
    stats?: { activeSessions?: number };
    score?: number;
  }>(manager ? '/reports/health-summary' : null);
  const csat = useErpQuery<{ avg?: number; total?: number }>(manager ? '/csat/summary' : null);
  const available = query.data?.services?.database?.ok;
  return (
    <>
      <PageHeading
        title="Saúde operacional"
        description="Uma visão clara para uma operação cada vez mais saudável."
      >
        <StatusBadge
          status={
            available === undefined
              ? 'Sem diagnóstico'
              : available
                ? 'Serviços disponíveis'
                : 'Atenção'
          }
        />
      </PageHeading>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="mb-6 flex flex-wrap items-center gap-6 rounded-xl border border-primary/15 bg-secondary/60 p-7">
        <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-full border-4 border-primary/70">
          <strong className="text-2xl font-semibold text-primary">
            {query.data?.score ?? '—'}
          </strong>
          <span className="text-[9px] text-primary">de 100</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Acompanhe o ritmo da sua operação.
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
            Diagnóstico e indicadores são exibidos conforme retornados pelo ERP. Nota consolidada e
            disponibilidade percentual só aparecem quando fornecidas pelo contrato.
          </p>
        </div>
      </div>
      <div className="metrics-grid mb-6 grid grid-cols-4 gap-4">
        <Metric
          label="Banco de dados"
          value={available === undefined ? '—' : available ? 'Disponível' : 'Indisponível'}
          change="Diagnóstico"
          foot="verificação do backend"
          icon={Activity}
        />
        <Metric
          label="Cache Redis"
          value={
            query.data?.services?.redis?.ok === undefined
              ? '—'
              : query.data.services.redis.ok
                ? 'Disponível'
                : 'Indisponível'
          }
          change="Diagnóstico"
          foot="verificação do backend"
          icon={Timer}
        />
        <Metric
          label="Satisfação CSAT"
          value={csat.data?.avg !== undefined ? `${csat.data.avg}/5` : '—'}
          change={csat.data?.total !== undefined ? `${csat.data.total} respostas` : 'Pesquisas'}
          foot="avaliações retornadas"
          icon={HeartPulse}
        />
        <Metric
          label="Sessões ativas"
          value={String(query.data?.stats?.activeSessions ?? '—')}
          change="Acessos"
          foot="na consulta de saúde"
          icon={CheckCircle2}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel">
          <PanelHeading
            title="Evolução da operação"
            description="Volume por criação das ordens consultadas"
          />
          <div className="px-5 pb-5">
            <VolumeChart />
          </div>
        </section>
        <section className="panel">
          <PanelHeading
            title="Pontos de atenção"
            description="Áreas de acompanhamento da operação"
          />
          <div className="flex flex-col gap-5 px-5 pb-5">
            {[
              {
                title: 'Acompanhar prazos de SLA',
                text: 'Consulte ordens em risco e violações registradas.',
                path: `${base}/sla`,
                icon: Timer,
              },
              {
                title: 'Distribuição de carga da equipe',
                text: 'Revise responsáveis e atendimentos ativos.',
                path: `${base}/tecnicos`,
                icon: Activity,
              },
              {
                title: 'Cobertura do plantão NOC',
                text: 'Confira os períodos de cobertura da equipe.',
                path: `${base}/plantao`,
                icon: Radio,
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.path}
                className="flex gap-3 rounded-lg border border-border p-4"
              >
                <item.icon className="mt-1 size-4 shrink-0 text-warning" />
                <div>
                  <h3 className="text-xs font-medium">{item.title}</h3>
                  <p className="mt-2 text-[10px] text-muted-foreground">{item.text}</p>
                </div>
                <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="mt-5">
        <HealthReport />
      </div>
    </>
  );
}
