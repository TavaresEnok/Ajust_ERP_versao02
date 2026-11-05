'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { isDemonstration, type ManagementOverview } from '@/lib/erp/management';
const reportTabs = {
  overview: 'Visão gerencial',
  team: 'Performance da equipe',
  providers: 'Provedores',
  types: 'Tipos de serviço',
  flow: 'Trilha e fluxo',
  exports: 'Exportações',
  satisfaction: 'Satisfação',
};
const value = (data: unknown) => (data === undefined || data === null ? '—' : String(data));
export function ReportsPage() {
  const [now] = useState(() => Date.now());
  const params = useSearchParams();
  const base = useRouteBase();
  const { scope } = useErp();
  const [period, setPeriod] = useState('month');
  const manager = !scope || ['super_admin', 'gerente'].includes(scope.role);
  const requestedTab = reportTabs[params.get('tab') as keyof typeof reportTabs];
  const tab =
    requestedTab &&
    (manager || !['Visão gerencial', 'Performance da equipe', 'Satisfação'].includes(requestedTab))
      ? requestedTab
      : manager
        ? 'Visão gerencial'
        : 'Provedores';
  const setTab = (name: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('tab', Object.entries(reportTabs).find(([, label]) => label === name)![0]);
    window.history.replaceState(null, '', `${base}/relatorios?${next}`);
  };
  const daysBack = period === 'week' ? 7 : period === 'quarter' ? 90 : 30;
  const kpi = useErpQuery<ManagementOverview>(
    manager ? `/reports/management-overview?daysBack=${daysBack}` : null,
  );
  const health = useErpQuery<unknown>(`/reports/operational-health?daysBack=${daysBack}`);
  const tenants = useVisualSource('providers');
  const source = useVisualSource('orders');
  const report = kpi.error ? undefined : kpi.data;
  const overview = report
    ? {
        ...report.results,
        totalOpen: report.operation.totalOpen,
        totalClosed: report.results.closed,
        slaBreaches: report.operation.overdue,
      }
    : undefined;
  const performance = report?.team || [];
  const providers = listRecords(health.data);
  const filtered = source.raw.filter(
    (row) =>
      !isDemonstration(row) &&
      new Date(String(row.createdAt)).getTime() >=
        (report ? new Date(report.period.start).getTime() : now - daysBack * 86400000),
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
    else if (tab === 'Visão gerencial')
      exportCsv(
        'visao-gerencial',
        ['Indicador', 'Valor', 'Base'],
        [
          [
            'Pendentes atuais',
            value(overview?.totalOpen),
            'Todas as pendências, inclusive antigas',
          ],
          ['Atrasadas atuais', value(overview?.slaBreaches), 'Ativas com SLA e sem pausa'],
          [
            'Entregas no período',
            value(overview?.totalClosed),
            'Data efetiva de resolução ou fechamento',
          ],
          [
            'Tempo médio de resolução (h)',
            value(overview?.tmrHours),
            `${overview?.measuredClosed ?? 0} entregas válidas`,
          ],
          [
            'SLA (%)',
            value(overview?.slaPercentage),
            `${overview?.slaEvaluated ?? 0} entregas elegíveis`,
          ],
          ['Início', report?.period.start || '', 'Fortaleza'],
          ['Fim', report?.period.end || '', 'Fortaleza'],
        ],
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
        <Button
          disabled={
            tab === 'Visão gerencial' || tab === 'Performance da equipe'
              ? !report
              : tab === 'Tipos de serviço'
                ? !source.connected
                : !health.data || !['Provedores'].includes(tab)
          }
          onClick={exportCurrent}
        >
          <ArrowDownToLine data-icon="inline-start" />
          Exportar dados consultados
        </Button>
      </PageHeading>
      <p className="mb-5 text-xs leading-6 text-muted-foreground">
        Pendências e atrasos consideram toda a fila atual. Entregas usam a data efetiva de resolução
        ou fechamento no período, inclusive de ordens antigas. Demonstrações ficam fora dos
        indicadores. Resolução mede tempo decorrido, incluindo esperas; não representa horas
        trabalhadas.
      </p>
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
              label="Pendentes agora"
              value={value(overview?.totalOpen)}
              change="ERP"
              foot="todas as pendências, inclusive antigas"
              icon={ClipboardList}
            />
            <Metric
              label="Entregas no período"
              value={value(overview?.totalClosed)}
              change="ERP"
              foot="pela data efetiva de resolução ou fechamento"
              icon={CheckCircle2}
            />
            <Metric
              label="Tempo de resolução"
              value={overview?.tmrHours != null ? `${overview.tmrHours} h` : 'Sem base'}
              change="ERP"
              foot={`${overview?.measuredClosed ?? 0} conclusões com datas válidas`}
              icon={Timer}
            />
            <Metric
              label="Violações de SLA"
              value={value(overview?.slaBreaches)}
              change="ERP"
              foot="pendências atuais sem pausa"
              icon={ShieldCheck}
            />
          </div>
          <section className="panel mb-5">
            <PanelHeading
              title="Evolução do volume de atendimento"
              description="Entradas por criação e entregas por resolução ou fechamento, em dias de Fortaleza."
            />
            <div className="px-6 pb-5">
              <VolumeChart period={period} />
            </div>
          </section>
          <section className="panel">
            <PanelHeading
              title="Performance por provedor"
              description="Agrupamento pelo cliente da ocorrência. O período acompanha o filtro superior; a consulta personalizada abaixo é independente."
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
          <PanelHeading
            title="Distribuição e entregas da equipe"
            description="Ativas e atrasadas são da fila atual; entregas e resolução média pertencem ao período. O responsável é identificado pelo vínculo de usuário. Quantidade não mede esforço, complexidade ou jornada."
          />
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
                  <th>Pendentes atuais</th>
                  <th>Entregas no período</th>
                  <th>Atrasadas atuais</th>
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
                        {!row.userId && (
                          <span className="text-xs text-muted-foreground">
                            Sem vínculo com usuário
                          </span>
                        )}
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
              <th>Resolução (%)</th>
              <th>Horas consumidas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const tenant = tenants.find((tenant) => tenant.id === row.customerId);
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
