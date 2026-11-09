'use client';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  AppWindow,
  ArrowRightLeft,
  Clock3,
  Copy,
  Cpu,
  Eye,
  ExternalLink,
  EyeOff,
  Globe,
  KeyRound,
  Network,
  Search,
  Server,
  Shield,
  ShieldCheck,
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  LayoutGrid,
  List,
  Building2,
  FolderKey,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
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
import { RecordDialog } from './record-dialog';
import { useVaultConfirmation } from './vault-confirmation';
import { CredentialTotp } from './credential-totp';
import { VaultAccessEditor, StructuredAccesses, type VaultAccess } from './vault-access-editor';
import { QueryState } from './contract-form';
import useSWR from 'swr';

const PAGE_SIZE = 200;
const MASK = '••••••••••••';

type TypeMeta = { icon: ComponentType<{ className?: string }>; chip: string };
const TYPE_META: Record<string, TypeMeta> = {
  DNS: {
    icon: Globe,
    chip: 'border-info/25 bg-info/10 text-info',
  },
  OLT: {
    icon: Network,
    chip: 'border-info/25 bg-info/10 text-info',
  },
  FIREWALL: {
    icon: Shield,
    chip: 'border-danger/25 bg-danger/10 text-danger',
  },
  ROUTER: {
    icon: Server,
    chip: 'border-success/25 bg-success/10 text-success',
  },
  SW: {
    icon: ArrowRightLeft,
    chip: 'border-info/25 bg-info/10 text-info',
  },
  SISTEMA: {
    icon: AppWindow,
    chip: 'border-info/25 bg-info/10 text-info',
  },
  VM: { icon: Cpu, chip: 'border-warning/25 bg-warning/10 text-warning' },
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
  if (normalized === 'SERVIDOR') return TYPE_META.VM;
  if (['REDE', 'ENLACE', 'CIRCUITOS'].includes(normalized)) return TYPE_META.OLT;
  return TYPE_META[normalized] || TYPE_META.OUTROS;
}

const text = (value: unknown, fallback = '—') => (value ? String(value) : fallback);
const CATEGORY_ORDER = [
  'OLT',
  'ROUTER',
  'SW',
  'SERVIDOR',
  'SISTEMA',
  'DNS',
  'FIREWALL',
  'REDE',
  'CIRCUITOS',
  'ENLACE',
  'ACESSO REMOTO',
  'A CONFERIR',
  'DOCUMENTO',
];
const categoryOrder = (value: string) =>
  CATEGORY_ORDER.includes(value) ? CATEGORY_ORDER.indexOf(value) : 99;
const when = (value: unknown) => {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('pt-BR') : '—';
};

/** Display explicit labels only. Never infer account/endpoint relationships from position. */
function TechnicalFields({
  content,
  onCopy,
}: {
  content: string;
  onCopy: (value: string, label: string) => void;
}) {
  const lines = content.split('\n');
  const fields: { label: string; value: string }[] = [];
  const labelPattern =
    /^(IP|HOST|URL|ENDEREÇO|PORTA|PORT|LOGIN|USUÁRIO|USUARIO|USERNAME|USER|SENHA|PASSWORD|PASS|DBNAME|DBUSER|SSID|GATEWAY)\s*[:=]\s*(.*)$/i;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(labelPattern);
    if (match && match[2]) fields.push({ label: match[1], value: match[2] });
    else fields.push({ label: '', value: lines[i] });
  }
  return (
    <div className="space-y-2">
      {fields.map((field, index) =>
        field.label ? (
          <div
            key={index}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {field.label}
              </p>
              <p className="mt-1 break-all font-mono text-sm select-all">{field.value}</p>
            </div>
            <IconButton
              label={`Copiar ${field.label}`}
              onClick={() => onCopy(field.value, field.label)}
            >
              <Copy />
            </IconButton>
          </div>
        ) : field.value.trim() ? (
          <p key={index} className="whitespace-pre-wrap break-words text-sm leading-7">
            {field.value}
          </p>
        ) : (
          <div key={index} className="h-2" />
        ),
      )}
    </div>
  );
}

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

function QuickAccess({ onClick, wide }: { onClick: () => void; wide?: boolean }) {
  return (
    <button
      type="button"
      title="Abrir o endereço web deste acesso"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5',
        wide && 'w-full',
      )}
    >
      <ExternalLink />
      Abrir site
    </button>
  );
}

/** Nunca presumir o protocolo de um endereço sem esquema. */
function accessUrl(host: unknown) {
  const raw = String(host || '').trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function CredentialsPage() {
  const { scope, transport } = useErp();
  const action = useErpAction();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [providerMode, setProviderMode] = useState<'cards' | 'table'>('cards');
  const confirmation = useVaultConfirmation();
  const [detailTab, setDetailTab] = useState<'access' | 'notes' | 'history'>('access');
  const [providerSearch, setProviderSearch] = useState('');
  const [deleteChallenge, setDeleteChallenge] = useState<string | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const providerParams = useSearchParams();
  const provider = providerParams.get('provider') || 'Todos';
  const setProvider = (value: string) => {
    const next = new URLSearchParams(window.location.search);
    if (value === 'Todos') next.delete('provider');
    else next.set('provider', value);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${next.size ? `?${next}` : ''}`,
    );
  };
  const [type, setType] = useState('Todos');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; secret: string } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const [protectedContent, setProtectedContent] = useState<string | null>(null);
  const [accessEntries, setAccessEntries] = useState<VaultAccess[]>([]);
  const revealVersion = useRef(0);

  const allowed = !scope || ['super_admin', 'gerente', 'analista'].includes(scope.role);
  const fetched = useSWR(
    allowed && transport && scope && provider !== 'Todos'
      ? ['erp', scope.sessionKey, scope.tenantId, scope.role, 'provider-accesses', provider]
      : null,
    async () => {
      const rows: ErpRecord[] = [];
      for (let offset = 0; offset < 20000; offset += 200) {
        const response = await transport!.request<{ items: ErpRecord[]; total: number }>({
          path: queryPath('/knowledge/credentials', { provider, offset, limit: 200 }),
        });
        rows.push(...response.items);
        if (rows.length >= response.total || response.items.length < 200)
          return { items: rows, total: rows.length };
      }
      throw new Error('Limite de consulta atingido. Solicite revisão do cadastro deste provedor.');
    },
  );
  const query = { ...fetched, connected: !!transport };
  const items = useMemo(() => listRecords(query.data), [query.data]);

  const providerQuery = useErpQuery<unknown>(
    allowed ? '/knowledge/credentials/providers?limit=200' : null,
  );
  const customers = useErpQuery<ErpRecord[]>(allowed ? '/customers' : null);
  const providers = useMemo(
    () => [
      'Todos',
      ...[
        ...new Set([
          ...listRecords(providerQuery.data).map((i) => text(i.provider)),
          ...items.map((i) => text(i.provider)),
          ...(customers.data || [])
            .map((i) => String(i.tradeName || i.legalName || ''))
            .filter(Boolean),
        ]),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    ],
    [items, providerQuery.data, customers.data],
  );
  const types = useMemo(
    () => [
      'Todos',
      ...[...new Set(items.map((i) => text(i.equipmentType, 'OUTROS')))].sort(
        (a, b) => categoryOrder(a) - categoryOrder(b) || a.localeCompare(b, 'pt-BR'),
      ),
    ],
    [items],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (item.parentCredentialId) return false;
      if (type === 'Todos' && item.equipmentType === 'DOCUMENTO' && !q) return false;
      if (provider !== 'Todos' && text(item.provider) !== provider) return false;
      if (type !== 'Todos' && text(item.equipmentType, 'OUTROS') !== type) return false;
      if (!q) return true;
      return [item, ...items.filter((child) => child.parentCredentialId === item.id)].some(
        (entry) =>
          `${entry.equipmentName ?? ''} ${entry.host ?? ''} ${entry.username ?? ''} ${entry.notes ?? ''} ${entry.provider ?? ''}`
            .toLowerCase()
            .includes(q),
      );
    });
  }, [items, search, provider, type]);
  const grouped = useMemo(() => {
    const map = new Map<string, ErpRecord[]>();
    for (const item of filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)) {
      const key = text(item.equipmentType, 'OUTROS');
      map.set(key, [...(map.get(key) || []), item]);
    }
    return [...map.entries()].sort(
      (a, b) => categoryOrder(a[0]) - categoryOrder(b[0]) || a[0].localeCompare(b[0], 'pt-BR'),
    );
  }, [filtered, page]);

  const selected = items.find((item) => item.id === selectedId) || null;
  const rootId = selected?.parentCredentialId || selected?.id;
  const related = items.filter((item) => item.id === rootId || item.parentCredentialId === rootId);
  const secret = revealed && selected && revealed.id === selected.id ? revealed.secret : '';

  function hideSecret() {
    revealVersion.current++;
    setRevealed(null);

    setProtectedContent(null);
    setAccessEntries([]);
  }

  // O segredo só vive em memória: some ao trocar de registro, sair da aba ou após 30 segundos.
  useEffect(() => {
    if (!revealed && protectedContent === null) return;
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
  }, [revealed, protectedContent]);
  useEffect(() => hideSecret, []);

  async function fetchSecret(item: ErpRecord) {
    const body = await confirmation.request();
    if (!body) return null;
    const version = ++revealVersion.current;
    try {
      const response = await action.execute<Record<string, unknown>>({
        path: `/knowledge/credentials/${encodeURIComponent(item.id)}/reveal`,
        body,
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

  // O navegador não preenche formulários de outro site: abre o link, copia o usuário e deixa um
  // atalho para copiar a senha (consulta auditada) logo em seguida. Nada vai na URL.
  async function quickAccess(item: ErpRecord) {
    const url = accessUrl(item.host);
    if (!url) {
      toast.error('Esta credencial não tem um endereço válido (http ou https).');
      return;
    }
    // window.open precisa rodar antes de qualquer await para não ser bloqueado como pop-up.
    window.open(url, '_blank', 'noopener,noreferrer');
    toast('Site aberto. Copie usuário e senha quando necessário.', {
      duration: 30000,
      action: {
        label: 'Copiar senha',
        onClick: () => void copySecret(item),
      },
    });
  }

  function clearFilters() {
    setSearch('');
    setProvider('Todos');
    setType('Todos');
  }

  const notes = text(selected?.notes, '');
  const summary = useErpQuery<{
    total: number;
    lastChange: { at: string; by: string; operation: string; label: string } | null;
  }>('/knowledge/credentials/summary');
  const topStats = [
    {
      label: 'Quantidade de provedores',
      value:
        providerQuery.data === undefined || customers.data === undefined
          ? '…'
          : providers.length - 1,
      icon: Building2,
    },
    {
      label: 'Última alteração',
      value: summary.data?.lastChange
        ? new Date(summary.data.lastChange.at).toLocaleString('pt-BR', {
            timeZone: 'America/Fortaleza',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : summary.data === undefined
          ? '…'
          : 'Sem alterações',
      icon: Clock3,
    },
    { label: 'Itens cadastrados', value: summary.data?.total ?? '—', icon: Server },
  ];
  const history = useErpQuery<ErpRecord[]>(
    selectedId && detailTab === 'history' ? `/knowledge/credentials/${selectedId}/history` : null,
  );
  const inventory = items.filter(
    (item) => !item.parentCredentialId && item.equipmentType !== 'DOCUMENTO',
  );
  const categoryName = (value: string) =>
    ({
      Todos: 'Todos os acessos',
      ROUTER: 'Roteadores',
      SW: 'Switches',
      OLT: 'OLTs e GPON',
      SISTEMA: 'Sistemas',
      SERVIDOR: 'Servidores',
      DNS: 'DNS',
      REDE: 'Rede e prefixos',
      CIRCUITOS: 'Links e operadoras',
      ENLACE: 'Enlaces',
      FIREWALL: 'Firewall e CGNAT',
      DOCUMENTO: 'Documentos originais',
      'A CONFERIR': 'A conferir',
      'ACESSO REMOTO': 'Acesso remoto',
    })[value] || value;
  const choose = (item: ErpRecord) => {
    hideSecret();
    setDetailTab('access');
    setSelectedId(item.id);
  };
  const smallCopy = (value: unknown, label: string) =>
    value ? (
      <IconButton label={label} onClick={() => void copy(String(value), label)}>
        <Copy />
      </IconButton>
    ) : null;
  if (provider === 'Todos')
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
              <ShieldCheck className="size-4" />
              CENTRAL DE ACESSOS
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Cofre dos provedores</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A infraestrutura dos seus clientes, organizada em um só lugar.
            </p>
          </div>
          <RecordDialog title="Novo equipamento ou sistema" moduleKey="credentials" fields={[]} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {topStats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <span className="rounded-xl bg-primary/5 p-3 text-primary">
                <stat.icon className="size-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p
                  className={cn(
                    'mt-1 font-semibold tabular-nums',
                    stat.label === 'Última alteração' ? 'text-sm' : 'text-xl',
                  )}
                >
                  {stat.value}
                </p>
                {stat.label === 'Última alteração' && summary.data?.lastChange && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {summary.data.lastChange.label} · {summary.data.lastChange.by}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
            <h2 className="font-semibold">Qual provedor você vai atender?</h2>
            <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
              {(
                [
                  { mode: 'cards', label: 'Cartões', icon: LayoutGrid },
                  { mode: 'table', label: 'Tabela', icon: List },
                ] as const
              ).map((option) => (
                <button
                  key={option.mode}
                  aria-label={`Visualizar provedores em ${option.label.toLowerCase()}`}
                  aria-pressed={providerMode === option.mode}
                  onClick={() => setProviderMode(option.mode)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-2 text-xs',
                    providerMode === option.mode
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-muted-foreground',
                  )}
                >
                  <option.icon className="size-3.5" />
                  {option.label}
                </button>
              ))}
            </div>
            <label className="flex w-full items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 sm:w-80">
              <Search className="size-4 text-muted-foreground" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                aria-label="Buscar provedor"
                placeholder="Buscar provedor..."
                value={providerSearch}
                onChange={(e) => setProviderSearch(e.target.value)}
              />
            </label>
          </div>
          <QueryState
            loading={providerQuery.isLoading}
            error={providerQuery.error}
            onRetry={() => void providerQuery.mutate()}
          />
          {providerMode === 'table' && (
            <div className="grid grid-cols-[minmax(0,1fr)_85px_90px] gap-3 border-b border-border bg-muted/30 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Provedor</span>
              <span>Itens</span>
              <span className="text-right">Acesso</span>
            </div>
          )}
          <div
            className={
              providerMode === 'cards'
                ? 'grid gap-4 bg-background/30 p-5 sm:grid-cols-2 xl:grid-cols-3'
                : 'divide-y divide-border'
            }
          >
            {providers
              .filter(
                (p) => p !== 'Todos' && p.toLowerCase().includes(providerSearch.toLowerCase()),
              )
              .map((p) => {
                const summary = listRecords(providerQuery.data).find((row) => row.provider === p);
                return (
                  <button
                    key={p}
                    className={cn(
                      'group bg-card text-left transition focus-visible:outline-2 focus-visible:outline-primary',
                      providerMode === 'cards'
                        ? 'flex min-h-48 flex-col items-start rounded-2xl border border-border p-5 hover:border-primary/40 hover:shadow-md'
                        : 'grid w-full grid-cols-[minmax(0,1fr)_85px_90px] items-center gap-3 px-5 py-4 hover:bg-muted/40',
                    )}
                    onClick={() => {
                      setProvider(p);
                      setPage(1);
                      setSelectedId(null);
                      setSearch('');
                      setType('Todos');
                    }}
                  >
                    {providerMode === 'cards' ? (
                      <>
                        <span className="mb-4 flex w-full items-center justify-between">
                          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Building2 className="size-5" />
                          </span>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
                            {Number(summary?.total || 0)} itens
                          </span>
                        </span>
                        <span className="block w-full truncate text-sm font-semibold group-hover:text-primary">
                          {p}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          {Number(summary?.equipmentTypeCount || 0)} categorias · equipamentos e
                          sistemas
                        </span>
                        <span className="mt-4 flex w-full items-center justify-between border-t border-border pt-3 text-xs font-semibold text-primary">
                          Acessar cofre <span>→</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 truncate text-xs font-semibold group-hover:text-primary">
                          {p}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {Number(summary?.total || 0)}
                        </span>
                        <span className="text-right text-xs font-semibold text-primary">
                          Abrir →
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
          </div>
          {!providerQuery.isLoading &&
            !customers.isLoading &&
            !providers.some(
              (p) => p !== 'Todos' && p.toLowerCase().includes(providerSearch.toLowerCase()),
            ) && (
              <p className="p-10 text-center text-sm text-muted-foreground">
                Nenhum provedor encontrado.
              </p>
            )}
        </section>
      </div>
    );
  return (
    <>
      {confirmation.dialog}
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              aria-label="Trocar provedor"
              onClick={() => {
                hideSecret();
                clearFilters();
                setSelectedId(null);
              }}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
              {provider.slice(0, 2)}
            </div>
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Cofre do provedor
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Acessos · {provider}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-success/20 bg-success/5 px-3 py-1.5 text-xs text-success md:flex">
              <ShieldCheck className="size-3.5" />
              Consultas auditadas
            </span>
            <RecordDialog title="Novo equipamento ou sistema" moduleKey="credentials" fields={[]} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {topStats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4"
            >
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p
                  className={cn(
                    'mt-1 font-semibold tabular-nums',
                    stat.label === 'Última alteração' ? 'text-sm' : 'text-xl',
                  )}
                >
                  {stat.value}
                </p>
                {stat.label === 'Última alteração' && summary.data?.lastChange && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {summary.data.lastChange.operation === 'delete'
                      ? 'Exclusão'
                      : summary.data.lastChange.operation === 'create'
                        ? 'Novo cadastro'
                        : summary.data.lastChange.label}{' '}
                    · {summary.data.lastChange.by}
                  </p>
                )}
              </div>
              <stat.icon className="size-5 text-primary/60" />
            </div>
          ))}
        </div>
        <QueryState
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.mutate()}
        />
        <div className="grid items-start gap-5 lg:grid-cols-[215px_minmax(0,1fr)]">
          <nav
            aria-label="Categorias do cofre"
            className="flex min-w-0 gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-3 lg:sticky lg:top-4 lg:block lg:space-y-1"
          >
            <p className="hidden px-3 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:block">
              Explorar inventário
            </p>
            {types.map((category) => {
              const Icon = typeMeta(category).icon;
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={type === category}
                  onClick={() => {
                    setType(category);
                    setPage(1);
                  }}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-ring lg:w-full lg:whitespace-normal',
                    type === category
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{categoryName(category)}</span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] tabular-nums',
                      type === category ? 'bg-primary/10' : 'bg-muted',
                    )}
                  >
                    {category === 'Todos'
                      ? inventory.length
                      : items.filter((i) => !i.parentCredentialId && i.equipmentType === category)
                          .length}
                  </span>
                </button>
              );
            })}
            <div className="mt-4 hidden border-t border-border px-3 pt-4 pb-2 lg:block">
              <ShieldCheck className="mb-2 size-5 text-primary" />
              <p className="text-xs font-medium">Acesso com rastreabilidade</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                Senhas são consultadas sob demanda e ocultadas automaticamente.
              </p>
            </div>
          </nav>
          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="font-semibold">Equipamentos e sistemas</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {categoryName(type)} <span className="mx-1">·</span> {filtered.length} registros
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
                {(
                  [
                    { mode: 'table', icon: List, label: 'Tabela' },
                    { mode: 'cards', icon: LayoutGrid, label: 'Cartões' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.mode}
                    aria-label={option.label}
                    aria-pressed={viewMode === option.mode}
                    onClick={() => setViewMode(option.mode)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
                      viewMode === option.mode
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground',
                    )}
                  >
                    <option.icon className="size-3.5" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
              <label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                <Search className="size-4 text-muted-foreground" />
                <input
                  aria-label="Buscar credenciais"
                  placeholder="Buscar nome, IP, usuário ou orientação..."
                  className="w-full bg-transparent text-xs outline-none"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setType('Todos');
                  setPage(1);
                }}
              >
                Limpar
              </Button>
            </div>
            {viewMode === 'cards' ? (
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => {
                  const Icon = typeMeta(item.equipmentType).icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => choose(item)}
                      className="group flex flex-col rounded-xl border border-border bg-muted/10 p-4 text-left transition hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <span
                          className={cn('rounded-lg border p-2', typeMeta(item.equipmentType).chip)}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {categoryName(String(item.equipmentType))}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold group-hover:text-primary">
                        {text(item.equipmentName)}
                      </h3>
                      <p className="mt-2 truncate font-mono text-xs text-muted-foreground">
                        {text(item.host, 'Valores na ficha protegida')}
                      </p>
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                        <span className="truncate text-muted-foreground">
                          {text(item.username, 'Consultar orientações')}
                        </span>
                        <ArrowUpRight className="size-4 text-primary" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,.75fr)_90px] gap-4 bg-muted/30 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="text-primary">Ativo / Equipamento</span>
                    <span className="text-warning">Host / Endereço IP / URL</span>
                    <span className="text-info">Usuário Autenticado</span>
                    <span className="text-right">Detalhes</span>
                  </div>
                  {grouped.map(([group, rows]) => {
                    const Icon = typeMeta(group).icon;
                    return (
                      <div key={group}>
                        <div className="flex items-center gap-2 border-y border-border bg-muted/40 px-5 py-2.5">
                          <Icon className="size-3.5 text-primary" />
                          <h3 className="text-xs font-semibold">{categoryName(group)}</h3>
                          <span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {rows.length}
                          </span>
                        </div>
                        {rows.map((item) => (
                          <div
                            key={item.id}
                            className="group grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,.75fr)_90px] items-center gap-4 border-b border-border/50 px-5 py-3.5 transition hover:bg-primary/[0.025]"
                          >
                            <button
                              className="min-w-0 text-left focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => choose(item)}
                            >
                              <span className="block truncate text-xs font-semibold group-hover:text-primary">
                                {text(item.equipmentName)}
                              </span>
                              <span className="mt-1 block text-[10px] text-muted-foreground">
                                {text(item.accessMethod) === 'SEM_ACESSO'
                                  ? 'Informação técnica'
                                  : text(item.accessMethod) === 'OUTROS'
                                    ? 'Acessos e orientações'
                                    : text(item.accessMethod)}{' '}
                                · {provider}
                              </span>
                            </button>
                            <div className="flex min-w-0 items-center gap-1">
                              <span
                                className="truncate font-mono text-[11px] text-muted-foreground"
                                title={text(item.host)}
                              >
                                {text(item.host, 'Consultar acesso')}
                              </span>
                              {smallCopy(item.host, 'Copiar host')}
                            </div>
                            <div className="flex min-w-0 items-center gap-1">
                              <span className="truncate font-mono text-[11px] text-muted-foreground">
                                {text(item.username)}
                              </span>
                              {smallCopy(item.username, 'Copiar usuário')}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => choose(item)}>
                              Ver acesso
                              <ChevronRight className="size-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!filtered.length && !query.isLoading && !query.error && (
              <div className="p-12 text-center">
                <Search className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">Nenhum registro encontrado</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tente outra busca ou categoria.
                </p>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border bg-muted/10 px-4 py-3 text-[11px] text-muted-foreground">
              <span>
                {filtered.length} registros · {provider}
              </span>
              {filtered.length > PAGE_SIZE && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page * PAGE_SIZE >= filtered.length}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              )}
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3" />
                Cofre Ajust
              </span>
            </div>
          </section>
        </div>

        <Dialog
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) {
              hideSecret();
              setSelectedId(null);
            }
          }}
        >
          {selected && (
            <DialogContent
              className="top-0 right-0 left-auto h-dvh w-full max-w-full translate-x-0 translate-y-0 overflow-y-auto rounded-none border-l border-border p-0 sm:max-w-2xl block"
              aria-label="Detalhes da credencial"
            >
              <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5 pr-12">
                <DialogTitle className="text-xl font-semibold">
                  {text(selected.equipmentName, text(selected.host))}
                </DialogTitle>
                <DialogDescription>
                  {text(selected.provider)} · Acessos e documentação técnica
                </DialogDescription>
              </DialogHeader>
              <div className="border-b border-border p-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    hideSecret();
                    setSelectedId(null);
                  }}
                >
                  Fechar detalhes
                </Button>
                {related.length > 1 &&
                  related.map((r) => (
                    <Button
                      key={r.id}
                      variant={selected.id === r.id ? 'default' : 'outline'}
                      onClick={() => {
                        hideSecret();
                        setSelectedId(r.id);
                      }}
                    >
                      {text(r.accessMethod, 'OUTROS')} · {text(r.username)}
                    </Button>
                  ))}
              </div>
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
                  <VaultAccessEditor
                    key={selected.id}
                    record={selected}
                    providers={providers}
                    onOpen={hideSecret}
                    onSaved={async () => {
                      hideSecret();
                      await query.mutate();
                      await summary.mutate();
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Ambiente: {text(selected.environment)}
                </p>
              </div>
              <div
                className="sticky top-0 z-10 flex gap-6 border-b border-border bg-card px-6"
                role="tablist"
                aria-label="Detalhes do acesso"
              >
                {(
                  [
                    { key: 'access', label: 'Acessos' },
                    { key: 'notes', label: 'Orientações' },
                    { key: 'history', label: 'Histórico' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    id={`vault-tab-${tab.key}`}
                    role="tab"
                    aria-selected={detailTab === tab.key}
                    aria-controls={`vault-panel-${tab.key}`}
                    tabIndex={detailTab === tab.key ? 0 : -1}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                        event.preventDefault();
                        const keys = ['access', 'notes', 'history'] as const;
                        const index = keys.indexOf(detailTab);
                        const key = keys[(index + (event.key === 'ArrowRight' ? 1 : 2)) % 3];
                        setDetailTab(key);
                        document.getElementById(`vault-tab-${key}`)?.focus();
                      }
                    }}
                    onClick={() => setDetailTab(tab.key)}
                    className={cn(
                      'border-b-2 py-4 text-xs font-semibold',
                      detailTab === tab.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="space-y-5 p-6">
                <div
                  id="vault-panel-access"
                  role="tabpanel"
                  aria-labelledby="vault-tab-access"
                  hidden={detailTab !== 'access'}
                  className="flex flex-col gap-5"
                >
                  <section className="order-2 rounded-xl border border-primary/15 bg-primary/[0.025] p-4 space-y-3">
                    {protectedContent === null ? (
                      <Button
                        variant="outline"
                        disabled={action.pending}
                        onClick={async () => {
                          const body = await confirmation.request();
                          if (!body) return;
                          const version = ++revealVersion.current;
                          try {
                            const result = await action.execute<{
                              protectedContent?: string;
                              accessEntries: VaultAccess[];
                            }>({
                              path: `/knowledge/credentials/${selected.id}/reveal`,
                              body,
                              method: 'POST',
                            });
                            if (version === revealVersion.current) {
                              setProtectedContent(result.protectedContent || '');
                              setAccessEntries(result.accessEntries || []);
                            }
                          } catch (e) {
                            toast.error(errorMessage(e));
                          }
                        }}
                      >
                        Consultar dados adicionais
                      </Button>
                    ) : (
                      <>
                        {!!accessEntries.length && <StructuredAccesses entries={accessEntries} />}
                        {!accessEntries.length ? (
                          <TechnicalFields
                            content={protectedContent || 'Nenhum dado adicional cadastrado.'}
                            onCopy={(value, label) => void copy(value, label)}
                          />
                        ) : (
                          <details>
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              Texto de referência preservado
                            </summary>
                            <div className="mt-3">
                              <TechnicalFields
                                content={protectedContent}
                                onCopy={(value, label) => void copy(value, label)}
                              />
                            </div>
                          </details>
                        )}
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={hideSecret}>
                            Ocultar
                          </Button>
                        </div>
                      </>
                    )}
                  </section>
                  <section
                    hidden={accessEntries.length > 0}
                    className="order-1 space-y-4 rounded-2xl border border-border bg-muted/30 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase">
                        <KeyRound className="size-4 text-primary" />
                        Autenticação direta
                      </h3>
                      <span className="rounded bg-primary/5 px-2 py-1 text-[10px] font-mono text-primary">
                        {selected.accessMethod === 'OUTROS'
                          ? 'ACESSO'
                          : text(selected.accessMethod)}
                      </span>
                    </div>
                    {[
                      {
                        label: 'Host / IP / URL de acesso',
                        value: text(selected.host, 'Não informado'),
                        color: 'text-warning',
                        copy: 'Copiar host',
                      },
                      {
                        label: 'Usuário / login',
                        value: text(selected.username, 'Não informado'),
                        color: 'text-info',
                        copy: 'Copiar usuário',
                      },
                    ].map((field) => (
                      <div key={field.label}>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          {field.label}
                        </p>
                        <div className="flex items-center gap-2">
                          <output
                            className={cn(
                              'min-w-0 flex-1 break-all rounded-xl border border-border bg-card px-3 py-2.5 font-mono text-xs select-all',
                              field.color,
                            )}
                          >
                            {field.value}
                          </output>
                          <IconButton
                            label={field.copy}
                            onClick={() => void copy(field.value, field.label)}
                          >
                            <Copy />
                          </IconButton>
                        </div>
                      </div>
                    ))}
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                        Senha de acesso criptografada
                      </p>
                      <div className="flex items-center gap-2">
                        <output className="min-w-0 flex-1 break-all rounded-xl border border-border bg-card px-3 py-2.5 font-mono text-xs select-all">
                          {secret || MASK}
                        </output>
                        <IconButton
                          label={secret ? 'Ocultar senha' : 'Revelar senha'}
                          onClick={() => void toggleSecret(selected)}
                        >
                          {secret ? <EyeOff /> : <Eye />}
                        </IconButton>
                        <IconButton label="Copiar senha" onClick={() => void copySecret(selected)}>
                          <Copy />
                        </IconButton>
                      </div>
                    </div>
                    {accessUrl(selected.host) && (
                      <QuickAccess onClick={() => void quickAccess(selected)} />
                    )}
                  </section>
                  <div className="order-3">
                    <CredentialTotp
                      key={selected.id}
                      id={selected.id}
                      configured={!!selected.hasTotp}
                    />
                  </div>
                </div>
                <div
                  id="vault-panel-notes"
                  role="tabpanel"
                  aria-labelledby="vault-tab-notes"
                  hidden={detailTab !== 'notes'}
                >
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                    Orientações e particularidades deste acesso
                  </h3>
                  <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-7 break-words whitespace-pre-wrap">
                    {notes || <span className="text-muted-foreground">Sem observações.</span>}
                  </div>
                  {!!selected.parentCredentialId && (
                    <div className="mt-4">
                      <h3 className="font-semibold text-sm mb-2">
                        Orientações do acesso principal
                      </h3>
                      <p className="whitespace-pre-wrap break-words text-sm leading-7">
                        {text(
                          items.find((i) => i.id === selected.parentCredentialId)?.notes,
                          'Sem orientações gerais.',
                        )}
                      </p>
                    </div>
                  )}
                  {notes && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setNotesOpen(true)}
                    >
                      Mais detalhes
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

                <section
                  id="vault-panel-history"
                  role="tabpanel"
                  aria-labelledby="vault-tab-history"
                  hidden={detailTab !== 'history'}
                >
                  <h3 className="font-semibold">Atividade deste cadastro</h3>
                  <p className="mb-4 mt-1 text-xs text-muted-foreground">
                    Últimos 100 eventos registrados no cofre.
                  </p>
                  <QueryState
                    loading={history.isLoading}
                    error={history.error}
                    onRetry={() => void history.mutate()}
                  />
                  <ol className="space-y-0">
                    {(history.data || []).map((event) => (
                      <li key={event.id} className="relative ml-2 border-l border-border py-4 pl-6">
                        <span className="absolute -left-1 top-5 size-2 rounded-full bg-primary" />
                        <p className="text-sm font-medium">
                          {(
                            {
                              create: 'Cadastro criado',
                              update: 'Cadastro editado',
                              delete: 'Cadastro excluído',
                              reveal: 'Conteúdo protegido consultado',
                              totp: 'Código 2FA consultado',
                            } as Record<string, string>
                          )[String(event.operation)] || 'Atividade registrada'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {String(event.actor)} · {when(event.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ol>
                  {!history.isLoading && !history.error && !history.data?.length && (
                    <p className="py-6 text-sm text-muted-foreground">Nenhum evento encontrado.</p>
                  )}
                </section>

                <Button
                  variant="outline"
                  className="w-full border-danger/20 text-danger hover:bg-danger/5"
                  onClick={() => {
                    const bytes = new Uint32Array(1);
                    crypto.getRandomValues(bytes);
                    setDeleteChallenge(String((bytes[0] % 900000) + 100000));
                    setDeleteInput('');
                  }}
                >
                  Excluir
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
      <Dialog
        open={deleteChallenge !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteChallenge(null);
            setDeleteInput('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir este cadastro?</DialogTitle>
            <DialogDescription>
              Esta ação remove o cadastro do cofre. A exclusão ficará registrada no histórico.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            Para confirmar, digite o código{' '}
            <strong className="font-mono text-lg tracking-widest">{deleteChallenge}</strong>.
          </p>
          <input
            aria-label="Código de confirmação para excluir"
            autoComplete="off"
            className="rounded-xl border border-border bg-background p-3 font-mono tracking-widest"
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteChallenge(null)}>
              Cancelar
            </Button>
            <Button
              disabled={deleteInput !== deleteChallenge || action.pending}
              className="bg-danger text-white hover:bg-danger"
              onClick={async () => {
                if (!selected || deleteInput !== deleteChallenge) return;
                try {
                  await action.execute({
                    path: `/knowledge/credentials/${selected.id}`,
                    method: 'DELETE',
                  });
                  setDeleteChallenge(null);
                  hideSecret();
                  setSelectedId(null);
                  await query.mutate();
                  await summary.mutate();
                  toast.success('Cadastro excluído.');
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Confirmar exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
