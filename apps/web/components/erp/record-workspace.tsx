'use client';
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useErp, useErpQuery, useErpAction } from '@/lib/erp/gateway';
import {
  type ErpRecord,
  nextStatusOptions,
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
import { OperationalOrderPanel } from './operational-workflows';
import { OrderAnnotations } from './order-annotations';
const attachmentSize = (bytes: unknown) =>
  typeof bytes !== 'number'
    ? ''
    : bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
export function RecordWorkspace({
  kind,
  id,
  base = '/gerencia',
  embedded = false,
  initialTab = 'Resumo',
  activeTab,
  onTabChange,
  showTabs = false,
  workControls,
}: {
  kind: 'orders' | 'occurrences' | 'changes';
  id: string;
  base?: string;
  embedded?: boolean;
  initialTab?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  showTabs?: boolean;
  workControls?: ReactNode;
}) {
  const config = modules[kind];
  const { scope, transport } = useErp();
  const realId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
  const endpoint = `${config.endpoint}/${encodeURIComponent(id)}`;
  const query = useErpQuery<ErpRecord | ErpRecord[]>(
    realId ? (kind === 'changes' ? config.endpoint : endpoint) : null,
  );
  const hours = useErpQuery<{ totalMinutes: number }>(
    realId && kind === 'orders' && scope?.role !== 'cliente'
      ? `/time-entries/order-total?orderId=${encodeURIComponent(id)}`
      : null,
  );
  const action = useErpAction();
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const uploadInFlight = useRef(false);
  const [uploadKey, setUploadKey] = useState(0);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const record = Array.isArray(query.data) ? query.data.find((row) => row.id === id) : query.data;
  const customer = scope?.role === 'cliente' || (!scope && base === '/cliente');
  const canOperate = scope
    ? ['super_admin', 'gerente', 'analista'].includes(scope.role)
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
  // Keep both audit events, but show the solution text only once for a close/resolve pair.
  const historyAnnotations = annotations.map((note, index) => {
    const message = String(note.message);
    const closure = message.match(
      /^Status alterado de RESOLVIDA para FECHADA\. Motivo:\s*([\s\S]*)$/,
    );
    const previous = annotations[index + 1];
    const resolution =
      previous &&
      String(previous.message).match(
        /^Status alterado de \S+ para RESOLVIDA\. Motivo:\s*([\s\S]*)$/,
      );
    return closure &&
      resolution &&
      closure[1] === resolution[1] &&
      note.actorUserId === previous.actorUserId
      ? {
          ...note,
          message: 'Status alterado de RESOLVIDA para FECHADA. Solução registrada na resolução.',
        }
      : note;
  });
  const allTabs =
    kind === 'orders'
      ? [
          'Encerramento',
          'Anotações',
          ...(!customer ? ['Editar'] : []),
          'Resumo',
          ...(!customer ? ['Transição', 'Aprovações'] : []),
          ...(!customer ? ['Trabalho', 'SLA'] : []),
          'Anexos',
          'Histórico',
        ]
      : kind === 'occurrences'
        ? ['Resumo', 'Editar', 'Ordens vinculadas', 'Anotações', 'Histórico']
        : ['Resumo', 'Aprovação e execução'];
  const tabs =
    kind === 'orders' && scope?.role === 'analista'
      ? ['Encerramento', 'Anotações', 'Editar', 'Anexos', 'Histórico']
      : kind === 'occurrences' && embedded && showTabs
        ? ['Anotações', 'Editar', 'Histórico']
        : allTabs;
  const contentClass = embedded && showTabs ? 'p-5 sm:p-6' : undefined;
  const closureNotes = historyAnnotations.filter((note) =>
    /^(Status alterado de \S+ para (RESOLVIDA|FECHADA)\. Motivo:|Atendimento concluído:|DEMONSTRAÇÃO · Resultado registrado)/.test(
      String(note.message),
    ),
  );
  const completedOrder = ['RESOLVIDA', 'FECHADA', 'CANCELADA'].includes(status);
  async function submit(suffix: string, method: 'POST' | 'PATCH', values: Record<string, unknown>) {
    await action.execute({ path: endpoint + suffix, method, body: values });
    toast.success('Alteração salva.');
    try {
      await query.mutate();
    } catch {
      toast.info(
        'A alteração foi salva, mas a tela não pôde ser atualizada. Recarregue a página para consultar os dados atuais.',
      );
    }
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
    ...(scope?.role === 'analista'
      ? []
      : [{ name: 'status', label: 'Status', options: occurrenceStatuses }]),
    ...['sector', 'origin', 'analystResponsible'].map((name, index) => ({
      name,
      label: ['Setor', 'Origem', 'Analista responsável'][index],
      min: 2,
      required: true,
      ...(name === 'origin'
        ? { reference: { resource: 'origins' as const, value: 'name' as const } }
        : {}),
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
      {record?.processInstanceId && !embedded && scope?.role !== 'analista' && (
        <div className="mb-4 rounded-xl border border-info/30 p-4 text-xs">
          Esta O.S. está vinculada a um processo de atendimento.{' '}
          <Link
            href={`${base}/processos/${String(record.processInstanceId)}`}
            className="text-primary"
          >
            Ver acompanhamento do atendimento
          </Link>
          {record.slaEligible === false && (
            <p className="mt-2">
              Meta proposta para o piloto; SLA histórico da origem não informado.
            </p>
          )}
        </div>
      )}
      {kind === 'orders' &&
        record &&
        !embedded &&
        canOperate &&
        !customer &&
        scope?.role !== 'analista' && (
          <OperationalOrderPanel
            orderId={id}
            processId={record.processInstanceId ? String(record.processInstanceId) : null}
            base={base}
          />
        )}
      {query.connected && realId && !record && !query.isLoading && !query.error && (
        <ErpEmpty connected />
      )}
      <Tabs
        {...(activeTab === undefined
          ? { defaultValue: initialTab }
          : { value: activeTab, onValueChange: (value) => onTabChange?.(String(value)) })}
        className="min-w-0 gap-0"
      >
        <div
          className={
            embedded && !showTabs ? 'hidden' : 'overflow-x-auto border-b border-border px-5 py-2'
          }
        >
          <TabsList variant="line">
            {tabs.map((tab) => (
              <TabsTrigger value={tab} key={tab}>
                {kind === 'orders' && scope?.role === 'analista' && tab === 'Encerramento'
                  ? 'Atendimento'
                  : tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="Resumo">
          <section className="panel">
            <PanelHeading
              title="Informações do registro"
              description={record ? 'Dados do registro no Ajust ERP' : 'Sem registro carregado'}
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
        <TabsContent value="Editar" keepMounted={embedded && canOperate} className={contentClass}>
          <section className={embedded ? 'space-y-5' : 'panel p-6'}>
            <h2 className="section-title mb-5">Editar dados do atendimento</h2>
            {kind === 'orders' && !manager && (
              <p className="mb-4 text-sm text-muted-foreground">
                O prazo é definido pelo serviço. Para alterá-lo, solicite a mudança à gestão.
              </p>
            )}
            <ContractForm
              key={`${id}-${String(record?.version || '')}`}
              label="Salvar alterações"
              fields={
                kind === 'orders'
                  ? [
                      ...orderFields
                        .filter((field) => manager || field.name !== 'deadlineAt')
                        .map((field) =>
                          [
                            'requester',
                            'sector',
                            'origin',
                            'ownerName',
                            'analystName',
                            'internalNotes',
                          ].includes(field.name)
                            ? { ...field, nullable: true }
                            : field.name === 'deadlineAt'
                              ? { ...field, label: 'Prazo' }
                              : field,
                        ),
                      ...(manager
                        ? [
                            {
                              name: 'deadlineReason',
                              label: 'Motivo da mudança de prazo',
                              hint: 'Obrigatório só se você mudar o prazo. Mudança de prazo é feita pela gestão.',
                              max: 2000,
                            },
                          ]
                        : []),
                    ]
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
                  options: nextStatusOptions(status),
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
        <TabsContent
          value="Encerramento"
          keepMounted={embedded && canOperate}
          className={contentClass}
        >
          <section className={embedded ? 'space-y-5' : 'panel p-6 space-y-4'}>
            {!completedOrder && workControls}
            {(!workControls || completedOrder || closureNotes.length > 0) && (
              <h2 className="section-title">
                {completedOrder ? 'Resultado do atendimento' : 'Soluções registradas'}
              </h2>
            )}
            {(!workControls || completedOrder) && !closureNotes.length && (
              <p className="text-sm text-muted-foreground">
                Nenhuma descrição de solução registrada. Consulte o histórico para acompanhar as
                alterações desta O.S.
              </p>
            )}
            {closureNotes.map((n) => (
              <article key={String(n.id)} className="rounded-lg border border-border p-4">
                <p className="mb-3 text-xs font-medium">
                  {String(n.message).includes('para FECHADA.')
                    ? 'Encerramento'
                    : 'Solução registrada'}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                  {String(n.message).replace(
                    /^(Status alterado de \S+ para \S+\. Motivo:|Atendimento concluído:|DEMONSTRAÇÃO · Resultado registrado:?)[\s]*/,
                    '',
                  )}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {String(
                    (n.actorUser as { name?: string })?.name || n.sourceAuthorName || 'Equipe',
                  )}{' '}
                  ·{' '}
                  {new Date(String(n.createdAt)).toLocaleString('pt-BR', {
                    timeZone: 'America/Fortaleza',
                  })}
                </p>
              </article>
            ))}
            {completedOrder && workControls}
          </section>
        </TabsContent>
        <TabsContent
          value="Anotações"
          keepMounted={embedded && canOperate}
          className={contentClass}
        >
          <section className={embedded ? 'space-y-5' : 'panel p-6'}>
            {kind === 'orders' || kind === 'occurrences' ? (
              <OrderAnnotations
                orderId={id}
                notes={annotations as ErpRecord[]}
                refresh={query.mutate}
                resource={kind}
              />
            ) : (
              <>
                <h2 className="section-title mb-5">Atualizações do atendimento</h2>
                <ContractForm
                  fields={[
                    {
                      name: 'message',
                      label: 'Mensagem',
                      type: 'textarea',
                      min: 2,
                      max: 20000,
                      required: true,
                    },
                  ]}
                  connected={connected && canOperate}
                  pending={action.pending}
                  onSubmit={(values) => submit('/annotations', 'POST', values)}
                  label="Adicionar anotação"
                />
              </>
            )}
          </section>
        </TabsContent>
        <TabsContent value="Histórico" className={contentClass}>
          <section className={embedded ? 'space-y-5' : 'panel'}>
            {embedded ? (
              <div>
                <h2 className="section-title">Histórico do atendimento</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  Alterações e registros, do mais recente para o mais antigo.
                </p>
              </div>
            ) : (
              <PanelHeading
                title="Histórico do atendimento"
                description="Alterações, responsáveis e registros do atendimento, do mais recente para o mais antigo."
              />
            )}
            {annotations.length ? (
              <div className={embedded ? '' : 'p-6 pt-0'}>
                {historyAnnotations.map((row, i) => (
                  <div className="timeline-item" key={String(row.id || i)}>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">
                      {displayValue(row.message)}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {new Date(String(row.createdAt)).toLocaleString('pt-BR', {
                        timeZone: 'America/Fortaleza',
                      })}{' '}
                      ·{' '}
                      {displayValue(
                        (row.actorUser as { name?: string })?.name ||
                          row.sourceAuthorName ||
                          'Autor não informado',
                      )}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <ErpEmpty connected={query.connected} />
            )}
          </section>
        </TabsContent>
        <TabsContent value="Anexos" keepMounted={embedded && canOperate} className={contentClass}>
          <section className={embedded ? 'space-y-5' : 'panel p-6'}>
            <h2 className="section-title mb-5">Arquivos do atendimento</h2>
            {rows('attachments').map((row, index) => (
              <div
                key={String(row.id || index)}
                className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <p className="min-w-0 truncate text-xs">
                  {displayValue(row.fileName || row.originalName)} · {attachmentSize(row.sizeBytes)}
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
            {!rows('attachments').length && (
              <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                Nenhum arquivo anexado. Adicione imagens, áudios, documentos ou backups relacionados
                a este trabalho.
              </p>
            )}
            <form
              key={uploadKey}
              onSubmit={async (event) => {
                event.preventDefault();
                if (uploadInFlight.current) return;
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
                uploadInFlight.current = true;
                setUploading(true);
                try {
                  await action.execute({
                    path: endpoint + '/attachments',
                    method: 'POST',
                    body: data,
                  });
                  setUploadKey((k) => k + 1);
                  setSelectedFiles([]);
                  toast.success('Anexos enviados.');
                  try {
                    await query.mutate();
                  } catch {
                    setUploadError(
                      'Os anexos foram enviados, mas a lista não pôde ser atualizada. Recarregue a página para consultá-los.',
                    );
                  }
                } catch (error) {
                  setUploadError(errorMessage(error));
                } finally {
                  uploadInFlight.current = false;
                  setUploading(false);
                }
              }}
              className="flex flex-col gap-4"
            >
              <p className="text-xs text-muted-foreground">
                Até 10 arquivos por envio, com até 10 MB cada.
              </p>
              <label className="text-sm">
                Visibilidade
                <select
                  name="isInternal"
                  defaultValue="true"
                  className="ml-2 rounded border p-2"
                  disabled={!connected || !canOperate || uploading}
                >
                  <option value="true">Somente equipe</option>
                  <option value="false">Disponível no portal do cliente</option>
                </select>
              </label>
              <input
                ref={uploadInput}
                id="erp-attachments"
                name="files"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.zip,.mp4,.mov,.webm,.mp3,.wav,.ogg,.aac,.m4a"
                className="hidden"
                multiple
                required
                disabled={!connected || !canOperate || uploading}
                onChange={(event) => setSelectedFiles(Array.from(event.currentTarget.files || []))}
              />
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                disabled={!connected || !canOperate || uploading}
                onClick={() => uploadInput.current?.click()}
              >
                <Paperclip className="size-3.5" />
                Anexo
              </Button>
              {selectedFiles.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {selectedFiles.map((file, index) => (
                    <li className="break-words" key={`${file.name}-${index}`}>
                      {file.name} · {attachmentSize(file.size)}
                    </li>
                  ))}
                </ul>
              )}
              {uploadError && (
                <p role="alert" className="text-xs text-danger">
                  {uploadError}
                </p>
              )}
              <Button
                type="submit"
                className="w-fit"
                disabled={!connected || !canOperate || uploading || !selectedFiles.length}
              >
                {uploading ? 'Enviando…' : 'Enviar anexos'}
              </Button>
            </form>
          </section>
        </TabsContent>
        <TabsContent value="Ordens vinculadas">
          <section className="panel p-6">
            <h2 className="section-title mb-5">
              Ordens desta ocorrência · {rows('serviceOrders').length} O.S.
            </h2>
            {!rows('serviceOrders').length && (
              <p className="text-sm text-muted-foreground">
                Nenhuma ordem vinculada a esta ocorrência.
              </p>
            )}
            {rows('serviceOrders').map((row, i) => (
              <Link
                key={String(row.id || i)}
                href={`${base}/ordens/${row.id}`}
                className="mb-3 flex items-center justify-between gap-4 rounded-lg border border-border p-4 text-sm"
              >
                <span>
                  <span className="text-primary">{displayValue(row.protocol)}</span> ·{' '}
                  {displayValue(row.title)}
                </span>
                <StatusBadge
                  status={
                    orderStatuses[String(row.status) as keyof typeof orderStatuses] ||
                    String(row.status)
                  }
                />
              </Link>
            ))}
            {canOperate && (
              <details className="mt-6 border-t border-border pt-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Criar outra O.S. nesta ocorrência
                </summary>
                <div className="mt-5">
                  <ContractForm
                    fields={orderFields.filter((f) => !['ownerName'].includes(f.name))}
                    connected={connected && canOperate}
                    pending={action.pending}
                    onSubmit={async (values) => {
                      await action.execute({
                        path: '/service-orders',
                        method: 'POST',
                        body: { ...values, occurrenceId: id },
                      });
                      await query.mutate();
                      toast.success('O.S. criada nesta ocorrência');
                    }}
                  />
                </div>
              </details>
            )}
          </section>
        </TabsContent>
        <TabsContent value="Trabalho">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Registrar tempo nesta ordem</h2>
            {hours.data && (
              <p className="mb-4 text-sm">
                Tempo total da equipe nesta O.S.: {hours.data.totalMinutes} minutos.
              </p>
            )}
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
                await hours.mutate();
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
          {manager && (
            <Link className="text-link mt-5" href={`${base}/calendario-sla`}>
              Calendário e simulação
            </Link>
          )}
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
              onSubmit={(values) =>
                submit('/transition', 'PATCH', { ...values, expectedVersion: version })
              }
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
