'use client';

import React, { useEffect, useState } from 'react';

type TenantUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: string;
};

type SettingsViewModuleProps = {
  role: string;
  notify?: (message: string) => void;
  tenantId?: string | null;
  helpers: any;
};

export function SettingsViewModule({ role, notify, tenantId, helpers }: SettingsViewModuleProps) {
  const {
    useTheme,
    canManageUsersByRole,
    readApiErrorMessage,
    mapApiTenantUser,
    ROLE_CODE_TO_LABEL,
    cn,
    Settings,
    RefreshCw,
    UserCog,
    Plus,
    Users,
    Badge,
    Modal,
  } = helpers;

  const { dark } = useTheme();
  const canManageUsers = canManageUsersByRole(role);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [roles, setRoles] = useState<Array<{ code: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', roleCode: 'analista' });

  const loadUsers = async () => {
    if (!tenantId || !canManageUsers) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/iam/users?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Falha ao listar usuarios.'));
      }
      const payload = await response.json();
      const mapped = Array.isArray(payload) ? payload.map(mapApiTenantUser) : [];
      setUsers(mapped as TenantUser[]);
    } catch (error) {
      notify?.(error instanceof Error ? error.message : 'Falha ao listar usuarios.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tenantId || !canManageUsers) return;
    loadUsers();
  }, [tenantId, canManageUsers]);

  useEffect(() => {
    const loadRoles = async () => {
      if (!tenantId || !canManageUsers) return;
      try {
        const response = await fetch('/api/iam/roles', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        const mapped = Array.isArray(payload)
          ? payload.map((roleItem: any) => ({ code: roleItem.code, name: roleItem.name || ROLE_CODE_TO_LABEL[roleItem.code] || roleItem.code }))
          : [];
        if (mapped.length > 0) {
          setRoles(mapped);
          setNewUser((prev) => ({ ...prev, roleCode: mapped[0].code }));
        }
      } catch { }
    };
    loadRoles();
  }, [tenantId, canManageUsers]);

  const runReconcile = () => {
    if (!tenantId || reconciling) return;
    (async () => {
      setReconciling(true);
      try {
        const response = await fetch('/api/integrations/ixc/reconcile', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tenantId }),
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao executar reconciliacao.'));
        }
        notify?.('Reconciliação IXC executada com sucesso.');
      } catch (error) {
        notify?.(error instanceof Error ? error.message : 'Falha ao executar reconciliacao.');
      } finally {
        setReconciling(false);
      }
    })();
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const validateUserFields = () => {
    const errs: Record<string, string> = {};
    if (!newUser.name.trim()) errs.name = 'Nome e obrigatorio.';
    if (!newUser.email.trim()) errs.email = 'E-mail e obrigatorio.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email.trim())) errs.email = 'E-mail invalido.';
    if (!newUser.password.trim()) errs.password = 'Senha e obrigatoria.';
    else if (newUser.password.length < 8) errs.password = 'Minimo 8 caracteres.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const createUser = () => {
    if (!tenantId) return;
    if (!validateUserFields()) return;
    (async () => {
      try {
        const response = await fetch('/api/iam/users', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            name: newUser.name.trim(),
            email: newUser.email.trim(),
            password: newUser.password,
            roleCode: newUser.roleCode,
          }),
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao criar usuario.'));
        }
        setNewUser((prev) => ({ ...prev, name: '', email: '', password: '' }));
        setFieldErrors({});
        setModalType(null);
        notify?.('Usuário criado.');
        await loadUsers();
      } catch (error) {
        notify?.(error instanceof Error ? error.message : 'Falha ao criar usuario.');
      }
    })();
  };

  const toggleUserStatus = (userItem: TenantUser) => {
    if (!tenantId) return;
    (async () => {
      try {
        const response = await fetch(`/api/iam/users/${encodeURIComponent(userItem.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            status: userItem.active ? 'INACTIVE' : 'ACTIVE',
          }),
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao alterar status do usuario.'));
        }
        await loadUsers();
      } catch (error) {
        notify?.(error instanceof Error ? error.message : 'Falha ao alterar status.');
      }
    })();
  };

  const removeUser = (userItem: TenantUser) => {
    if (!tenantId) return;
    (async () => {
      try {
        const response = await fetch(`/api/iam/users/${encodeURIComponent(userItem.id)}?tenantId=${encodeURIComponent(tenantId)}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao remover usuario.'));
        }
        notify?.('Usuário removido do tenant.');
        await loadUsers();
      } catch (error) {
        notify?.(error instanceof Error ? error.message : 'Falha ao remover usuario.');
      }
    })();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {(() => {
        const sectionCardClass = cn('rounded-xl border shadow-sm overflow-hidden', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200');
        const sectionHeaderClass = cn('px-6 py-4 border-b flex justify-between items-center', dark ? 'border-slate-700/60 bg-[#0d1628]/80' : 'border-slate-100 bg-slate-50/50');
        const labelClass = cn('text-xs font-bold uppercase tracking-wide', dark ? 'text-slate-400' : 'text-slate-500');
        const inputBaseClass = cn('w-full border p-2 rounded mt-1 text-sm', dark ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800');
        const secondaryBtnClass = cn('px-3 py-1.5 text-xs border rounded transition-colors', dark ? 'border-slate-700 text-slate-300 hover:bg-white/5' : 'border-slate-300 text-slate-700 hover:bg-slate-100');
        const dangerBtnClass = cn('px-3 py-1.5 text-xs border rounded transition-colors', dark ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10' : 'border-rose-300 text-rose-700 hover:bg-rose-50');
        return (
          <>
      <div className={cn('flex items-center gap-4 border-b pb-6', dark ? 'border-slate-700/60' : 'border-slate-200')}>
        <div className={cn('p-3 border rounded-xl shadow-sm', dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200')}>
          <Settings size={24} className={cn(dark ? 'text-slate-300' : 'text-slate-700')} />
        </div>
        <div>
          <h2 className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900')}>Configurações</h2>
          <p className={cn('mt-1', dark ? 'text-slate-400' : 'text-slate-500')}>Reconciliação IXC e usuarios do tenant.</p>
        </div>
      </div>

      <div className={sectionCardClass}>
        <div className={sectionHeaderClass}>
          <h3 className={cn('font-bold text-sm uppercase tracking-wide flex items-center', dark ? 'text-slate-200' : 'text-slate-800')}>
            <RefreshCw size={16} className={cn('mr-2', dark ? 'text-cyan-300' : 'text-blue-500')} /> Integração SGP/IXC
          </h3>
        </div>
        <div className="p-6 flex items-center justify-between">
          <p className={cn('text-sm', dark ? 'text-slate-400' : 'text-slate-600')}>Executa reconciliacao manual para o tenant autenticado.</p>
          <button onClick={runReconcile} disabled={!tenantId || reconciling} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
            dark ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/30' : 'bg-blue-600 text-white hover:bg-blue-700')}>
            {reconciling ? 'Executando...' : 'Executar agora'}
          </button>
        </div>
      </div>

      {canManageUsers && (
        <div className={sectionCardClass}>
          <div className={sectionHeaderClass}>
            <h3 className={cn('font-bold text-sm uppercase tracking-wide flex items-center', dark ? 'text-slate-200' : 'text-slate-800')}>
              <UserCog size={16} className={cn('mr-2', dark ? 'text-indigo-300' : 'text-purple-500')} /> Gerenciar Usuários do Tenant
            </h3>
            <button onClick={() => setModalType('user')} className={cn('text-xs px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center border',
              dark ? 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30 hover:bg-indigo-500/25' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100')}>
              <Plus size={14} className="mr-1" /> Novo Usuário
            </button>
          </div>

          <div className={cn('divide-y', dark ? 'divide-slate-700/60' : 'divide-slate-100')}>
            {loading && (
              <div className="p-6 space-y-3">
                {[0, 1, 2].map((i) => <div key={i} className={cn('h-14 rounded-lg animate-pulse', dark ? 'bg-slate-800/60' : 'bg-slate-50')} />)}
              </div>
            )}
            {!loading && users.map((u: TenantUser) => (
              <div key={u.id} className={cn('p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors', dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50')}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm', dark ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600')}>
                    {u.name
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div>
                    <h4 className={cn('font-bold text-sm', dark ? 'text-slate-100' : 'text-slate-800')}>{u.name}</h4>
                    <div className={cn('flex items-center text-xs gap-2', dark ? 'text-slate-400' : 'text-slate-500')}>
                      <span>{u.email}</span>
                      <span>•</span>
                      <Badge color={u.active ? 'green' : 'orange'} className="py-0 px-1.5 text-[10px]">
                        {u.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge color="blue" className="py-0 px-1.5 text-[10px]">
                        {u.role}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => toggleUserStatus(u)} className={secondaryBtnClass}>
                    {u.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button onClick={() => removeUser(u)} className={dangerBtnClass}>
                    Remover
                  </button>
                </div>
              </div>
            ))}
            {!loading && users.length === 0 && (
              <div className="p-8 text-center">
                <Users size={28} className={cn('mx-auto mb-3', dark ? 'text-slate-500' : 'text-slate-300')} />
                <p className={cn('text-sm font-medium mb-1', dark ? 'text-slate-400' : 'text-slate-500')}>Nenhum usuario no tenant.</p>
                <p className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400')}>Clique em "Novo Usuário" para adicionar.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {modalType === 'user' && (
        <Modal
          title="Novo Usuário"
          onClose={() => setModalType(null)}
          actions={
            <>
              <button onClick={() => setModalType(null)} className={cn('px-4 py-2 text-sm rounded-lg transition-colors',
                dark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100')}>
                Cancelar
              </button>
              <button onClick={createUser} className={cn('px-4 py-2 text-sm rounded-lg border transition-colors',
                dark ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/30' : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700')}>
                Criar Usuário
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Nome<span className="text-rose-500 ml-0.5">*</span></label>
              <input value={newUser.name} onChange={(e) => { setNewUser((s) => ({ ...s, name: e.target.value })); setFieldErrors((p) => ({ ...p, name: undefined })); }} className={cn(inputBaseClass, fieldErrors.name && 'border-rose-400')} />
              {fieldErrors.name && <p className="text-xs text-rose-500 mt-1">{fieldErrors.name}</p>}
            </div>
            <div>
              <label className={labelClass}>Email/Login<span className="text-rose-500 ml-0.5">*</span></label>
              <input value={newUser.email} onChange={(e) => { setNewUser((s) => ({ ...s, email: e.target.value })); setFieldErrors((p) => ({ ...p, email: undefined })); }} className={cn(inputBaseClass, fieldErrors.email && 'border-rose-400')} />
              {fieldErrors.email && <p className="text-xs text-rose-500 mt-1">{fieldErrors.email}</p>}
            </div>
            <div>
              <label className={labelClass}>Senha Inicial<span className="text-rose-500 ml-0.5">*</span></label>
              <input type="password" value={newUser.password} onChange={(e) => { setNewUser((s) => ({ ...s, password: e.target.value })); setFieldErrors((p) => ({ ...p, password: undefined })); }} className={cn(inputBaseClass, fieldErrors.password && 'border-rose-400')} />
              {fieldErrors.password && <p className="text-xs text-rose-500 mt-1">{fieldErrors.password}</p>}
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select value={newUser.roleCode} onChange={(e) => setNewUser((s) => ({ ...s, roleCode: e.target.value }))} className={inputBaseClass}>
                {(roles.length ? roles : [{ code: 'analista', name: 'Analista' }]).map((roleItem) => (
                  <option key={roleItem.code} value={roleItem.code}>{ROLE_CODE_TO_LABEL[roleItem.code] || roleItem.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      )}
          </>
        );
      })()}
    </div>
  );
}
