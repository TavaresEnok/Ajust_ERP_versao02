'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  FileUp,
  History,
  Network,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { useRouteBase } from '@/lib/erp/visual-data';
import { PageHeading, Avatar } from './primitives';
import { QueryState } from './contract-form';
import { downloadDiagram } from './drawio-frame';

const DrawioFrame = dynamic(() => import('./drawio-frame').then((m) => m.DrawioFrame));
type Topology = {
  id: string;
  title: string;
  version: number;
  updatedAt: string;
  updatedByName: string;
  sourceFileName: string | null;
  diagramXml?: string;
};
type Provider = {
  id: string;
  tradeName: string;
  legalName: string;
  networkTopology: Topology | null;
};
type Detail = {
  customer: Pick<Provider, 'id' | 'tradeName' | 'legalName'>;
  topology: Topology | null;
};
type Revision = {
  version: number;
  title: string;
  savedByName: string;
  createdAt: string;
  sourceFileName: string | null;
};
const blank =
  '<mxfile><diagram id="rede" name="Rede"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
const date = (v: string) =>
  new Date(v).toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    dateStyle: 'short',
    timeStyle: 'short',
  });
function name(p: Pick<Provider, 'tradeName' | 'legalName'>) {
  return p.tradeName || p.legalName;
}

export function NetworkTopologiesPage({ customerId }: { customerId?: string }) {
  const base = useRouteBase();
  const list = useErpQuery<Provider[]>('/network-topologies');
  const detail = useErpQuery<Detail>(customerId ? `/network-topologies/${customerId}` : null);
  const action = useErpAction();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<{
    xml: string;
    version: number;
    imported: boolean;
    fileName: string | null;
  } | null>(null);
  const versionRef = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useErpQuery<Revision[]>(
    customerId && historyOpen ? `/network-topologies/${customerId}/history` : null,
  );
  const [restoring, setRestoring] = useState(false);
  const providers = list.data || [];
  const customer = detail.data?.customer;
  const topology = detail.data?.topology;
  const rows = providers.filter(
    (p) =>
      `${name(p)} ${p.legalName} ${p.networkTopology?.title || ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')) &&
      (filter === 'all' || (filter === 'with') === !!p.networkTopology),
  );
  const displayed = rows.slice(page * 25, (page + 1) * 25);

  function edit(
    xml: string,
    imported: boolean,
    fileName: string | null = topology?.sourceFileName || null,
  ) {
    versionRef.current = topology?.version || 0;
    setEditor({ xml, version: versionRef.current, imported, fileName });
  }
  async function importFile(file: File) {
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Selecione um arquivo de até 8 MB.');
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['drawio', 'xml', 'svg', 'png'].includes(ext || ''))
        throw new Error(
          'Use um arquivo .drawio, XML, ou PNG/SVG com o diagrama editável incorporado.',
        );
      let xml: string;
      if (ext === 'png') {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (
          bytes[0] !== 137 ||
          bytes[1] !== 80 ||
          !/mxfile|mxGraphModel/.test(new TextDecoder('latin1').decode(bytes))
        ) {
          throw new Error(
            'Esse PNG não contém o diagrama editável. Exporte do BookStack/draw.io incluindo os dados do diagrama.',
          );
        }
        xml = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
          reader.readAsDataURL(file);
        });
      } else {
        xml = await file.text();
        const parsed = new DOMParser().parseFromString(xml, 'application/xml');
        if (parsed.querySelector('parsererror'))
          throw new Error('O arquivo XML está inválido. Exporte novamente o diagrama do draw.io.');
        if (ext === 'svg') {
          const embedded = parsed.documentElement.getAttribute('content');
          if (!embedded)
            throw new Error(
              'Esse SVG contém somente a imagem. Exporte do BookStack/draw.io com o diagrama editável incorporado.',
            );
          xml = embedded;
        } else if (!['mxfile', 'mxGraphModel'].includes(parsed.documentElement.tagName))
          throw new Error('O arquivo não é um diagrama do draw.io.');
      }
      edit(xml, true, file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível importar.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  if (customerId)
    return (
      <>
        <Link
          href={`${base}/ativos`}
          className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Todos os provedores
        </Link>
        <PageHeading
          title={customer ? name(customer) : 'Topologia de rede'}
          description="Diagrama de rede do provedor, com visualização e edição no draw.io."
        >
          {customer && (
            <>
              <Button variant="outline" disabled={!topology} onClick={() => setHistoryOpen(true)}>
                <History className="size-4" />
                Histórico
              </Button>
              <Button
                variant="outline"
                disabled={!topology?.diagramXml}
                onClick={() => downloadDiagram(topology!.diagramXml!, name(customer))}
              >
                <Download className="size-4" />
                Baixar .drawio
              </Button>
              <Button variant="outline" onClick={() => fileInput.current?.click()}>
                <FileUp className="size-4" />
                Importar diagrama
              </Button>
              {topology?.diagramXml && (
                <Button onClick={() => edit(topology.diagramXml!, false)}>
                  <Pencil className="size-4" />
                  Editar topologia
                </Button>
              )}
            </>
          )}
        </PageHeading>
        <QueryState
          loading={detail.isLoading}
          error={detail.error}
          onRetry={() => void detail.mutate()}
        />
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          aria-label="Arquivo de topologia"
          accept=".drawio,.xml,.svg,.png"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
        {customer && (
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Network className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold">Topologia de rede</h2>
                  <p className="text-xs text-muted-foreground">
                    {topology
                      ? `Versão ${topology.version} · ${date(topology.updatedAt)} · ${topology.updatedByName}`
                      : 'Nenhum diagrama cadastrado'}
                  </p>
                </div>
              </div>
              {topology && (
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs text-success">
                  Diagrama disponível
                </span>
              )}
            </div>
            {topology?.diagramXml ? (
              <div className="h-[calc(100dvh-310px)] min-h-[480px]">
                <DrawioFrame
                  key={topology.version}
                  xml={topology.diagramXml}
                  title={name(customer)}
                />
              </div>
            ) : (
              <div className="flex min-h-[430px] flex-col items-center justify-center gap-4 px-6 py-14 text-center">
                <span className="rounded-2xl bg-primary/10 p-5 text-primary">
                  <Network className="size-10" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">
                    A rede de {name(customer)}, em um só lugar
                  </h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                    Importe a topologia existente no BookStack ou crie um diagrama no draw.io.
                    Equipamentos, conexões e páginas serão mantidos no arquivo editável.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => fileInput.current?.click()}>
                    <FileUp className="size-4" />
                    Importar diagrama existente
                  </Button>
                  <Button variant="outline" onClick={() => edit(blank, true, null)}>
                    <Plus className="size-4" />
                    Criar topologia
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  .drawio / XML · PNG e SVG com dados editáveis · até 8 MB
                </p>
              </div>
            )}
          </section>
        )}
        {editor && customer && (
          <Dialog open onOpenChange={() => {}}>
            <DialogContent
              showCloseButton={false}
              className="h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none gap-0 overflow-hidden border border-border bg-card p-0 sm:max-w-none"
            >
              <DialogTitle className="sr-only">Editor da topologia de {name(customer)}</DialogTitle>
              <DialogDescription className="sr-only">
                Edite o diagrama e clique em Salvar alterações. Use Fechar editor para sair.
              </DialogDescription>
              <DrawioFrame
                xml={editor.xml}
                title={name(customer)}
                editing
                imported={editor.imported}
                onClose={() => setEditor(null)}
                onSave={async (diagramXml) => {
                  const saved = await action.execute<Topology>({
                    path: `/network-topologies/${customerId}`,
                    method: 'PUT',
                    body: {
                      title: `Topologia de ${name(customer)}`,
                      diagramXml,
                      expectedVersion: versionRef.current,
                      sourceFileName: editor.fileName,
                    },
                  });
                  versionRef.current = saved.version;
                  toast.success(`Topologia salva · versão ${saved.version}`);
                  void Promise.all([detail.mutate(), list.mutate(), history.mutate()]).catch(() =>
                    toast.info(
                      'Topologia salva. Atualize a página para consultar os dados mais recentes.',
                    ),
                  );
                }}
              />
            </DialogContent>
          </Dialog>
        )}
        {historyOpen && (
          <Dialog open onOpenChange={setHistoryOpen}>
            <DialogContent
              showCloseButton={false}
              className="flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-0 overflow-hidden border border-border bg-card p-0 sm:max-w-xl"
            >
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <DialogTitle className="font-semibold">Histórico da topologia</DialogTitle>
                  <DialogDescription className="mt-1 text-xs text-muted-foreground">
                    Até 100 versões mais recentes · {customer ? name(customer) : ''}
                  </DialogDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Fechar histórico"
                  onClick={() => setHistoryOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                <QueryState
                  loading={history.isLoading}
                  error={history.error}
                  onRetry={() => void history.mutate()}
                />
                {history.data?.map((revision) => (
                  <div key={revision.version} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm">
                        Versão {revision.version}
                        {revision.version === topology?.version ? ' · Atual' : ''}
                      </strong>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={restoring}
                        onClick={async () => {
                          setRestoring(true);
                          try {
                            const saved = await action.execute<{ diagramXml: string }>({
                              path: `/network-topologies/${customerId}/history/${revision.version}`,
                            });
                            edit(saved.diagramXml, true, null);
                            setHistoryOpen(false);
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : 'Não foi possível abrir a versão.',
                            );
                          } finally {
                            setRestoring(false);
                          }
                        }}
                      >
                        Abrir no editor
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {date(revision.createdAt)} · {revision.savedByName}
                    </p>
                    {revision.sourceFileName && (
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        Arquivo: {revision.sourceFileName}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );

  return (
    <>
      <PageHeading
        title="Topologia de rede"
        description="Escolha o provedor para consultar ou atualizar o diagrama de sua rede."
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Provedores', value: providers.length, icon: Building2 },
          {
            label: 'Com topologia',
            value: providers.filter((p) => p.networkTopology).length,
            icon: CheckCircle2,
          },
          {
            label: 'Aguardando diagrama',
            value: providers.filter((p) => !p.networkTopology).length,
            icon: Network,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5"
          >
            <span className="rounded-xl bg-primary/10 p-3 text-primary">
              <metric.icon className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold">{list.isLoading ? '—' : metric.value}</p>
            </div>
          </div>
        ))}
      </div>
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-border px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              aria-label="Buscar provedor"
              placeholder="Buscar provedor ou topologia…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            aria-label="Filtrar topologias"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Todos os provedores</option>
            <option value="with">Com topologia</option>
            <option value="without">Sem topologia</option>
          </select>
        </div>
        <QueryState
          loading={list.isLoading}
          error={list.error}
          onRetry={() => void list.mutate()}
        />
        <div className="relative overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Provedor</th>
                <th>Topologia</th>
                <th>Última alteração</th>
                <th>Atualizada por</th>
                <th aria-label="Abrir topologia" />
              </tr>
            </thead>
            <tbody>
              {displayed.map((provider) => (
                <tr key={provider.id}>
                  <td>
                    <Link
                      href={`${base}/ativos/${provider.id}`}
                      className="flex items-center gap-3 font-medium"
                    >
                      <Avatar name={name(provider)} />
                      <span>{name(provider)}</span>
                    </Link>
                  </td>
                  <td>
                    <span
                      className={
                        provider.networkTopology ? 'text-success' : 'text-muted-foreground'
                      }
                    >
                      {provider.networkTopology
                        ? `Versão ${provider.networkTopology.version}`
                        : 'Sem diagrama'}
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {provider.networkTopology ? date(provider.networkTopology.updatedAt) : '—'}
                  </td>
                  <td className="text-xs">{provider.networkTopology?.updatedByName || '—'}</td>
                  <td>
                    <Link
                      href={`${base}/ativos/${provider.id}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary"
                    >
                      {provider.networkTopology ? 'Ver topologia' : 'Cadastrar topologia'}
                      <ArrowRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.isLoading && !list.error && !rows.length && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Nenhum provedor encontrado.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>{rows.length} provedores</span>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((n) => n - 1)}
            >
              Anterior
            </Button>
            <span>
              {page + 1} de {Math.max(1, Math.ceil(rows.length / 25))}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={(page + 1) * 25 >= rows.length}
              onClick={() => setPage((n) => n + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
