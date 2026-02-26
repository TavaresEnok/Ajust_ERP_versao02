'use client';

import React, { useEffect, useMemo, useState } from 'react';

type TenantUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

type TenantForm = {
  legalName: string;
  tradeName: string;
  taxId: string;
  slug: string;
  domain: string;
  timezone: string;
  techContactName: string;
  techContactEmail: string;
  techContactPhone: string;
  status: string;
};

type NewTenantUserForm = {
  name: string;
  email: string;
  password: string;
  roleCode: string;
};

type TenantManagementViewModuleProps = {
  tenants: any[];
  orders: any[];
  notify?: (message: string) => void;
  onReloadTenants?: () => Promise<void> | void;
  helpers: any;
};

export function TenantManagementViewModule({ tenants, orders, notify, onReloadTenants, helpers }: TenantManagementViewModuleProps) {
  const {
    useTheme,
    Search,
    RefreshCw,
    Plus,
    Badge,
    Modal,
    formatNumber,
    formatDate,
    isActive,
    slugify,
    readApiErrorMessage,
    mapApiTenantUser,
    ROLE_CODE_TO_LABEL,
  } = helpers;

  const { dark } = useTheme();
  const [search, setSearch] = useState('');
  const [integrationFilter, setIntegrationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('active_desc');
  const [editingTenant, setEditingTenant] = useState<any | null>(null);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [userTenant, setUserTenant] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([
    { code: 'analista', name: 'Analista' },
    { code: 'tecnico', name: 'Técnico' },
    { code: 'cliente', name: 'Cliente' },
    { code: 'leitura', name: 'Leitura' },
  ]);
  const [tenantUsersByTenant, setTenantUsersByTenant] = useState<Record<string, TenantUser[]>>({});

  const buildNewTenant = (): TenantForm => ({
    legalName: '',
    tradeName: '',
    taxId: '',
    slug: '',
    domain: '',
    timezone: 'America/Sao_Paulo',
    techContactName: '',
    techContactEmail: '',
    techContactPhone: '',
    status: 'ACTIVE',
  });

  const [newTenant, setNewTenant] = useState<TenantForm>(buildNewTenant);
  const [newUser, setNewUser] = useState<NewTenantUserForm>({
    name: '',
    email: '',
    password: '',
    roleCode: 'analista',
  });

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await fetch('/api/iam/roles', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        if (!Array.isArray(payload)) return;
        const mapped = payload.map((role: any) => ({ code: role.code, name: role.name || ROLE_CODE_TO_LABEL[role.code] || role.code }));
        if (mapped.length > 0) {
          setAvailableRoles(mapped);
          setNewUser((prev) => ({ ...prev, roleCode: mapped[0].code }));
        }
      } catch { }
    };
    loadRoles();
  }, []);

  const fetchTenantUsers = async (targetTenantId: string): Promise<TenantUser[]> => {
    if (!targetTenantId) return [];
    const response = await fetch(`/api/iam/users?tenantId=${encodeURIComponent(targetTenantId)}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response, 'Falha ao carregar usuarios do tenant.'));
    }
    const payload = await response.json();
    const mapped = (Array.isArray(payload) ? payload.map(mapApiTenantUser) : []) as TenantUser[];
    setTenantUsersByTenant((prev) => ({ ...prev, [targetTenantId]: mapped }));
    return mapped;
  };

  const enriched = useMemo(
    () =>
      tenants.map((t: any) => {
        const own = orders.filter((o: any) => o.provider === t.name);
        const activeOrders = own.filter(isActive).length;
        const users = tenantUsersByTenant[t.id] || [];
        return { ...t, totalOrders: own.length, activeOrders, users };
      }),
    [tenants, orders, tenantUsersByTenant]
  );

  const stats = useMemo(() => {
    const total = enriched.length;
    const integrated = enriched.filter((t) => t.sgpConfigured).length;
    const withActive = enriched.filter((t) => t.activeOrders > 0).length;
    const activeOrdersTotal = enriched.reduce((acc: number, t: any) => acc + t.activeOrders, 0);
    return { total, integrated, pending: total - integrated, withActive, activeOrdersTotal };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = [...enriched].filter((t: any) => !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || (t.cpfCnpj || '').toLowerCase().includes(q));

    if (integrationFilter === 'integrated') list = list.filter((t) => t.sgpConfigured);
    if (integrationFilter === 'pending') list = list.filter((t) => !t.sgpConfigured);
    if (integrationFilter === 'with_active') list = list.filter((t) => t.activeOrders > 0);

    if (sortBy === 'name_asc') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (sortBy === 'name_desc') list.sort((a, b) => b.name.localeCompare(a.name, 'pt-BR'));
    if (sortBy === 'active_desc') list.sort((a, b) => b.activeOrders - a.activeOrders);
    if (sortBy === 'created_desc') list.sort((a, b) => b.createdAt - a.createdAt);

    return list;
  }, [enriched, search, integrationFilter, sortBy]);

  const saveTenant = () => {
    if (!editingTenant || busy) return;
    (async () => {
      setBusy(true);
      try {
        const response = await fetch(`/api/iam/tenants/${encodeURIComponent(editingTenant.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            legalName: editingTenant.legalName,
            tradeName: editingTenant.tradeName,
            taxId: editingTenant.taxId,
            slug: editingTenant.slug,
            domain: editingTenant.domain,
            timezone: editingTenant.timezone,
            techContactName: editingTenant.techContactName,
            techContactEmail: editingTenant.techContactEmail,
            techContactPhone: editingTenant.techContactPhone,
            status: editingTenant.status,
          }),
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao atualizar tenant.'));
        }
        notify?.('Tenant atualizado.');
        setEditingTenant(null);
        await onReloadTenants?.();
      } catch (error) {
        notify?.(error instanceof Error ? error.message : 'Falha ao atualizar tenant.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const createTenant = () => {
    if (busy) return;
    if (!newTenant.tradeName.trim() || !newTenant.taxId.trim() || !newTenant.techContactEmail.trim()) {
      notify?.('Preencha nome fantasia, CNPJ/CPF e e-mail tecnico.');
      return;
    }

    const slug = (newTenant.slug || slugify(newTenant.tradeName)).trim();
    const domain = (newTenant.domain || `${slug}.ajust.local`).trim();

    (async () => {
      setBusy(true);
      try {
        const response = await fetch('/api/iam/tenants', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            legalName: newTenant.legalName || newTenant.tradeName,
            tradeName: newTenant.tradeName,
            taxId: newTenant.taxId,
            slug,
            domain,
            timezone: newTenant.timezone,
            techContactName: newTenant.techContactName || 'Contato Técnico',
            techContactEmail: newTenant.techContactEmail,
            techContactPhone: newTenant.techContactPhone || '000000000',
            status: newTenant.status,
          }),
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao criar tenant.'));
        }
        notify?.('Tenant criado com sucesso.');
        setNewTenant(buildNewTenant());
        setCreatingTenant(false);
        await onReloadTenants?.();
      } catch (error) {
        notify?.(error instanceof Error ? error.message : 'Falha ao criar tenant.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const createTenantUser = () => {
    if (!userTenant || busy) return;
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      notify?.('Preencha nome, e-mail e senha do usuario.');
      return;
    }

    (async () => {
      setBusy(true);
      try {
        const response = await fetch('/api/iam/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tenantId: userTenant.id,
            name: newUser.name.trim(),
            email: newUser.email.trim(),
            password: newUser.password,
            roleCode: newUser.roleCode,
          }),
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao criar usuario.'));
        }
        await fetchTenantUsers(userTenant.id);
        setNewUser((prev) => ({ ...prev, name: '', email: '', password: '' }));
        notify?.('Usuário criado no tenant.');
      } catch (error) {
        notify?.(error instanceof Error ? error.message : 'Falha ao criar usuario.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const syncTenantsFromSgp = () => {
    if (busy) return;
    (async () => {
      setBusy(true);
      try {
        const targets = tenants.map((tenant) => tenant.id);
        const results = await Promise.allSettled(
          targets.map((targetTenantId) =>
            fetch('/api/integrations/ixc/reconcile', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ tenantId: targetTenantId }),
            })
          )
        );
        const ok = results.filter((result) => result.status === 'fulfilled' && result.value.ok).length;
        notify?.(`Reconciliação IXC executada em ${ok}/${targets.length} tenants.`);
      } catch (error) {
        notify?.(error instanceof Error ? error.message : 'Falha ao sincronizar tenants.');
      } finally {
        setBusy(false);
      }
    })();
  };

  const openTenantUsers = (tenant: any) => {
    setUserTenant(tenant);
    fetchTenantUsers(tenant.id).catch((error) => notify?.(error instanceof Error ? error.message : 'Falha ao listar usuarios.'));
  };

  const cardClass = dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200';
  const labelClass = dark ? 'text-[10px] uppercase text-slate-500 font-bold tracking-wider' : 'text-[10px] uppercase text-slate-400 font-bold tracking-wider';
  const inputClass = dark
    ? 'w-full border rounded-lg px-3 py-2 mt-1 text-sm bg-[#0d1628]/80 border-slate-700/60 text-slate-100 placeholder:text-slate-500'
    : 'w-full border rounded-lg px-3 py-2 mt-1 text-sm border-slate-300';
  const topBtnClass = dark
    ? 'px-3 py-2 border border-slate-700/60 rounded-lg text-sm font-semibold hover:bg-white/5 flex items-center gap-2 disabled:opacity-50 text-slate-200 bg-[#0d1628]/80'
    : 'px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start gap-3">
        <div>
          <h2 className={dark ? 'text-2xl font-bold text-slate-100' : 'text-2xl font-bold text-slate-900'}>Gestão de Clientes (Tenants)</h2>
          <p className={dark ? 'text-sm text-slate-400' : 'text-sm text-slate-500'}>Cadastro de tenant, usuarios e reconciliacao IXC por tenant.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncTenantsFromSgp} disabled={busy} className={topBtnClass}>
            <RefreshCw size={14} />
            Sync SGP
          </button>
          <button
            onClick={() => setCreatingTenant(true)}
            className={dark
              ? 'px-3 py-2 bg-indigo-500/25 border border-indigo-500/40 text-indigo-100 rounded-lg text-sm font-semibold hover:bg-indigo-500/35 flex items-center gap-2'
              : 'px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2'}
          >
            <Plus size={14} />
            Novo Cliente
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 px-1">
        <div className={`border rounded-xl p-3 md:p-4 ${cardClass}`}>
          <div className={labelClass}>Tenants</div>
          <div className={dark ? 'text-2xl font-bold text-slate-100' : 'text-2xl font-bold text-slate-800'}>{formatNumber(stats.total)}</div>
        </div>
        <div className={`border rounded-xl p-3 md:p-4 ${cardClass}`}>
          <div className={labelClass}>Integrados SGP</div>
          <div className={dark ? 'text-2xl font-bold text-emerald-300' : 'text-2xl font-bold text-emerald-700'}>{formatNumber(stats.integrated)}</div>
        </div>
        <div className={`border rounded-xl p-3 md:p-4 ${cardClass}`}>
          <div className={labelClass}>Pendentes</div>
          <div className={dark ? 'text-2xl font-bold text-amber-300' : 'text-2xl font-bold text-amber-700'}>{formatNumber(stats.pending)}</div>
        </div>
        <div className={`border rounded-xl p-3 md:p-4 ${cardClass}`}>
          <div className={labelClass}>Com Ativos</div>
          <div className={dark ? 'text-2xl font-bold text-blue-300' : 'text-2xl font-bold text-blue-700'}>{formatNumber(stats.withActive)}</div>
        </div>
        <div className={`border rounded-xl p-3 md:p-4 ${cardClass}`}>
          <div className={labelClass}>OS Ativas (global)</div>
          <div className={dark ? 'text-2xl font-bold text-slate-100' : 'text-2xl font-bold text-slate-800'}>{formatNumber(stats.activeOrdersTotal)}</div>
        </div>
      </div>

      <div className={`border rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3 ${cardClass}`}>
        <div className="md:col-span-2 relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-slate-400'}`} size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tenant, slug, cpf/cnpj..."
            className={dark
              ? 'w-full pl-10 pr-3 py-2 border border-slate-700/60 bg-[#0d1628]/80 text-slate-100 rounded-lg text-sm placeholder:text-slate-500'
              : 'w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm'}
          />
        </div>
        <select value={integrationFilter} onChange={(e) => setIntegrationFilter(e.target.value)} className={dark ? 'border border-slate-700/60 bg-[#0d1628]/80 text-slate-100 rounded-lg px-3 py-2 text-sm' : 'border border-slate-200 rounded-lg px-3 py-2 text-sm'}>
          <option value="all">Todos</option>
          <option value="integrated">Integrados</option>
          <option value="pending">Pendentes</option>
          <option value="with_active">Com ativos</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={dark ? 'border border-slate-700/60 bg-[#0d1628]/80 text-slate-100 rounded-lg px-3 py-2 text-sm' : 'border border-slate-200 rounded-lg px-3 py-2 text-sm'}>
          <option value="active_desc">Mais ativos</option>
          <option value="created_desc">Mais recentes</option>
          <option value="name_asc">Nome A-Z</option>
          <option value="name_desc">Nome Z-A</option>
        </select>
      </div>

      <div className={`border rounded-xl overflow-hidden shadow-sm ${cardClass}`}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className={dark ? 'bg-[#0d1628]/95 text-slate-400 text-[11px] uppercase tracking-wide font-semibold' : 'bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide font-semibold'}>
              <tr>
                <th className="px-6 py-3 text-left">Cliente</th>
                <th className="px-6 py-3 text-left">Integração</th>
                <th className="px-6 py-3 text-right">Ativas</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-left">Criado em</th>
                <th className="px-6 py-3 text-right">Usuários</th>
                <th className="px-6 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className={dark ? 'divide-y divide-slate-700/50' : 'divide-y'}>
              {filtered.map((t: any) => (
                <tr key={t.id} className={dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}>
                  <td className="px-6 py-3">
                    <div className={dark ? 'font-semibold text-slate-100' : 'font-semibold text-slate-800'}>{t.name}</div>
                    <div className={dark ? 'text-xs text-slate-500' : 'text-xs text-slate-500'}>{t.slug} • {t.domain || '-'}</div>
                  </td>
                  <td className="px-6 py-3">
                    <Badge color={t.sgpConfigured ? 'green' : 'orange'}>{t.sgpConfigured ? 'Integrado' : 'Pendente'}</Badge>
                  </td>
                  <td className={dark ? 'px-6 py-3 text-right font-mono text-blue-300 font-bold' : 'px-6 py-3 text-right font-mono text-blue-700 font-bold'}>{t.activeOrders}</td>
                  <td className={dark ? 'px-6 py-3 text-right font-mono text-slate-300' : 'px-6 py-3 text-right font-mono text-slate-700'}>{t.totalOrders}</td>
                  <td className={dark ? 'px-6 py-3 text-slate-400' : 'px-6 py-3 text-slate-600'}>{formatDate(t.createdAt)}</td>
                  <td className={dark ? 'px-6 py-3 text-right font-mono text-slate-300' : 'px-6 py-3 text-right font-mono'}>{(tenantUsersByTenant[t.id] || []).length}</td>
                  <td className="px-6 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setEditingTenant({ ...t })} className={dark ? 'px-2 py-1 text-xs border border-slate-700/60 rounded bg-[#0d1628]/80 text-slate-200 hover:bg-white/5' : 'px-2 py-1 text-xs border rounded bg-white hover:bg-slate-50'}>
                        Config
                      </button>
                      <button onClick={() => openTenantUsers(t)} className={dark ? 'px-2 py-1 text-xs border border-slate-700/60 rounded bg-[#0d1628]/80 text-slate-200 hover:bg-white/5' : 'px-2 py-1 text-xs border rounded bg-white hover:bg-slate-50'}>
                        Usuário
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className={dark ? 'px-6 py-10 text-center text-slate-500' : 'px-6 py-10 text-center text-slate-400'}>
                    Nenhum tenant encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingTenant && (
        <Modal
          title={`Configurar Tenant: ${editingTenant.name}`}
          onClose={() => setEditingTenant(null)}
          maxWidth="max-w-2xl"
          actions={
            <>
              <button onClick={() => setEditingTenant(null)} className={dark ? 'px-4 py-2 border border-slate-700/60 text-slate-200 rounded-lg text-sm hover:bg-white/5' : 'px-4 py-2 border rounded-lg text-sm'}>Cancelar</button>
              <button onClick={saveTenant} disabled={busy} className={dark ? 'px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-100 rounded-lg text-sm disabled:opacity-50 hover:bg-cyan-500/30' : 'px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50'}>Salvar</button>
            </>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Razão Social</label>
              <input value={editingTenant.legalName || ''} onChange={(e) => setEditingTenant((s: any) => ({ ...s, legalName: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nome Fantasia</label>
              <input value={editingTenant.tradeName || ''} onChange={(e) => setEditingTenant((s: any) => ({ ...s, tradeName: e.target.value, name: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>CNPJ/CPF</label>
              <input value={editingTenant.taxId || ''} onChange={(e) => setEditingTenant((s: any) => ({ ...s, taxId: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input value={editingTenant.slug || ''} onChange={(e) => setEditingTenant((s: any) => ({ ...s, slug: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Domínio</label>
              <input value={editingTenant.domain || ''} onChange={(e) => setEditingTenant((s: any) => ({ ...s, domain: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Timezone</label>
              <input value={editingTenant.timezone || 'America/Sao_Paulo'} onChange={(e) => setEditingTenant((s: any) => ({ ...s, timezone: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Contato Técnico</label>
              <input value={editingTenant.techContactName || ''} onChange={(e) => setEditingTenant((s: any) => ({ ...s, techContactName: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email Técnico</label>
              <input value={editingTenant.techContactEmail || ''} onChange={(e) => setEditingTenant((s: any) => ({ ...s, techContactEmail: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Telefone Técnico</label>
              <input value={editingTenant.techContactPhone || ''} onChange={(e) => setEditingTenant((s: any) => ({ ...s, techContactPhone: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={editingTenant.status || 'ACTIVE'} onChange={(e) => setEditingTenant((s: any) => ({ ...s, status: e.target.value }))} className={inputClass}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>
        </Modal>
      )}

      {creatingTenant && (
        <Modal
          title="Novo Cliente / Tenant"
          onClose={() => setCreatingTenant(false)}
          maxWidth="max-w-2xl"
          actions={
            <>
              <button onClick={() => setCreatingTenant(false)} className={dark ? 'px-4 py-2 border border-slate-700/60 text-slate-200 rounded-lg text-sm hover:bg-white/5' : 'px-4 py-2 border rounded-lg text-sm'}>Cancelar</button>
              <button onClick={createTenant} disabled={busy} className={dark ? 'px-4 py-2 bg-indigo-500/25 border border-indigo-500/30 text-indigo-100 rounded-lg text-sm disabled:opacity-50 hover:bg-indigo-500/35' : 'px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50'}>Criar</button>
            </>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Razão Social</label>
              <input value={newTenant.legalName} onChange={(e) => setNewTenant((s: TenantForm) => ({ ...s, legalName: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nome Fantasia</label>
              <input value={newTenant.tradeName} onChange={(e) => setNewTenant((s: TenantForm) => ({ ...s, tradeName: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>CNPJ/CPF</label>
              <input value={newTenant.taxId} onChange={(e) => setNewTenant((s: TenantForm) => ({ ...s, taxId: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input value={newTenant.slug} onChange={(e) => setNewTenant((s: TenantForm) => ({ ...s, slug: e.target.value }))} className={inputClass} placeholder="auto pelo nome fantasia" />
            </div>
            <div>
              <label className={labelClass}>Domínio</label>
              <input value={newTenant.domain} onChange={(e) => setNewTenant((s: TenantForm) => ({ ...s, domain: e.target.value }))} className={inputClass} placeholder="auto: slug.ajust.local" />
            </div>
            <div>
              <label className={labelClass}>Timezone</label>
              <input value={newTenant.timezone} onChange={(e) => setNewTenant((s: TenantForm) => ({ ...s, timezone: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Contato Técnico</label>
              <input value={newTenant.techContactName} onChange={(e) => setNewTenant((s: TenantForm) => ({ ...s, techContactName: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email Técnico</label>
              <input value={newTenant.techContactEmail} onChange={(e) => setNewTenant((s: TenantForm) => ({ ...s, techContactEmail: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Telefone Técnico</label>
              <input value={newTenant.techContactPhone} onChange={(e) => setNewTenant((s: TenantForm) => ({ ...s, techContactPhone: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={newTenant.status} onChange={(e) => setNewTenant((s: TenantForm) => ({ ...s, status: e.target.value }))} className={inputClass}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>
        </Modal>
      )}

      {userTenant && (
        <Modal
          title={`Usuários - ${userTenant.name}`}
          onClose={() => setUserTenant(null)}
          maxWidth="max-w-2xl"
          actions={
            <>
              <button onClick={() => setUserTenant(null)} className={dark ? 'px-4 py-2 border border-slate-700/60 text-slate-200 rounded-lg text-sm hover:bg-white/5' : 'px-4 py-2 border rounded-lg text-sm'}>Fechar</button>
              <button onClick={createTenantUser} disabled={busy} className={dark ? 'px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-100 rounded-lg text-sm disabled:opacity-50 hover:bg-cyan-500/30' : 'px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50'}>Criar Usuário</button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="space-y-2">
              {(tenantUsersByTenant[userTenant.id] || []).map((userItem: TenantUser) => (
                <div key={userItem.id} className={dark ? 'border border-slate-700/60 rounded-lg px-3 py-2 text-sm flex justify-between items-center bg-[#0d1628]/80' : 'border border-slate-200 rounded-lg px-3 py-2 text-sm flex justify-between items-center'}>
                  <div>
                    <div className={dark ? 'font-semibold text-slate-100' : 'font-semibold text-slate-800'}>{userItem.name}</div>
                    <div className={dark ? 'text-xs text-slate-400' : 'text-xs text-slate-500'}>{userItem.email} • {userItem.role}</div>
                  </div>
                  <Badge color={userItem.active ? 'green' : 'orange'}>{userItem.active ? 'Ativo' : 'Inativo'}</Badge>
                </div>
              ))}
              {(tenantUsersByTenant[userTenant.id] || []).length === 0 && (
                <div className={dark ? 'text-xs text-slate-400' : 'text-xs text-slate-500'}>Nenhum usuario carregado para este tenant.</div>
              )}
            </div>

            <div className={dark ? 'border-t border-slate-700/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-3' : 'border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-3'}>
              <div>
                <label className={labelClass}>Nome</label>
                <input value={newUser.name} onChange={(e) => setNewUser((s: NewTenantUserForm) => ({ ...s, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input value={newUser.email} onChange={(e) => setNewUser((s: NewTenantUserForm) => ({ ...s, email: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Senha Inicial</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser((s: NewTenantUserForm) => ({ ...s, password: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Perfil</label>
                <select value={newUser.roleCode} onChange={(e) => setNewUser((s: NewTenantUserForm) => ({ ...s, roleCode: e.target.value }))} className={inputClass}>
                  {availableRoles.map((role) => (
                    <option key={role.code} value={role.code}>{ROLE_CODE_TO_LABEL[role.code] || role.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
