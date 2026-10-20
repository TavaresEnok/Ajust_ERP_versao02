'use client';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  AppWindow,
  ArrowRightLeft,
  Clock3,
  Copy,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Network,
  Search,
  Server,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { errorMessage, queryPath, type ErpRecord } from '@/lib/erp/contracts';
import { copyToClipboard } from '@/lib/erp/clipboard';
import { listRecords } from '@/lib/erp/visual-data';
import { cn } from '@/lib/utils';
import { PageHeading } from './primitives';
import { RecordDialog } from './record-dialog';
import { OperationControl } from './operation-controls';
import { QueryState, ErpEmpty } from './contract-form';

const PAGE_SIZE = 200;
const MASK = '••••••••••••';
const LONG_NOTES = 400;

type TypeMeta = { icon: ComponentType<{ className?: string }>; chip: string };
const TYPE_META: Record<string, TypeMeta> = {
  DNS: {
    icon: Globe,
    chip: 'border-purple-500/25 bg-purple-500/10 text-purple-600 dark:text-purple-300',
  },
  OLT: {
    icon: Network,
    chip: 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300',
  },
  FIREWALL: {
    icon: Shield,
    chip: 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300',
  },
  ROUTER: {
    icon: Server,
    chip: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
  SW: {
    icon: ArrowRightLeft,
    chip: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
  },
  SISTEMA: {
    icon: AppWindow,
    chip: 'border-pink-500/25 bg-pink-500/10 text-pink-600 dark:text-pink-300',
  },
  VM: { icon: Cpu, chip: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300' },
  OUTROS: { icon: KeyRound, chip: 'border-border bg-muted text-muted-foreground' },
};

function typeMeta(value: unknown): TypeMeta {
  const normalized = String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
  if (normalized.includes('SWITCH')) return TYPE_META.SW;
  if (normalized.includes('ROTEADOR')) return TYPE_META.ROUTER;
  return TYPE_META[normalized] || TYPE_META.OUTROS;
}

const text = (value: unknown, fallback = '—') => (value ? String(value) : fallback);
const when = (value: unknown) => {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('pt-BR') : '—';
};

function IconButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5',
        active && 'border-primary/40 text-primary',
      )}
    >
      {children}
    </button>
  );
}

export function CredentialsPage() {
  const { scope } = useErp();
  const action = useErpAction();
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('Todos');
  const [type, setType] = useState('Todos');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; secret: string } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const revealVersion = useRef(0);

  const allowed = !scope || ['super_admin', 'gerente', 'analista', 'tecnico'].includes(scope.role);
  const query = useErpQuery<unknown>(
    allowed
      ? queryPath('/knowledge/credentials', { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      : null,
  );
  const items = useMemo(() => listRecords(query.data), [query.data]);
  const total =
    query.data && typeof query.data === 'object' && 'total' in query.data
      ? Number(query.data.total)
      : items.length;

  const providers = useMemo(
    () => [
      'Todos',
      ...[...new Set(items.map((i) => text(i.provider)))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    ],
    [items],
  );
  const types = useMemo(
    () => [
      'Todos',
      ...[...new Set(items.map((i) => text(i.equipmentType, 'OUTROS')))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    ],
    [items],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (provider !== 'Todos' && text(item.provider) !== provider) return false;
      if (type !== 'Todos' && text(item.equipmentType, 'OUTROS') !== type) return false;
      if (!q) return true;
      return `${item.equipmentName ?? ''} ${item.host ?? ''} ${item.username ?? ''} ${item.notes ?? ''} ${item.provider ?? ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [items, search, provider, type]);
  const grouped = useMemo(() => {
    const map = new Map<string, ErpRecord[]>();
    for (const item of filtered) {
      const key = text(item.equipmentType, 'OUTROS');
      map.set(key, [...(map.get(key) || []), item]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [filtered]);

  // O primeiro item fica selecionado para o painel já mostrar dados, sem clique extra.
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null;
  const secret = revealed && selected && revealed.id === selected.id ? revealed.secret : '';

  const latest = useMemo(() => {
    const stamps = items
      .map((item) => new Date(String(item.updatedAt)).getTime())
      .filter((value) => Number.isFinite(value));
    return stamps.length ? when(new Date(Math.max(...stamps)).toISOString()) : '—';
  }, [items]);

  function hideSecret() {
    revealVersion.current++;
    setRevealed(null);
  }

  // O segredo só vive em memória: some ao trocar de registro, sair da aba ou após 30 segundos.
  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(hideSecret, 30000);
    const hide = () => {
      if (document.hidden) hideSecret();
    };
    window.addEventListener('blur', hideSecret);
    document.addEventListener('visibilitychange', hide);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('blur', hideSecret);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [revealed]);
  useEffect(() => hideSecret, []);

  async function fetchSecret(item: ErpRecord) {
    const version = ++revealVersion.current;
    try {
      const response = await action.execute<Record<string, unknown>>({
        path: `/knowledge/credentials/${encodeURIComponent(item.id)}/reveal`,
        method: 'POST',
      });
      if (version !== revealVersion.current) return null;
      if (typeof response.secret !== 'string')
        throw new Error('O ERP não retornou o segredo no formato esperado.');
      return response.secret;
    } catch (error) {
      if (version === revealVersion.current) toast.error(errorMessage(error));
      return null;
    }
  }

  async function toggleSecret(item: ErpRecord) {
    if (revealed?.id === item.id) return hideSecret();
    setSelectedId(item.id);
    const value = await fetchSecret(item);
    if (value !== null) setRevealed({ id: item.id, secret: value });
  }

  async function copy(value: string, label: string) {
    if (await copyToClipboard(value)) toast.success(`${label} copiado.`);
    else toast.error('Não foi possível copiar.');
  }

  async function copySecret(item: ErpRecord) {
    // Se já está visível, copia o que está na tela; senão busca (auditado) e copia sem exibir.
    const value = revealed?.id === item.id ? revealed.secret : await fetchSecret(item);
    if (value === null || value === undefined) return;
    const ok = await copyToClipboard(value);
    if (ok) toast.success('Senha copiada. A área de transferência não é limpa automaticamente.');
    else toast.error('Não foi possível copiar.');
  }

  function clearFilters() {
    setSearch('');
    setProvider('Todos');
    setType('Todos');
  }

  const notes = text(selected?.notes, '');
  const kpis = [
    { label: 'Credenciais', value: String(total) },
    { label: 'Visíveis', value: String(filtered.length) },
    { label: 'Provedores', value: String(providers.length - 1) },
    { label: 'Tipos', value: String(types.length - 1) },
    { label: 'Última atualização', value: latest },
  ];

  return (
    <>
      <PageHeading
        title="Cofre de credenciais"
        description="Acessos operacionais organizados por provedor, tipo de ativo e equipamento."
      >
        <RecordDialog title="Nova credencial" moduleKey="credentials" fields={[]} />
      </PageHeading>

      <div className="mb-5 flex items-center gap-3 rounded-lg border border-primary/10 bg-secondary/50 p-4 text-xs text-primary">
        <ShieldCheck className="size-5 shrink-0" />
        <p>
          A senha só é consultada ao clicar no olho ou em copiar. Cada acesso é auditado pelo ERP,
          não passa pelo cache de consultas e some da tela após 30 segundos.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="panel p-4">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {kpi.label}
            </p>
            <p className="mt-1 text-xl font-semibold break-words tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      <section className="panel mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              aria-label="Buscar credenciais"
              placeholder="Buscar equipamento, host, usuário ou observação..."
              className="w-full bg-transparent text-xs outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar por provedor"
            className="native-select lg:w-48"
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          >
            {providers.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <select
            aria-label="Filtrar por tipo"
            className="native-select lg:w-40"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {types.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <Button variant="outline" onClick={clearFilters}>
            Limpar
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {new Set(filtered.map((item) => text(item.provider))).size} provedores na seleção · Última
          atualização: {latest}
        </p>
      </section>

      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="panel min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-5">
            <div>
              <h2 className="section-title">Inventário de credenciais</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Selecione uma linha para ver os dados de acesso ao lado.
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {filtered.length} registros
            </span>
          </div>
          {grouped.map(([group, rows]) => {
            const meta = typeMeta(group);
            const Icon = meta.icon;
            return (
              <div key={group}>
                <div className="flex items-center gap-2 border-y border-border bg-muted/60 px-5 py-2.5">
                  <Icon className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{group}</h3>
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                    {rows.length} {rows.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                {rows.map((item) => {
                  const active = selected?.id === item.id;
                  const select = () => setSelectedId(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={select}
                      className={cn(
                        'grid cursor-pointer grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_auto] items-center gap-3 border-b border-border px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 focus-within:bg-muted/50 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_auto]',
                        active && 'bg-primary/5',
                      )}
                    >
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={select}
                        className="min-w-0 rounded text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <span className="block truncate text-sm font-semibold">
                          {text(item.equipmentName, text(item.host))}
                        </span>
                        <span className="block truncate text-xs text-primary">
                          {text(item.provider)}
                        </span>
                      </button>
                      <p
                        className="hidden truncate font-mono text-xs md:block"
                        title={text(item.host)}
                      >
                        {text(item.host)}
                      </p>
                      <p
                        className="truncate font-mono text-xs text-muted-foreground"
                        title={text(item.username)}
                      >
                        {text(item.username)}
                      </p>
                      <div className="flex gap-1.5">
                        <IconButton
                          label="Copiar host"
                          onClick={() => void copy(text(item.host, ''), 'Host')}
                        >
                          <Copy />
                        </IconButton>
                        <IconButton
                          label={revealed?.id === item.id ? 'Ocultar senha' : 'Revelar senha'}
                          active={revealed?.id === item.id}
                          onClick={() => void toggleSecret(item)}
                        >
                          {revealed?.id === item.id ? <EyeOff /> : <Eye />}
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!filtered.length && !query.isLoading && !query.error && (
            <ErpEmpty connected={query.connected} />
          )}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 border-t border-border p-4 text-xs">
              <span>
                Página {page} · {total} registros
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1 || query.isLoading}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  disabled={page * PAGE_SIZE >= total || query.isLoading}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </section>

        {selected && (
          <aside
            className="panel overflow-hidden xl:sticky xl:top-4"
            aria-label="Detalhes da credencial"
          >
            <div className="border-b border-border bg-muted/60 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[10px] font-semibold',
                      typeMeta(selected.equipmentType).chip,
                    )}
                  >
                    {text(selected.equipmentType, 'OUTROS')}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {text(selected.provider)}
                  </span>
                </div>
                <RecordDialog
                  title="Editar credencial"
                  moduleKey="credentials"
                  recordId={selected.id}
                  record={selected}
                  fields={[]}
                  trigger={
                    <span className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
                      Editar
                    </span>
                  }
                />
              </div>
              <h2 className="mt-3 text-lg font-semibold break-words">
                {text(selected.equipmentName, text(selected.host))}
              </h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Ambiente: {text(selected.environment)}
              </p>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <KeyRound className="size-3.5" />
                  Dados de acesso
                </h3>
                <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Host</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 font-mono text-xs break-all">{text(selected.host)}</p>
                      <IconButton
                        label="Copiar host"
                        onClick={() => void copy(text(selected.host, ''), 'Host')}
                      >
                        <Copy />
                      </IconButton>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">
                      Usuário
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 font-mono text-xs break-all">
                        {text(selected.username)}
                      </p>
                      <IconButton
                        label="Copiar usuário"
                        onClick={() => void copy(text(selected.username, ''), 'Usuário')}
                      >
                        <Copy />
                      </IconButton>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Senha</p>
                    <div className="flex items-center justify-between gap-2">
                      <output className="min-w-0 font-mono text-xs break-all select-all">
                        {secret || MASK}
                      </output>
                      <div className="flex gap-1.5">
                        <IconButton
                          label={secret ? 'Ocultar senha' : 'Revelar senha'}
                          active={!!secret}
                          onClick={() => void toggleSecret(selected)}
                        >
                          {secret ? <EyeOff /> : <Eye />}
                        </IconButton>
                        <IconButton label="Copiar senha" onClick={() => void copySecret(selected)}>
                          <Copy />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                  Observações
                </h3>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3 text-sm break-words whitespace-pre-wrap">
                  {notes || <span className="text-muted-foreground">Sem observações.</span>}
                </div>
                {notes.length > LONG_NOTES && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setNotesOpen(true)}
                  >
                    Ver observação completa
                  </Button>
                )}
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <Clock3 className="size-3.5" />
                  Metadados
                </h3>
                <dl className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-3 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Criado em</dt>
                    <dd>{when(selected.createdAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Atualizado em</dt>
                    <dd>{when(selected.updatedAt)}</dd>
                  </div>
                </dl>
              </div>

              <OperationControl
                title="Remover credencial"
                description="Remover definitivamente esta credencial do cofre?"
                path={`/knowledge/credentials/${encodeURIComponent(selected.id)}`}
                method="DELETE"
                roles={['super_admin', 'gerente', 'analista']}
                after={async () => {
                  setSelectedId(null);
                  hideSecret();
                  await query.mutate();
                }}
              />
            </div>
          </aside>
        )}
      </div>

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{text(selected?.equipmentName, text(selected?.host))}</DialogTitle>
            <DialogDescription>Observação completa desta credencial.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted p-4 text-sm break-words whitespace-pre-wrap">
            {notes}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
