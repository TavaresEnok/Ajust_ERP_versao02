'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useErp } from '@/lib/erp/gateway';
import { orderTypes, priorities, type RoleCode } from '@/lib/erp/contracts';
import type { FieldSpec } from '@/lib/erp/fields';
import { ConnectionNotice } from './contract-form';
import { DataReport } from './data-report';
import { ExportWorkspace } from './export-workspace';
import { OperationControl } from './operation-controls';
import { ResourcePage } from './resource-page';
import { PageHeading } from './primitives';
const managers: RoleCode[] = ['super_admin', 'gerente'];
const period: FieldSpec[] = [
  { name: 'periodStart', label: 'Início do período', type: 'date' },
  { name: 'periodEnd', label: 'Fim do período', type: 'date' },
];
export function FlowReport() {
  return (
    <DataReport
      title="Trilha de ordens e transições"
      flow
      path="/reports/service-order-flow"
      roles={[...managers, 'analista']}
      fields={[
        ...period,
        { name: 'priority', label: 'Prioridade', options: priorities },
        { name: 'type', label: 'Tipo', options: orderTypes },
        { name: 'provider', label: 'Provedor' },
        { name: 'analyst', label: 'Analista' },
        { name: 'sector', label: 'Setor' },
        {
          name: 'sla',
          label: 'SLA',
          options: { overdue: 'Em atraso', risk: 'Em risco · próximas 2h', ok: 'Dentro do prazo' },
        },
      ]}
      metrics={[{ key: 'totalOrders', label: 'Ordens no período' }]}
      charts={[
        {
          key: 'nodes',
          title: 'Distribuição por etapa',
          category: 'status',
          series: [
            { key: 'total', label: 'Ordens' },
            { key: 'overdue', label: 'Em atraso' },
          ],
        },
      ]}
      tables={[
        {
          key: 'nodes',
          title: 'Etapas',
          columns: [
            { key: 'status', label: 'Status' },
            { key: 'total', label: 'Ordens' },
            { key: 'overdue', label: 'Em atraso' },
            { key: 'avgAgeMinutes', label: 'Idade média (min)' },
          ],
        },
        {
          key: 'edges',
          title: 'Transições observadas',
          columns: [
            { key: 'from', label: 'De' },
            { key: 'to', label: 'Para' },
            { key: 'count', label: 'Transições' },
            { key: 'avgTransitionMinutes', label: 'Tempo médio (min)' },
          ],
        },
      ]}
    />
  );
}
export function HealthReport() {
  return (
    <DataReport
      title="Saúde operacional por provedor"
      path="/reports/operational-health"
      fields={period}
      charts={[
        {
          title: 'Volume de atendimento por provedor',
          category: 'name',
          series: [{ key: 'totalOrders', label: 'Ordens' }],
        },
      ]}
      tables={[
        {
          columns: [
            { key: 'name', label: 'Provedor' },
            { key: 'grade', label: 'Nota' },
            { key: 'totalOrders', label: 'Ordens' },
            { key: 'criticalRate', label: 'Críticas (%)' },
            { key: 'resolutionRate', label: 'Resolução (%)' },
            { key: 'hoursConsumed', label: 'Horas consumidas' },
          ],
        },
      ]}
    />
  );
}
export function ReportsWorkspace() {
  const { transport, scope } = useErp();
  const manager = !scope || managers.includes(scope.role);
  const customer = scope?.role === 'cliente';
  return (
    <>
      <PageHeading
        title="Relatórios do ERP"
        description="Indicadores, períodos, fluxo operacional, satisfação e exportações originais."
      />
      {!(transport && scope) && <ConnectionNotice />}
      <Tabs defaultValue="health" className="gap-5">
        <div className="overflow-x-auto">
          <TabsList variant="line">
            <TabsTrigger value="health">Saúde operacional</TabsTrigger>
            {manager && <TabsTrigger value="kpi">Desempenho</TabsTrigger>}
            {!customer && <TabsTrigger value="flow">Trilha e fluxo</TabsTrigger>}
            <TabsTrigger value="exports">Exportações</TabsTrigger>
            {manager && <TabsTrigger value="csat">Satisfação</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="health">
          <HealthReport />
        </TabsContent>
        <TabsContent value="kpi">
          <DataReport
            title="Indicadores gerenciais"
            path="/reports/manager-kpi"
            roles={managers}
            fields={[
              {
                name: 'daysBack',
                label: 'Últimos dias',
                type: 'number',
                integer: true,
                min: 1,
                max: 3650,
                defaultValue: 30,
              },
            ]}
            metrics={[
              { key: 'overview.totalOpen', label: 'Abertas' },
              { key: 'overview.totalClosed', label: 'Resolvidas + fechadas' },
              {
                key: 'overview.resolvedAwaitingClosure',
                label: 'Resolvidas aguardando fechamento',
              },
              { key: 'overview.slaBreaches', label: 'Vencidas em aberto' },
              { key: 'overview.closedLate', label: 'Fechadas fora do prazo' },
            ]}
            charts={[
              {
                key: 'performanceByAnalyst',
                title: 'Atendimento por analista',
                category: 'name',
                series: [
                  { key: 'open', label: 'Abertas' },
                  { key: 'closed', label: 'Encerradas' },
                  { key: 'slaBreaches', label: 'Violações' },
                ],
              },
            ]}
            tables={[
              {
                key: 'performanceByAnalyst',
                columns: [
                  { key: 'name', label: 'Analista' },
                  { key: 'open', label: 'Abertas' },
                  { key: 'closed', label: 'Encerradas' },
                  { key: 'slaBreaches', label: 'Violações' },
                  { key: 'tmrHours', label: 'Resolução média (h corridas)' },
                  { key: 'closedLate', label: 'Fora do prazo' },
                ],
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="flow">
          <FlowReport />
        </TabsContent>
        <TabsContent value="exports">
          <ExportWorkspace />
        </TabsContent>
        <TabsContent value="csat">
          <div className="flex flex-col gap-5">
            <DataReport
              title="Resumo de satisfação"
              path="/csat/summary"
              roles={managers}
              metrics={[
                { key: 'avg', label: 'Nota média' },
                { key: 'total', label: 'Respostas' },
              ]}
            />
            <ResourcePage
              moduleKey="csat"
              headingActions={
                <OperationControl
                  title="Emitir pesquisa para ordem"
                  description="O ERP verifica a ordem e reutiliza uma pesquisa já existente, evitando duplicação."
                  path="/csat/create-for-order"
                  roles={[...managers, 'analista']}
                  fields={[
                    { name: 'orderId', label: 'UUID da ordem', type: 'uuid', required: true },
                  ]}
                />
              }
            />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
