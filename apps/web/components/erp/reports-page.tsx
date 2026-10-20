'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Timer, ShieldCheck, ArrowDownToLine, CheckCircle2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import { listRecords, useRouteBase, useVisualSource } from '@/lib/erp/visual-data';
import { type ErpRecord, orderTypes } from '@/lib/erp/contracts';
import { exportCsv } from '@/lib/demo-store';
import { PageHeading, PanelHeading, Metric, Avatar } from './primitives';
import { VolumeChart } from './dashboard-charts';
import { ReportChart } from './report-chart';
import { QueryState, ErpEmpty } from './contract-form';
import { ExportWorkspace } from './export-workspace';
import { FlowReport } from './reports-workspace';
import { DataReport } from './data-report';
import { OperationControl } from './operation-controls';
import { cn } from '@/lib/utils';
const value = (data: unknown) => (data === undefined || data === null ? '—' : String(data));
export function ReportsPage() {
  const base = useRouteBase();
  const { scope } = useErp();
  const [period, setPeriod] = useState('month');
  const [tab, setTab] = useState(
    !scope || ['super_admin', 'gerente'].includes(scope.role) ? 'Visão gerencial' : 'Provedores',
  );
  const manager = !scope || ['super_admin', 'gerente'].includes(scope.role);
  const daysBack = period === 'week' ? 7 : period === 'quarter' ? 90 : 30;
  const kpi = useErpQuery<{
    overview?: Record<string, unknown>;
    performanceByAnalyst?: ErpRecord[];
  }>(manager ? `/reports/manager-kpi?daysBack=${daysBack}` : null);
  const health = useErpQuery<unknown>('/reports/operational-health');
  const tenants = useVisualSource('providers');
  const source = useVisualSource('orders');
  const overview = kpi.data?.overview;
  const performance = kpi.data?.performanceByAnalyst || [];
  const providers = listRecords(health.data);
  const filtered = source.raw.filter(
    (row) => new Date(String(row.createdAt)).getTime() >= Date.now() - daysBack * 86400000,
  );
  const distribution = Object.entries(orderTypes)
    .map(([key, label]) => ({ label, count: filtered.filter((row) => row.type === key).length }))
    .filter((row) => row.count > 0);
  function exportCurrent() {
    if (tab === 'Tipos de serviço')
      exportCsv(
        'servicos-consultados',
        ['Tipo', 'Ordens'],
        distribution.map((row) => [row.label, row.count]),
      );
    else if (tab === 'Performance da equipe')
      exportCsv(
        'desempenho',
        ['Analista', 'Abertas', 'Concluídas', 'Violações SLA'],
        performance.map((row) => [
          value(row.name),
          value(row.open),
          value(row.closed),
          value(row.slaBreaches),
        ]),
      );
    else
      exportCsv(
        'saude-provedores',
        ['Provedor', 'Ordens', 'Resolução (%)', 'Horas consumidas'],
        providers.map((row) => [
          value(row.name),
          value(row.totalOrders),
          value(row.resolutionRate),
          value(row.hoursConsumed),
        ]),
      );
  }
  return (
    <>
      <PageHeading title="Relatórios" description="Menos suposições. Mais clareza para decidir.">
        <select
          className="native-select"
          aria-label="Período do relatório"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          <option value="month">Últimos 30 dias</option>
          <option value="week">Últimos 7 dias</option>
          <option value="quarter">Últimos 90 dias</option>
        </select>
        <Button disabled={!kpi.connected} onClick={exportCurrent}>
          <ArrowDownToLine data-icon="inline-start" />
          Exportar dados consultados
        </Button>
      </PageHeading>
      <div className="mb-6 flex gap-6 overflow-x-auto border-b border-border">
        {[
          ...(manager ? ['Visão gerencial', 'Performance da equipe'] : []),
          'Provedores',
          'Tipos de serviço',
          'Trilha e fluxo',
          'Exportações',
          ...(manager ? ['Satisfação'] : []),
        ].map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className={cn(
              'whitespace-nowrap border-b-2 pb-3 text-xs',
              name === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground',
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <QueryState
        loading={kpi.isLoading || health.isLoading}
        error={kpi.error || health.error}
        onRetry={() => {
          void kpi.mutate();
          void health.mutate();
        }}
      />
      {tab === 'Visão gerencial' ? (
        <>
          <div className="metrics-grid mb-5 grid grid-cols-4 gap-4">
            <Metric
              label="Abertas"
              value={value(overview?.totalOpen)}
              change="ERP"
              foot="no período consultado"
              icon={ClipboardList}
            />
            <Metric
              label="Concluídas"
              value={value(overview?.totalClosed)}
              change="ERP"
              foot="resolvidas e fechadas"
              icon={CheckCircle2}
            />
            <Metric
              label="Tempo de resolução"
              value={overview?.tmrHours !== undefined ? `${overview.tmrHours} h` : '—'}
              change="ERP"
              foot="média retornada pelo servidor"
              icon={Timer}
            />
            <Metric
              label="Violações de SLA"
              value={value(overview?.slaBreaches)}
              change="ERP"
              foot="no período consultado"
              icon={ShieldCheck}
            />
          </div>
          <section className="panel mb-5">
            <PanelHeading
              title="Evolução do volume de atendimento"
              description="Criação e situação atual das ordens consultadas; não substitui uma série histórica de encerramentos."
            />
            <div className="px-6 pb-5">
              <VolumeChart period={period} />
            </div>
          </section>
          <section className="panel">
            <PanelHeading
              title="Performance por provedor"
              description="Indicadores do relatório de saúde operacional. O período deste relatório usa os filtros de saúde abaixo."
            />
            <ProviderReport
              rows={providers}
              tenants={tenants.raw}
              base={base}
              connected={health.connected}
            />
          </section>
          <DataReport
            title="Filtrar saúde por período"
            path="/reports/operational-health"
            fields={[
              { name: 'periodStart', label: 'Início', type: 'date' },
              { name: 'periodEnd', label: 'Fim', type: 'date' },
            ]}
            tables={[
              {
                columns: [
                  { key: 'name', label: 'Provedor' },
                  { key: 'totalOrders', label: 'Ordens' },
                  { key: 'resolutionRate', label: 'Resolução (%)' },
                  { key: 'hoursConsumed', label: 'Horas consumidas' },
                ],
              },
            ]}
          />
        </>
      ) : tab === 'Provedores' ? (
        <section className="panel">
          <PanelHeading title="Performance por provedor" />
          <ProviderReport
            rows={providers}
            tenants={tenants.raw}
            base={base}
            connected={health.connected}
          />
        </section>
      ) : tab === 'Performance da equipe' ? (
        <section className="panel">
          <PanelHeading title="Desempenho dos integrantes" />
          <ReportChart
            data={performance}
            spec={{
              title: 'Atendimento por analista',
              category: 'name',
              series: [
                { key: 'open', label: 'Abertas' },
                { key: 'closed', label: 'Encerradas' },
                { key: 'slaBreaches', label: 'Violações SLA' },
              ],
            }}
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Integrante</th>
                  <th>Ativas</th>
                  <th>Concluídas</th>
                  <th>Violações SLA</th>
                  <th>Resolução média (h)</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((row, index) => (
                  <tr key={row.id || index}>
                    <td>
                      <span className="flex items-center gap-3">
                        <Avatar name={value(row.name)} />
                        {value(row.name)}
                      </span>
                    </td>
                    <td>{value(row.open)}</td>
                    <td>{value(row.closed)}</td>
                    <td>{value(row.slaBreaches)}</td>
                    <td>{value(row.tmrHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!performance.length && <ErpEmpty connected={kpi.connected} />}
        </section>
      ) : tab === 'Tipos de serviço' ? (
        <section className="panel p-6">
          <PanelHeading
            title="Distribuição por tipo de serviço"
            description="Baseada apenas nas ordens retornadas na consulta atual."
          />
          {distribution.map((row) => (
            <div key={row.label} className="mb-5 flex items-center gap-5">
              <span className="w-32 text-xs">{row.label}</span>
              <div className="progress-track flex-1">
                <span
                  style={{ width: `${filtered.length ? (row.count / filtered.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{row.count} ordens</span>
            </div>
          ))}
          {!distribution.length && <ErpEmpty connected={source.connected} />}
        </section>
      ) : tab === 'Trilha e fluxo' ? (
        <FlowReport />
      ) : tab === 'Exportações' ? (
        <ExportWorkspace />
      ) : (
        <>
          <DataReport
            title="Resumo de satisfação"
            path="/csat/summary"
            metrics={[
              { key: 'avg', label: 'Nota média' },
              { key: 'total', label: 'Respostas' },
            ]}
          />
          <section className="panel mt-5 p-6">
            <h2 className="section-title mb-5">Emitir pesquisa por ordem</h2>
            <OperationControl
              title="Preparar pesquisa"
              description="Solicitar uma pesquisa para a ordem selecionada."
              path="/csat/create-for-order"
              roles={['super_admin', 'gerente', 'analista']}
              fields={[{ name: 'orderId', label: 'Ordem', type: 'uuid', required: true }]}
            />
          </section>
        </>
      )}
    </>
  );
}
function ProviderReport({
  rows,
  tenants,
  base,
  connected,
}: {
  rows: ErpRecord[];
  tenants: ErpRecord[];
  base: string;
  connected: boolean;
}) {
  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Provedor</th>
              <th>Ordens</th>
              <th>Nota</th>
              <th>Resolução (%)</th>
              <th>Horas consumidas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const tenant = tenants.find(
                (tenant) => tenant.id === row.tenantId || tenant.id === row.id,
              );
              return (
                <tr key={row.id || index}>
                  <td>
                    {tenant ? (
                      <Link
                        href={`${base}/provedores/${encodeURIComponent(tenant.id)}`}
                        className="font-medium"
                      >
                        {value(row.name)}
                      </Link>
                    ) : (
                      value(row.name)
                    )}
                  </td>
                  <td>{value(row.totalOrders)}</td>
                  <td>{value(row.grade)}</td>
                  <td>{value(row.resolutionRate)}</td>
                  <td>{value(row.hoursConsumed)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && <ErpEmpty connected={connected} />}
    </>
  );
}
