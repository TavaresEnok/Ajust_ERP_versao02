'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  ChevronDown,
  LogOut,
  List,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Search,
  X,
  Copy,
  Eye,
  Sun,
  Moon,
  Upload,
  Plus,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const clientes = ['Meganet', 'UltraFibra', 'ConnectFibra'];

type Occurrence = {
  id: string;
  description: string;
  type: string;
  status: string;
  created: string;
  forecast: string;
  lastUpdate: string;
  annotations?: { date: string; text: string }[];
};

type ClientOccurrenceInput = Partial<{
  id: string;
  protocol: string;
  description: string;
  type: string;
  status: string;
  created: string;
  created_at: string;
  forecast: string;
  lastUpdate: string;
  updated_at: string;
  annotations: { id?: string; user?: string; message?: string; createdAt?: string }[];
}>;

type ClientUserInput = Partial<{
  id: string;
  name: string;
  nome: string;
  email: string;
  role: string;
  perfil: string;
  active: boolean;
  status: string;
}>;

export type ClientPortalFallbackProps = {
  occurrences?: ClientOccurrenceInput[];
  users?: ClientUserInput[];
  clientName?: string;
  clientOptions?: string[];
  logoPreview?: string | null;
  loading?: boolean;
  syncing?: boolean;
  onRefresh?: () => void;
  onLogout?: () => void;
  onCopyProtocol?: (protocol: string) => void;
  onLogoUpload?: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddUser?: (user: { name: string; email: string; password: string; role: string }) => void;
  onRemoveUser?: (email: string) => void;
};

const initialUsers: Array<{ nome: string; email: string; perfil: string; status: string }> = [];

const statusConfig: Record<
  string,
  { variant: 'info' | 'success' | 'warning' | 'danger' | 'neutral'; label: string }
> = {
  ABERTA: { variant: 'info', label: 'Aberta' },
  EM_EXECUCAO: { variant: 'warning', label: 'Em Execução' },
  PENDENTE: { variant: 'warning', label: 'Pendente' },
  ENCERRADA: { variant: 'neutral', label: 'Encerrada' },
};

function normalizeStatus(status?: string) {
  const raw = String(status || '')
    .trim()
    .toUpperCase();
  if (raw === 'EM_EXECUCAO' || raw.includes('EXEC')) return 'EM_EXECUCAO';
  if (raw === 'ENCERRADA' || raw.includes('FECH') || raw.includes('CONCLU')) return 'ENCERRADA';
  if (raw === 'PENDENTE' || raw.includes('PEND')) return 'PENDENTE';
  return 'ABERTA';
}

function formatDisplayDate(value?: string) {
  if (!value) return '-';
  const isoish = value.includes(' ') ? value.replace(' ', 'T') : value;
  const date = new Date(isoish);
  if (!Number.isFinite(date.getTime())) return value;
  return date
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace('.', '');
}

function formatDisplayDateTime(value?: string) {
  if (!value) return '-';
  const isoish = value.includes(' ') ? value.replace(' ', 'T') : value;
  const date = new Date(isoish);
  if (!Number.isFinite(date.getTime())) return value;
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
}

function mapOccurrence(input: ClientOccurrenceInput): Occurrence {
  const id = input.protocol || input.id || '#OC-DEMO';
  return {
    id,
    description: input.description || 'Ocorrência sem descrição',
    type: input.type || 'Operacional',
    status: normalizeStatus(input.status),
    created: input.created || formatDisplayDate(input.created_at),
    forecast: input.forecast || '-',
    lastUpdate: input.lastUpdate || formatDisplayDateTime(input.updated_at || input.created_at),
    annotations: Array.isArray(input.annotations)
      ? input.annotations.map((annotation) => ({
          date: formatDisplayDateTime(annotation.createdAt),
          text: annotation.message || 'Atualização registrada.',
        }))
      : undefined,
  };
}

function mapUser(input: ClientUserInput) {
  return {
    nome: input.nome || input.name || 'Usuário',
    email: input.email || 'usuario@provedor.com.br',
    perfil: input.perfil || input.role || 'Visualizador',
    status: input.status === 'INACTIVE' || input.active === false ? 'Inativo' : 'Ativo',
  };
}

function OccStatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || { variant: 'neutral' as const, label: status };
  return (
    <Badge variant={cfg.variant} dot>
      {cfg.label}
    </Badge>
  );
}

export default function ClientPortalFallback(props: ClientPortalFallbackProps = {}) {
  const [currentClient, setCurrentClient] = useState(props.clientName || 'Meganet');
  const [showClientMenu, setShowClientMenu] = useState(false);
  const [tab, setTab] = useState<'ativas' | 'fechadas'>('ativas');
  const [search, setSearch] = useState('');
  const [detailOccurrence, setDetailOccurrence] = useState<Occurrence | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showUserModal, setShowUserModal] = useState(false);
  const [localUsers, setLocalUsers] = useState(initialUsers);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserProfile, setNewUserProfile] = useState('Operador');

  useEffect(() => {
    if (props.clientName) setCurrentClient(props.clientName);
  }, [props.clientName]);

  const occurrenceRows = useMemo(
    () => (Array.isArray(props.occurrences) ? props.occurrences.map(mapOccurrence) : []),
    [props.occurrences],
  );
  const userRows = useMemo(
    () => (Array.isArray(props.users) ? props.users.map(mapUser) : localUsers),
    [props.users, localUsers],
  );
  const clientOptions = props.clientOptions?.length
    ? props.clientOptions
    : [currentClient, ...clientes.filter((c) => c !== currentClient)];
  const logoSrc = props.logoPreview || logoPreview;

  const activeOccurrences = occurrenceRows.filter((o) => o.status !== 'ENCERRADA');
  const closedOccurrences = occurrenceRows.filter((o) => o.status === 'ENCERRADA');
  const monthOpened = occurrenceRows.filter((o) => o.status !== 'ENCERRADA').length;
  const monthClosed = closedOccurrences.length;

  const filtered = (tab === 'ativas' ? activeOccurrences : closedOccurrences).filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.id.toLowerCase().includes(q) ||
      o.description.toLowerCase().includes(q) ||
      o.type.toLowerCase().includes(q)
    );
  });

  const handleCopy = (text: string) => {
    props.onCopyProtocol?.(text);
    navigator.clipboard?.writeText?.(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    props.onLogoUpload?.(e);
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAddUser = () => {
    if (!newUserName || !newUserEmail) return;
    props.onAddUser?.({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      role: newUserProfile,
    });
    if (!props.onAddUser) {
      setLocalUsers((prev) => [
        ...prev,
        { nome: newUserName, email: newUserEmail, perfil: newUserProfile, status: 'Ativo' },
      ]);
    }
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserProfile('Operador');
    setShowUserModal(false);
  };

  const handleRemoveUser = (email: string) => {
    props.onRemoveUser?.(email);
    if (!props.onRemoveUser) {
      setLocalUsers((prev) => prev.filter((u) => u.email !== email));
    }
  };

  return (
    <div className={cn('min-h-screen bg-bg-app transition-colors', theme === 'dark' && 'dark')}>
      <header className="h-14 bg-white border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-DEFAULT flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-semibold text-content-primary text-sm">Ajust ERP</span>
        </div>

        <div className="flex items-center gap-1">
          <div className="relative mr-2">
            <button
              onClick={() => setShowClientMenu(!showClientMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-bg-subtle rounded-md text-sm text-content-primary font-medium border border-[rgba(0,0,0,0.06)] hover:bg-bg-hover transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-[#16a34a]" />
              {currentClient}
              <ChevronDown className="w-3.5 h-3.5 text-content-tertiary" />
            </button>
            {showClientMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-[rgba(0,0,0,0.08)] py-1 z-30 animate-fade-in">
                {clientOptions.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCurrentClient(c);
                      setShowClientMenu(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm transition-colors',
                      c === currentClient
                        ? 'bg-accent-subtle text-accent-DEFAULT font-medium'
                        : 'text-content-secondary hover:bg-bg-subtle',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-subtle transition-colors text-content-tertiary"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button
            onClick={props.onLogout}
            className="flex items-center gap-1.5 text-sm text-content-secondary hover:text-content-primary transition-colors px-2"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-content-primary tracking-[-0.03em]">
              Painel de Ocorrências
            </h1>
            <p className="text-sm text-content-secondary mt-0.5">
              Visão geral das demandas ativas e histórico
            </p>
          </div>
          <button
            onClick={props.onRefresh}
            disabled={props.syncing || props.loading}
            className="flex items-center gap-2 px-4 py-2 bg-white text-content-primary text-sm font-medium rounded-lg border border-[rgba(0,0,0,0.08)] hover:bg-bg-subtle transition-colors"
          >
            <TrendingUp className="w-4 h-4 text-content-tertiary" />
            {props.syncing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Abertas" value={String(activeOccurrences.length)} icon={List} />
          <KpiCard label="Totais de O.S." value={String(occurrenceRows.length)} icon={BarChart3} />
          <KpiCard label="Entradas no mês" value={String(monthOpened)} icon={TrendingUp} />
          <KpiCard label="Concluídas no mês" value={String(monthClosed)} icon={CheckCircle2} />
        </div>

        <div className="flex items-center gap-1 bg-bg-subtle rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setTab('ativas')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
              tab === 'ativas'
                ? 'bg-white text-content-primary shadow-sm'
                : 'text-content-tertiary hover:text-content-secondary',
            )}
          >
            Ativas
          </button>
          <button
            onClick={() => setTab('fechadas')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
              tab === 'fechadas'
                ? 'bg-white text-content-primary shadow-sm'
                : 'text-content-tertiary hover:text-content-secondary',
            )}
          >
            Fechadas
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por protocolo, descrição, tipo..."
              className="w-full pl-9 pr-4 py-2.5 text-sm text-content-primary border border-[rgba(0,0,0,0.08)] rounded-lg bg-white outline-none focus:border-accent-DEFAULT transition-colors placeholder:text-content-tertiary"
            />
          </div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors',
              showConfig
                ? 'bg-accent-DEFAULT text-white border-accent-DEFAULT'
                : 'bg-white text-content-primary border-[rgba(0,0,0,0.08)] hover:bg-bg-subtle',
            )}
          >
            Configurações
          </button>
        </div>

        {showConfig && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-5">
              <h3 className="text-sm font-semibold text-content-primary mb-4">Logo do Provedor</h3>
              <label className="block border-2 border-dashed border-[rgba(0,0,0,0.1)] rounded-xl p-8 text-center cursor-pointer hover:border-accent-DEFAULT transition-colors">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoSrc} alt="Logo preview" className="max-h-24 mx-auto rounded-lg" />
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-content-tertiary mx-auto mb-2" />
                    <p className="text-sm text-content-secondary font-medium">
                      Clique para fazer upload
                    </p>
                    <p className="text-2xs text-content-tertiary mt-0.5">
                      PNG, JPG ou WebP (até 5 MB)
                    </p>
                  </div>
                )}
              </label>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-content-primary">Usuários</h3>
                <button
                  onClick={() => setShowUserModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-DEFAULT text-white text-xs font-medium rounded-lg hover:bg-accent-hover transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Adicionar Usuário
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(0,0,0,0.06)]">
                      <th className="text-left py-2.5 px-3 text-2xs font-semibold text-content-tertiary uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="text-left py-2.5 px-3 text-2xs font-semibold text-content-tertiary uppercase tracking-wider">
                        Email
                      </th>
                      <th className="text-left py-2.5 px-3 text-2xs font-semibold text-content-tertiary uppercase tracking-wider">
                        Perfil
                      </th>
                      <th className="text-left py-2.5 px-3 text-2xs font-semibold text-content-tertiary uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left py-2.5 px-3 text-2xs font-semibold text-content-tertiary uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRows.map((user) => (
                      <tr key={user.email} className="border-b border-[rgba(0,0,0,0.04)]">
                        <td className="py-2.5 px-3 text-xs font-medium text-content-primary">
                          {user.nome}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-content-secondary">{user.email}</td>
                        <td className="py-2.5 px-3 text-xs text-content-secondary">
                          {user.perfil}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={user.status === 'Ativo' ? 'success' : 'neutral'}
                            dot
                            size="sm"
                          >
                            {user.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => handleRemoveUser(user.email)}
                            className="p-1 rounded hover:bg-[#fef2f2] text-content-tertiary hover:text-[#dc2626] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(0,0,0,0.06)]">
                  <th className="text-left py-2.5 px-4 text-2xs font-semibold text-content-tertiary uppercase tracking-wider">
                    Protocolo
                  </th>
                  <th className="text-left py-2.5 px-4 text-2xs font-semibold text-content-tertiary uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="text-left py-2.5 px-4 text-2xs font-semibold text-content-tertiary uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="text-left py-2.5 px-4 text-2xs font-semibold text-content-tertiary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-2.5 px-4 text-2xs font-semibold text-content-tertiary uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((occ) => (
                  <tr
                    key={occ.id}
                    className="border-b border-[rgba(0,0,0,0.04)] hover:bg-bg-subtle transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-xs text-content-secondary">
                      {occ.id}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-content-primary max-w-[280px] truncate">
                      {occ.description}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-content-secondary">{occ.type}</td>
                    <td className="py-2.5 px-4">
                      <OccStatusBadge status={occ.status} />
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(occ.id)}
                          className="flex items-center gap-1 px-2 py-1 text-2xs font-medium text-content-tertiary hover:text-content-primary bg-bg-subtle rounded-md hover:bg-bg-hover transition-colors"
                        >
                          {copied === occ.id ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-[#16a34a]" />
                              Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copiar
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setDetailOccurrence(occ)}
                          className="flex items-center gap-1 px-2 py-1 text-2xs font-medium text-accent-DEFAULT bg-accent-subtle rounded-md hover:bg-accent-muted transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          Ver detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-content-tertiary">
                      Nenhuma ocorrência encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {detailOccurrence && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
          onClick={() => setDetailOccurrence(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-semibold text-content-primary">
                  {detailOccurrence.id}
                </span>
                <span className="text-xs text-content-tertiary">{detailOccurrence.created}</span>
              </div>
              <button
                onClick={() => setDetailOccurrence(null)}
                className="p-1.5 rounded-md hover:bg-bg-subtle text-content-tertiary hover:text-content-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <OccStatusBadge status={detailOccurrence.status} />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-content-tertiary uppercase tracking-[0.05em] mb-1">
                  Descrição
                </label>
                <p className="text-sm text-content-primary">{detailOccurrence.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-2xs font-semibold text-content-tertiary uppercase tracking-[0.05em] mb-1">
                    Previsão de Finalização
                  </label>
                  <p className="text-sm text-content-primary">{detailOccurrence.forecast}</p>
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-content-tertiary uppercase tracking-[0.05em] mb-1">
                    Última Atualização
                  </label>
                  <p className="text-sm text-content-primary">{detailOccurrence.lastUpdate}</p>
                </div>
              </div>

              {detailOccurrence.annotations?.length ? (
                <div>
                  <label className="block text-2xs font-semibold text-content-tertiary uppercase tracking-[0.05em] mb-2">
                    Histórico de Anotações
                  </label>
                  <div className="relative ml-1">
                    <div className="absolute left-[7px] top-0 bottom-0 w-px bg-[rgba(0,0,0,0.08)]" />
                    <div className="space-y-3">
                      {(detailOccurrence.annotations || []).map((a, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-3.5 h-3.5 rounded-full bg-accent-DEFAULT flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-content-primary">{a.text}</p>
                            <p className="text-2xs text-content-tertiary mt-0.5">{a.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleCopy(detailOccurrence.id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-content-primary border border-[rgba(0,0,0,0.08)] rounded-lg hover:bg-bg-subtle transition-colors"
                >
                  {copied === detailOccurrence.id ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copiar Protocolo
                    </>
                  )}
                </button>
                <button
                  onClick={() => setDetailOccurrence(null)}
                  className="flex-1 py-2 text-xs font-medium text-content-secondary border border-[rgba(0,0,0,0.08)] rounded-lg hover:bg-bg-subtle transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
          onClick={() => setShowUserModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[rgba(0,0,0,0.06)]">
              <h2 className="text-base font-semibold text-content-primary">Adicionar Usuário</h2>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1.5 rounded-md hover:bg-bg-subtle text-content-tertiary hover:text-content-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                  Nome
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full text-sm text-content-primary border border-[rgba(0,0,0,0.08)] rounded-lg px-3 py-2.5 outline-none focus:border-accent-DEFAULT transition-colors placeholder:text-content-tertiary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full text-sm text-content-primary border border-[rgba(0,0,0,0.08)] rounded-lg px-3 py-2.5 outline-none focus:border-accent-DEFAULT transition-colors placeholder:text-content-tertiary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                  Senha
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Senha inicial"
                  className="w-full text-sm text-content-primary border border-[rgba(0,0,0,0.08)] rounded-lg px-3 py-2.5 outline-none focus:border-accent-DEFAULT transition-colors placeholder:text-content-tertiary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1.5">
                  Perfil
                </label>
                <select
                  value={newUserProfile}
                  onChange={(e) => setNewUserProfile(e.target.value)}
                  className="w-full text-sm text-content-primary border border-[rgba(0,0,0,0.08)] rounded-lg px-3 py-2.5 outline-none focus:border-accent-DEFAULT transition-colors"
                >
                  <option value="Admin">Admin</option>
                  <option value="Operador">Operador</option>
                  <option value="Visualizador">Visualizador</option>
                </select>
              </div>

              <button
                onClick={handleAddUser}
                className="w-full py-2.5 bg-accent-DEFAULT text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
              >
                <UserPlus className="w-4 h-4 inline mr-1.5" />
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-content-secondary uppercase tracking-wide">
          {label}
        </span>
        <Icon className="w-4 h-4 text-content-tertiary" />
      </div>
      <div className="text-[28px] font-bold text-content-primary tabular-nums tracking-[-0.03em] leading-none">
        {value}
      </div>
    </div>
  );
}
