'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useErp, useErpQuery, useErpAction } from '@/lib/erp/gateway';
import {
  priorities,
  orderTypes,
  queryPath,
  type ErpRecord,
  errorMessage,
} from '@/lib/erp/contracts';
import type { FieldSpec } from '@/lib/erp/fields';
import { ContractForm, ConnectionNotice, ErpEmpty, QueryState } from './contract-form';
import { PageHeading, PanelHeading, StatusBadge } from './primitives';
import { displayValue } from './resource-page';
import { DataReport } from './data-report';
const days = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
type CalendarDay = { isWorkDay: boolean; startTime: string; endTime: string };
type CalendarException = {
  id: string;
  date: string;
  isWorkDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
};
/** Data da exceção (dia de calendário, sem fuso) no formato brasileiro. */
const exceptionDate = (value: string) => {
  const [year, month, dayOfMonth] = value.slice(0, 10).split('-');
  return year && month && dayOfMonth ? `${dayOfMonth}/${month}/${year}` : value;
};
export function SlaWorkspace({ initialTab = 'Monitoramento' }: { initialTab?: string }) {
  const { scope } = useErp();
  const manager = !scope || ['super_admin', 'gerente'].includes(scope.role);
  const policies = useErpQuery<ErpRecord[]>(manager ? '/sla-policies' : null);
  const calendar = useErpQuery<Record<string, CalendarDay>>('/sla/calendar');
  const exceptions = useErpQuery<CalendarException[]>('/sla/calendar/exceptions');
  const action = useErpAction();
  const [dialog, setDialog] = useState<'policy' | 'base' | 'day' | 'exception' | null>(null);
  const [editing, setEditing] = useState<ErpRecord | null>(null);
  const [day, setDay] = useState(1);
  const [simulation, setSimulation] = useState<{
    policy: { hours: number; priority: string };
    targetDate: string;
    startDate: string;
  } | null>(null);
  const [validated, setValidated] = useState('');
  const [removePath, setRemovePath] = useState<string | null>(null);
  const [removeLabel, setRemoveLabel] = useState('');
  const policyFields: FieldSpec[] = [
    ...(!editing && dialog === 'base'
      ? [{ name: 'priority', label: 'Prioridade', options: priorities, required: true }]
      : !editing
        ? [
            {
              name: 'serviceOrderType',
              label: 'Tipo de serviço',
              options: orderTypes,
              required: true,
            },
          ]
        : []),
    {
      name: 'hours',
      label: 'Prazo de resolução em horas',
      type: 'number',
      required: true,
      min: 1,
      max: 8760,
    },
    { name: 'active', label: 'Política ativa', type: 'checkbox', defaultValue: true },
  ];
  return (
    <>
      <PageHeading
        title="Calendário e regras de SLA"
        description="Defina os prazos por tipo de serviço, ajuste os dias de atendimento e confira o cálculo antes de usar."
      >
        <Link className="text-link" href="/gerencia/sla">
          Acompanhar prazos da equipe →
        </Link>
      </PageHeading>
      {!calendar.connected && <ConnectionNotice />}
      <Tabs defaultValue={initialTab} className="gap-5">
        <div className="overflow-x-auto">
          <TabsList variant="line">
            {['Monitoramento', 'Políticas', 'Calendário comercial', 'Exceções', 'Simulação'].map(
              (tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {tab}
                </TabsTrigger>
              ),
            )}
          </TabsList>
        </div>
        <TabsContent value="Monitoramento">
          <DataReport
            title="Violações atuais de SLA"
            path="/sla/breaches"
            tables={[
              {
                columns: [
                  { key: 'protocol', label: 'Protocolo' },
                  { key: 'title', label: 'Ordem' },
                  { key: 'priority', label: 'Prioridade' },
                  { key: 'status', label: 'Status' },
                  { key: 'deadlineAt', label: 'Prazo' },
                ],
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="Políticas">
          <section className="panel">
            <PanelHeading
              title="Prazos por prioridade e por tipo de serviço"
              description="A regra base define o prazo de cada prioridade; a exceção por tipo vale para todas as prioridades daquele tipo. A mudança aplica-se ao cálculo de novas O.S.; prazos já registrados não mudam automaticamente. Sem política, o padrão é 48 horas úteis."
            >
              {manager && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(null);
                      setValidated('');
                      setDialog('base');
                    }}
                  >
                    <Plus data-icon="inline-start" />
                    Regra por prioridade
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setValidated('');
                      setDialog('policy');
                    }}
                  >
                    <Plus data-icon="inline-start" />
                    Exceção por tipo
                  </Button>
                </div>
              )}
            </PanelHeading>
            <QueryState
              loading={policies.isLoading}
              error={policies.error}
              onRetry={() => void policies.mutate()}
            />
            {policies.data?.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Aplicação</th>
                      <th>Prazo</th>
                      <th>Situação</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.data.map((policy) => (
                      <tr key={policy.id}>
                        <td>
                          {policy.isOverride
                            ? orderTypes[policy.serviceOrderType as keyof typeof orderTypes]
                            : `Regra base · prioridade ${priorities[policy.priority as keyof typeof priorities] || policy.priority}`}
                        </td>
                        <td>{displayValue(policy.hours)}h</td>
                        <td>
                          <StatusBadge status={policy.active ? 'Ativa' : 'Inativa'} />
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditing(policy);
                              setDialog('policy');
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setRemoveLabel('');
                              setRemovePath(`/sla-policies/${policy.id}`);
                            }}
                          >
                            Remover
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !policies.isLoading && !policies.error && <ErpEmpty connected={policies.connected} />
            )}
          </section>
        </TabsContent>
        <TabsContent value="Calendário comercial">
          <section className="panel">
            <PanelHeading
              title="Semana de atendimento"
              description="Horários aplicados no fuso da empresa, informado no cadastro do tenant."
            />
            <QueryState
              loading={calendar.isLoading}
              error={calendar.error}
              onRetry={() => void calendar.mutate()}
            />
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th>Expediente</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((name, index) => {
                    const value = calendar.data?.[index];
                    return (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>
                          {value
                            ? value.isWorkDay
                              ? 'Dia útil'
                              : 'Sem expediente'
                            : 'Não carregado'}
                        </td>
                        <td>{value?.startTime || '—'}</td>
                        <td>{value?.endTime || '—'}</td>
                        <td>
                          {manager && (
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  setDay(index);
                                  setDialog('day');
                                }}
                              >
                                Configurar
                              </Button>
                              <Button
                                variant="ghost"
                                disabled={!calendar.connected}
                                onClick={() => {
                                  setRemoveLabel('');
                                  setRemovePath(`/sla/calendar/${index}`);
                                }}
                              >
                                Restaurar padrão
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="Exceções">
          <section className="panel p-6">
            <h2 className="section-title mb-3">Feriados e jornadas especiais</h2>
            <p className="mb-5 text-xs leading-6 text-muted-foreground">
              Cadastre uma data sem expediente (feriado) ou um dia com horário especial. A exceção
              passa a valer no cálculo dos prazos assim que é salva.
            </p>
            {manager && (
              <Button onClick={() => setDialog('exception')}>
                <Plus data-icon="inline-start" />
                Nova exceção
              </Button>
            )}
            <QueryState
              loading={exceptions.isLoading}
              error={exceptions.error}
              onRetry={() => void exceptions.mutate()}
            />
            {exceptions.data?.length ? (
              <div className="table-wrap mt-6">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Motivo</th>
                      {manager && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.data.map((item) => (
                      <tr key={item.id}>
                        <td>{exceptionDate(item.date)}</td>
                        <td>
                          {item.isWorkDay
                            ? `Dia útil especial · ${item.startTime || '—'} às ${item.endTime || '—'}`
                            : 'Feriado · sem expediente'}
                        </td>
                        <td>{item.reason || '—'}</td>
                        {manager && (
                          <td>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setRemoveLabel(
                                  `Remover a exceção de ${exceptionDate(item.date)}${item.reason ? ` (${item.reason})` : ''}? Os prazos calculados a partir de agora voltam a seguir a semana de atendimento nesse dia.`,
                                );
                                setRemovePath(`/sla/calendar/exceptions/${item.id}`);
                              }}
                            >
                              Remover
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !exceptions.isLoading &&
              !exceptions.error && (
                <p className="mt-6 text-sm text-muted-foreground">
                  Nenhum feriado ou dia especial cadastrado.
                </p>
              )
            )}
          </section>
        </TabsContent>
        <TabsContent value="Simulação">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="panel p-6">
              <h2 className="section-title mb-5">Calcular prazo contratual</h2>
              <ContractForm
                fields={[
                  { name: 'priority', label: 'Prioridade', options: priorities, required: true },
                  { name: 'type', label: 'Tipo de serviço', options: orderTypes },
                  { name: 'startDate', label: 'Início da contagem', type: 'datetime-local' },
                ]}
                connected={action.connected}
                pending={action.pending}
                label="Calcular no motor SLA"
                onSubmit={async (values) => {
                  const result = await action.execute<{
                    policy: { hours: number; priority: string };
                    targetDate: string;
                    startDate: string;
                  }>({ path: queryPath('/sla/simulate', values as Record<string, string>) });
                  setSimulation(result);
                }}
              />
            </section>
            <section className="panel p-6">
              <h2 className="section-title mb-5">Resultado do motor</h2>
              {simulation ? (
                <dl className="flex flex-col gap-5 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Início</dt>
                    <dd className="mt-2">{displayValue(simulation.startDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Prazo aplicável</dt>
                    <dd className="mt-2">{simulation.policy.hours} horas úteis</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Data-alvo</dt>
                    <dd className="mt-2 text-primary">{displayValue(simulation.targetDate)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-xs leading-6 text-muted-foreground">
                  Nenhum prazo calculado. A simulação depende do calendário, exceções e políticas
                  reais. Não é substituída por uma conta demonstrativa.
                </p>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {dialog === 'policy' || dialog === 'base'
                ? editing
                  ? 'Editar prazo da política'
                  : dialog === 'base'
                    ? 'Nova regra por prioridade'
                    : 'Nova exceção por tipo de serviço'
                : dialog === 'day'
                  ? `Configurar ${days[day]}`
                  : 'Exceção do calendário'}
            </DialogTitle>
            <DialogDescription>
              Respeite os horários e o fuso da empresa. O resultado precisa ser confirmado pelo ERP.
            </DialogDescription>
          </DialogHeader>
          <ContractForm
            key={`${dialog}-${editing?.id}-${day}`}
            fields={
              dialog === 'policy' || dialog === 'base'
                ? policyFields
                : [
                    ...(dialog === 'exception'
                      ? [
                          { name: 'date', label: 'Data', type: 'date' as const, required: true },
                          { name: 'reason', label: 'Motivo', max: 500 },
                        ]
                      : []),
                    {
                      name: 'isWorkDay',
                      label: 'Dia com expediente',
                      type: 'checkbox',
                      defaultValue: true,
                    },
                    {
                      name: 'startTime',
                      label: 'Início do expediente',
                      type: 'time',
                      required: true,
                    },
                    {
                      name: 'endTime',
                      label: 'Fim da contagem diária (HH:MM; 24:00 para dia completo)',
                      required: true,
                    },
                  ]
            }
            values={
              dialog === 'policy' || dialog === 'base'
                ? editing || {}
                : dialog === 'day'
                  ? calendar.data?.[day]
                  : {}
            }
            connected={action.connected && manager}
            pending={action.pending}
            draft={!action.connected}
            label={
              dialog === 'policy' || dialog === 'base'
                ? 'Salvar política de SLA'
                : dialog === 'day'
                  ? 'Salvar dia de atendimento'
                  : 'Salvar exceção'
            }
            onSubmit={async (values) => {
              if (dialog === 'policy' || dialog === 'base') {
                if (!Number.isInteger(values.hours)) throw new Error('O prazo deve ser inteiro.');
                if (!editing && dialog === 'policy' && !values.serviceOrderType)
                  throw new Error('Selecione o tipo de serviço.');
                if (!editing && dialog === 'base' && !values.priority)
                  throw new Error('Selecione a prioridade.');
              }
              if (!action.connected) {
                setValidated('Campos e regras validados. Nenhuma alteração enviada.');
                return;
              }
              await action.execute({
                path:
                  dialog === 'policy' || dialog === 'base'
                    ? editing
                      ? `/sla-policies/${editing.id}`
                      : '/sla-policies'
                    : dialog === 'day'
                      ? '/sla/calendar'
                      : '/sla/calendar/exceptions',
                method: (dialog === 'policy' || dialog === 'base') && editing ? 'PATCH' : 'POST',
                body:
                  dialog === 'day'
                    ? { ...values, dayOfWeek: day }
                    : dialog === 'policy' && !editing
                      ? { ...values, priority: 'NORMAL', isOverride: true }
                      : values,
              });
              await Promise.all([policies.mutate(), calendar.mutate(), exceptions.mutate()]);
              setDialog(null);
              toast.success('Configuração confirmada pelo ERP');
            }}
          />
          {validated && (
            <p role="status" className="text-xs text-primary">
              {validated}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!removePath} onOpenChange={(open) => !open && setRemovePath(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar alteração de SLA</DialogTitle>
            <DialogDescription>
              {removeLabel ||
                'Remover uma regra ou restaurar um dia pode modificar cálculos futuros. Confirme a operação no servidor.'}
            </DialogDescription>
          </DialogHeader>
          <Button
            disabled={!action.connected || action.pending}
            onClick={async () => {
              try {
                await action.execute({ path: removePath!, method: 'DELETE' });
                setRemovePath(null);
                await Promise.all([calendar.mutate(), policies.mutate(), exceptions.mutate()]);
                toast.success('Operação confirmada pelo ERP');
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          >
            Confirmar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
