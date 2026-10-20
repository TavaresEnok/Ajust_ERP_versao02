'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useErp, useErpQuery, useErpAction } from '@/lib/erp/gateway';
import {
  type ErpRecord,
  orderStatuses,
  occurrenceStatuses,
  changeStatuses,
  changeTransitions,
  errorMessage,
} from '@/lib/erp/contracts';
import { orderFields, modules } from '@/lib/erp/modules';
import type { FieldSpec } from '@/lib/erp/fields';
import { ConnectionNotice, ContractForm, ErpEmpty, QueryState } from './contract-form';
import { PageHeading, PanelHeading, StatusBadge } from './primitives';
import { displayValue } from './resource-page';
import { DataReport } from './data-report';
import { OperationControl } from './operation-controls';
export function RecordWorkspace({
  kind,
  id,
  base = '/gerencia',
  embedded = false,
  initialTab = 'Resumo',
}: {
  kind: 'orders' | 'occurrences' | 'changes';
  id: string;
  base?: string;
  embedded?: boolean;
  initialTab?: string;
}) {
  const config = modules[kind];
  const { scope, transport } = useErp();
  const realId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
  const endpoint = `${config.endpoint}/${encodeURIComponent(id)}`;
  const query = useErpQuery<ErpRecord | ErpRecord[]>(
    realId ? (kind === 'changes' ? config.endpoint : endpoint) : null,
  );
  const action = useErpAction();
  const [uploadError, setUploadError] = useState('');
  const [uploadKey, setUploadKey] = useState(0);
  const record = Array.isArray(query.data) ? query.data.find((row) => row.id === id) : query.data;
  const customer =
    scope?.role === 'cliente' || scope?.role === 'leitura' || (!scope && base === '/cliente');
  const canOperate = scope
    ? ['super_admin', 'gerente', 'analista', 'tecnico'].includes(scope.role)
    : !customer;
  const manager = scope ? ['super_admin', 'gerente'].includes(scope.role) : !customer;
  const connected = action.connected && realId && !!record;
  const statuses =
    kind === 'orders'
      ? orderStatuses
      : kind === 'occurrences'
        ? occurrenceStatuses
        : changeStatuses;
  const status = String(record?.status || '');
  const rows = (key: string) =>
    Array.isArray(record?.[key]) ? (record[key] as Record<string, unknown>[]) : [];
  const annotations = rows(kind === 'orders' ? 'occurrences' : 'annotations');
  const tabs =
    kind === 'orders'
      ? [
          'Resumo',
          ...(!customer ? ['Editar', 'Transição', 'Aprovações'] : []),
          'Histórico',
          'Anotações',
          'Anexos',
          ...(!customer ? ['Trabalho', 'SLA'] : []),
        ]
      : kind === 'occurrences'
        ? ['Resumo', 'Editar', 'Ordens vinculadas', 'Anotações', 'Histórico']
        : ['Resumo', 'Aprovação e execução'];
  async function submit(suffix: string, method: 'POST' | 'PATCH', values: Record<string, unknown>) {
    await action.execute({ path: endpoint + suffix, method, body: values });
    await query.mutate();
    toast.success('Operação confirmada pelo ERP');
  }
  async function download(path: string, name: string) {
    try {
      if (!transport?.download) throw new Error('Adaptador de download ainda não configurado.');
      const blob = await transport.download(path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  const version = typeof record?.version === 'number' ? record.version : undefined;
  const editOccurrence: FieldSpec[] = [
    { name: 'type', label: 'Tipo', min: 2, required: true },
    { name: 'status', label: 'Status', options: occurrenceStatuses },
    ...['sector', 'origin', 'analystResponsible'].map((name, index) => ({
      name,
      label: ['Setor', 'Origem', 'Analista responsável'][index],
      min: 2,
      required: true,
    })),
    { name: 'description', label: 'Descrição', type: 'textarea', min: 3, required: true },
  ];
  return (
    <>
      {!embedded && (
        <>
          <Link href={`${base}/operacoes/${kind}`} className="mb-4 text-link">
            <ArrowLeft />
            Voltar para {config.title.toLowerCase()}
          </Link>
          <PageHeading
            title={
              record
                ? String(record.title || record.number || config.title)
                : 'Detalhes e operações'
            }
            description={
              realId
                ? `Registro ${id}`
                : 'Prévia da interface de atendimento · nenhum registro selecionado'
            }
          >
            {record && <StatusBadge status={statuses[status as keyof typeof statuses] || status} />}
            {kind === 'orders' && connected && canOperate && (
              <OperationControl
                title="Emitir pesquisa CSAT"
                description="Solicita ao ERP uma pesquisa para esta ordem; o servidor não duplica pesquisas existentes."
                path="/csat/create-for-order"
                body={{ orderId: id }}
                roles={['super_admin', 'gerente', 'analista']}
              />
            )}
          </PageHeading>
          {!query.connected && <ConnectionNotice />}
        </>
      )}
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      {query.connected && realId && !record && !query.isLoading && !query.error && (
        <ErpEmpty connected />
      )}
      <Tabs defaultValue={initialTab} className="min-w-0 gap-5">
        <div className={embedded ? 'hidden' : 'overflow-x-auto'}>
          <TabsList variant="line">
            {tabs.map((tab) => (
              <TabsTrigger value={tab} key={tab}>
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="Resumo">
          <section className="panel">
            <PanelHeading
              title="Informações do registro"
              description={record ? 'Dados retornados pelo ERP original' : 'Sem registro carregado'}
            />
            {record ? (
              <dl className="grid gap-5 p-6 pt-0 sm:grid-cols-2">
                {(kind === 'orders' ? orderFields : config.fields)
                  .filter((f) => f.type !== 'password' && (!customer || f.name !== 'internalNotes'))
                  .map((field) => (
                    <div key={field.name}>
                      <dt className="mb-2 text-[10px] text-muted-foreground">{field.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-xs leading-6">
                        {field.options?.[String(record[field.name])] ||
                          displayValue(record[field.name])}
                      </dd>
                    </div>
                  ))}
                {kind === 'orders' && (
                  <div>
                    <dt className="text-[10px] text-muted-foreground">Visível ao cliente</dt>
                    <dd className="mt-2 text-xs">{displayValue(record.isCustomerVisible)}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <ErpEmpty connected={query.connected} />
            )}
          </section>
        </TabsContent>
        <TabsContent value="Editar">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Editar dados do atendimento</h2>
            <ContractForm
              key={(record?.updatedAt as string) || id}
              fields={
                kind === 'orders'
                  ? orderFields.map((field) =>
                      [
                        'requester',
                        'sector',
                        'origin',
                        'ownerName',
                        'analystName',
                        'internalNotes',
                      ].includes(field.name)
                        ? { ...field, nullable: true }
                        : field,
                    )
                  : editOccurrence
              }
              values={record}
              connected={connected && canOperate}
              pending={action.pending}
              onSubmit={(values) =>
                submit('', 'PATCH', {
                  ...values,
                  ...(kind === 'orders' ? { expectedVersion: version } : {}),
                })
              }
            />
          </section>
        </TabsContent>
        <TabsContent value="Transição">
          <section className="panel p-6">
            <h2 className="section-title mb-3">Transição com justificativa</h2>
            <p className="mb-5 text-xs leading-6 text-muted-foreground">
              A alteração usa a versão atual do registro. O servidor determina transições permitidas
              e aprovações necessárias.
            </p>
            <ContractForm
              fields={[
                {
                  name: 'toStatus',
                  label: 'Próximo status',
                  options: orderStatuses,
                  required: true,
                },
                {
                  name: 'reason',
                  label: 'Justificativa',
                  type: 'textarea',
                  required: true,
                  min: 3,
                },
              ]}
              connected={connected && canOperate}
              pending={action.pending}
              onSubmit={(values) =>
                submit('/transition', 'PATCH', { ...values, expectedVersion: version })
              }
              label="Solicitar transição"
            />
          </section>
        </TabsContent>
        <TabsContent value="Aprovações">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Decisão gerencial</h2>
            <ContractForm
              fields={[
                {
                  name: 'decision',
                  label: 'Decisão',
                  options: { APPROVED: 'Aprovar', REJECTED: 'Rejeitar' },
                  required: true,
                },
                { name: 'reason', label: 'Parecer', type: 'textarea' },
              ]}
              connected={connected && manager}
              pending={action.pending}
              onSubmit={(values) => submit('/approvals', 'POST', values)}
              label="Registrar decisão"
            />
            {rows('approvals').map((row, i) => (
              <div key={String(row.id || i)} className="mt-5 border-t border-border pt-4 text-xs">
                <StatusBadge status={String(row.status)} />
                <p className="mt-2">
                  {displayValue(row.reason)} · {displayValue(row.createdAt)}
                </p>
              </div>
            ))}
          </section>
        </TabsContent>
        <TabsContent value="Anotações">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Atualizações do atendimento</h2>
            <Alert className="mb-5">
              <AlertTitle>Visibilidade definida pelo backend</AlertTitle>
              <AlertDescription>
                O endpoint original recebe apenas a mensagem. Não existe opção de anotação privada
                neste contrato; confirme o público antes de enviar.
              </AlertDescription>
            </Alert>
            <ContractForm
              fields={[
                {
                  name: 'message',
                  label: 'Mensagem',
                  type: 'textarea',
                  min: 2,
                  max: 4000,
                  required: true,
                },
              ]}
              connected={connected && canOperate}
              pending={action.pending}
              onSubmit={(values) => submit('/annotations', 'POST', values)}
              label="Adicionar anotação"
            />
          </section>
        </TabsContent>
        <TabsContent value="Histórico">
          <section className="panel">
            <PanelHeading
              title="Histórico do atendimento"
              description="Eventos e anotações retornados pelo servidor, sem eventos fabricados."
            />
            {annotations.length ? (
              <div className="p-6 pt-0">
                {annotations.map((row, i) => (
                  <div className="timeline-item" key={String(row.id || i)}>
                    <p className="text-xs leading-6">{displayValue(row.message)}</p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {displayValue(row.createdAt)} · {displayValue(row.actorUserId)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <ErpEmpty connected={query.connected} />
            )}
          </section>
        </TabsContent>
        <TabsContent value="Anexos">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Arquivos do atendimento</h2>
            {rows('attachments').map((row, index) => (
              <div
                key={String(row.id || index)}
                className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <p className="min-w-0 truncate text-xs">
                  {displayValue(row.fileName || row.originalName)} · {displayValue(row.sizeBytes)}{' '}
                  bytes
                </p>
                <Button
                  variant="outline"
                  disabled={!connected}
                  onClick={() =>
                    void download(
                      `${endpoint}/attachments/${encodeURIComponent(String(row.id))}/download`,
                      String(row.fileName || 'anexo'),
                    )
                  }
                >
                  <Download data-icon="inline-start" />
                  Baixar
                </Button>
              </div>
            ))}
            <form
              key={uploadKey}
              onSubmit={async (event) => {
                event.preventDefault();
                setUploadError('');
                const data = new FormData(event.currentTarget);
                const files = data
                  .getAll('files')
                  .filter((f) => f instanceof File && f.size > 0) as File[];
                if (
                  !files.length ||
                  files.length > 10 ||
                  files.some((f) => f.size > 10 * 1024 * 1024)
                ) {
                  setUploadError('Selecione de 1 a 10 arquivos, cada um com até 10 MB.');
                  return;
                }
                try {
                  await action.execute({
                    path: endpoint + '/attachments',
                    method: 'POST',
                    body: data,
                  });
                  setUploadKey((k) => k + 1);
                  await query.mutate();
                  toast.success('Upload confirmado pelo ERP');
                } catch (error) {
                  setUploadError(errorMessage(error));
                }
              }}
              className="flex flex-col gap-4"
            >
              <label className="text-xs" htmlFor="erp-attachments">
                Anexar arquivos · até 10 arquivos de 10 MB
              </label>
              <Input
                id="erp-attachments"
                name="files"
                type="file"
                multiple
                required
                disabled={!connected || !canOperate}
              />
              {uploadError && (
                <p role="alert" className="text-xs text-danger">
                  {uploadError}
                </p>
              )}
              <Button type="submit" disabled={!connected || !canOperate || action.pending}>
                Enviar anexos ao ERP
              </Button>
            </form>
          </section>
        </TabsContent>
        <TabsContent value="Ordens vinculadas">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Criar ordem nesta ocorrência</h2>
            <ContractForm
              fields={orderFields.filter((f) => !['ownerName'].includes(f.name))}
              connected={connected && canOperate}
              pending={action.pending}
              onSubmit={(values) => submit('/orders', 'POST', values)}
            />
            {rows('serviceOrders').map((row, i) => (
              <Link
                key={String(row.id || i)}
                href={`${base}/operacoes/orders/${row.id}`}
                className="mt-5 block rounded-lg border border-border p-4 text-xs"
              >
                {displayValue(row.protocol)} · {displayValue(row.title)}
              </Link>
            ))}
          </section>
        </TabsContent>
        <TabsContent value="Trabalho">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Registrar tempo nesta ordem</h2>
            <ContractForm
              fields={modules.time.fields.filter((f) => f.name !== 'orderId')}
              connected={connected && canOperate}
              pending={action.pending}
              onSubmit={async (values) => {
                await action.execute({
                  path: '/time-entries',
                  method: 'POST',
                  body: { ...values, orderId: id },
                });
                toast.success('Trabalho confirmado pelo ERP');
              }}
            />
            <Link className="text-link mt-5" href={`${base}/apontamentos`}>
              Consultar lançamentos
            </Link>
          </section>
        </TabsContent>
        <TabsContent value="SLA">
          {realId ? (
            <DataReport
              title="Histórico de SLA da ordem"
              path={`/sla/audit/${encodeURIComponent(id)}`}
              tables={[
                {
                  columns: [
                    { key: 'createdAt', label: 'Data' },
                    { key: 'eventType', label: 'Evento' },
                    { key: 'reason', label: 'Motivo' },
                    { key: 'deadlineAt', label: 'Prazo' },
                  ],
                },
              ]}
            />
          ) : (
            <ErpEmpty />
          )}
          <Link className="text-link mt-5" href={`${base}/calendario-sla`}>
            Calendário e simulação
          </Link>
        </TabsContent>
        <TabsContent value="Aprovação e execução">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Avançar a mudança</h2>
            <ContractForm
              key={status}
              fields={[
                {
                  name: 'toStatus',
                  label: 'Próxima etapa',
                  required: true,
                  options: record
                    ? Object.fromEntries(
                        (changeTransitions[status as keyof typeof changeTransitions] || []).map(
                          (code) => [code, changeStatuses[code]],
                        ),
                      )
                    : changeStatuses,
                },
              ]}
              connected={connected && manager}
              pending={action.pending}
              onSubmit={(values) => submit('/transition', 'PATCH', values)}
              label="Confirmar transição da RFC"
            />
            <p className="mt-4 text-xs text-muted-foreground">
              Aprovação e início de execução são registrados pelo servidor com autor e data. Estados
              finais não permitem novas transições.
            </p>
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}
