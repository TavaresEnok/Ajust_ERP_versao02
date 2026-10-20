'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ResourcePage } from './resource-page';
import { DataReport } from './data-report';
import { ExportWorkspace } from './export-workspace';
export function AuditWorkspace() {
  return (
    <Tabs defaultValue="logs" className="gap-5">
      <TabsList variant="line">
        <TabsTrigger value="logs">Histórico</TabsTrigger>
        <TabsTrigger value="metrics">Métricas</TabsTrigger>
        <TabsTrigger value="export">Exportação</TabsTrigger>
      </TabsList>
      <TabsContent value="logs">
        <ResourcePage moduleKey="audit" />
      </TabsContent>
      <TabsContent value="metrics">
        <DataReport
          title="Atividade no período"
          path="/audit/metrics"
          roles={['super_admin', 'gerente']}
          fields={[
            { name: 'startDate', label: 'De', type: 'datetime-local' },
            { name: 'endDate', label: 'Até', type: 'datetime-local' },
          ]}
          metrics={[{ key: 'totalLogsCount', label: 'Eventos registrados' }]}
          tables={[
            {
              key: 'actionBreakdown',
              title: 'Por ação',
              columns: [
                { key: 'action', label: 'Ação' },
                { key: 'count', label: 'Quantidade' },
              ],
            },
            {
              key: 'topUsers',
              title: 'Autores',
              columns: [
                { key: 'userId', label: 'UUID do usuário' },
                { key: 'count', label: 'Eventos' },
              ],
            },
            {
              key: 'topResources',
              title: 'Recursos',
              columns: [
                { key: 'resourceType', label: 'Recurso' },
                { key: 'count', label: 'Eventos' },
              ],
            },
          ]}
        />
      </TabsContent>
      <TabsContent value="export">
        <ExportWorkspace audit />
      </TabsContent>
    </Tabs>
  );
}
