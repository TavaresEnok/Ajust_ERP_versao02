'use client';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ContractForm } from './contract-form';
import { CalendarBoard } from './calendar-board';
import { ResourcePage } from './resource-page';
import { DataReport, ReportTable } from './data-report';
import { useErp, useErpAction } from '@/lib/erp/gateway';
import { PanelHeading } from './primitives';
import type { CalendarConflict } from '@/lib/erp/contracts';
export function ScheduleWorkspace({
  onCall = false,
  initialTab = 'calendar',
}: {
  onCall?: boolean;
  initialTab?: string;
}) {
  const action = useErpAction();
  const { scope } = useErp();
  const manager = !scope || ['super_admin', 'gerente'].includes(scope.role);
  const [conflicts, setConflicts] = useState<CalendarConflict | null>(null);
  if (onCall)
    return (
      <div className="flex flex-col gap-5">
        <ResourcePage moduleKey="onCall" />
        <DataReport
          title="Cobertura atual do NOC"
          path="/on-call/current"
          metrics={[
            { key: 'user.name', label: 'Plantonista' },
            { key: 'startsAt', label: 'Início' },
            { key: 'endsAt', label: 'Fim' },
          ]}
        />
      </div>
    );
  return (
    <Tabs defaultValue={initialTab} className="min-w-0 gap-5">
      <div className="overflow-x-auto">
        <TabsList variant="line">
          <TabsTrigger value="calendar">Calendário</TabsTrigger>
          <TabsTrigger value="events">Meus compromissos</TabsTrigger>
          {manager && <TabsTrigger value="team">Agenda da equipe</TabsTrigger>}
          <TabsTrigger value="conflicts">Verificar conflitos</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="calendar">
        <CalendarBoard />
      </TabsContent>
      <TabsContent value="events">
        <ResourcePage moduleKey="calendar" />
      </TabsContent>
      <TabsContent value="team">
        <DataReport
          title="Compromissos de toda a empresa"
          path="/calendar/events/all"
          roles={['super_admin', 'gerente']}
          fields={[
            { name: 'from', label: 'De', type: 'datetime-local' },
            { name: 'to', label: 'Até', type: 'datetime-local' },
            { name: 'assigneeId', label: 'UUID do responsável', type: 'uuid' },
          ]}
          tables={[
            {
              columns: [
                { key: 'title', label: 'Compromisso' },
                { key: 'startAt', label: 'Início' },
                { key: 'endAt', label: 'Fim' },
                { key: 'assignee.name', label: 'Responsável' },
                { key: 'location', label: 'Local' },
              ],
            },
          ]}
        />
        <div className="mt-5">
          <DataReport
            title="Usuários disponíveis para atribuição"
            path="/calendar/users"
            tables={[
              {
                columns: [
                  { key: 'id', label: 'UUID' },
                  { key: 'name', label: 'Nome' },
                  { key: 'email', label: 'E-mail' },
                ],
              },
            ]}
          />
        </div>
      </TabsContent>
      <TabsContent value="conflicts">
        <section className="panel">
          <PanelHeading
            title="Conferir disponibilidade"
            description="Consulta explícita ao backend antes de agendar. Nenhum conflito é simulado."
          />
          <div className="px-6 pb-6">
            <ContractForm
              fields={[
                { name: 'userId', label: 'UUID do responsável', type: 'uuid', required: true },
                { name: 'startAt', label: 'Início', type: 'datetime-local', required: true },
                { name: 'endAt', label: 'Fim', type: 'datetime-local', required: true },
                { name: 'excludeEventId', label: 'Ignorar este evento (UUID)', type: 'uuid' },
              ]}
              connected={action.connected}
              pending={action.pending}
              label="Verificar no ERP"
              onSubmit={async (values) => {
                setConflicts(null);
                setConflicts(
                  await action.execute({
                    path: '/calendar/events/check-conflict',
                    method: 'POST',
                    body: values,
                  }),
                );
              }}
            />
          </div>
          {conflicts && (
            <div className="p-6">
              <p role="status" className="mb-5 text-xs">
                {conflicts.hasConflict
                  ? 'O ERP identificou conflito de horário.'
                  : 'O ERP não identificou conflito de horário.'}
              </p>
              {Array.isArray(conflicts.conflictingEvents) && (
                <ReportTable
                  data={conflicts.conflictingEvents}
                  columns={[
                    { key: 'title', label: 'Compromisso' },
                    { key: 'startAt', label: 'Início' },
                    { key: 'endAt', label: 'Fim' },
                  ]}
                />
              )}
            </div>
          )}
        </section>
      </TabsContent>
    </Tabs>
  );
}
