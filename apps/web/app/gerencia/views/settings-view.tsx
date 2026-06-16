'use client';
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useState } from 'react';

type TenantUser = {
  id: string;
  membershipId?: string;
  name: string;
  email: string;
  active: boolean;
  status?: string;
  roleCode: string;
  role: string;
  sector: string;
  createdAt?: string | null;
  lastLoginAt?: string | null;
};

type TenantSector = {
  id: string;
  name: string;
};

type RoleItem = { code: string; name: string };

type AuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  actorUser?: { name?: string | null } | null;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
};

type SlaPolicy = {
  id?: string;
  priority?: string;
  serviceOrderType?: string | null;
  hours?: number;
  isOverride?: boolean;
  active?: boolean;
};

type SettingsHelpers = {
  useTheme: () => { dark: boolean };
  canManageUsersByRole: (role: string) => boolean;
  readApiErrorMessage: (response: Response, fallback: string) => Promise<string>;
  mapApiTenantUser: (input: unknown) => TenantUser;
  ROLE_CODE_TO_LABEL: Record<string, string>;
  cn: (...parts: Array<string | false | null | undefined>) => string;
  Settings: React.ComponentType<{ size?: number; className?: string }>;
  UserCog: React.ComponentType<{ size?: number; className?: string }>;
  Plus: React.ComponentType<{ size?: number; className?: string }>;
  Users: React.ComponentType<{ size?: number; className?: string }>;
  Badge: React.ComponentType<{ color?: string; className?: string; children?: React.ReactNode }>;
  Modal: React.ComponentType<{
    title: string;
    onClose: () => void;
    actions?: React.ReactNode;
    children?: React.ReactNode;
  }>;
};

const DEFAULT_SECTOR_OPTIONS = ['SAC', 'SUPORTE Tecnico', 'NOC', 'CGR', 'SOC', 'INFRAESTRUTURA'];

type SettingsViewModuleProps = {
  role: string;
  notify?: (message: string) => void;
  tenantId?: string | null;
  helpers: SettingsHelpers;
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
    UserCog,
    Plus,
    Users,
    Badge,
    Modal,
  } = helpers;

  const { dark } = useTheme();
  const canManageUsers = canManageUsersByRole(role);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [sectors, setSectors] = useState<TenantSector[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [slaPolicies, setSlaPolicies] = useState<SlaPolicy[]>([]);
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaSaving, setSlaSaving] = useState(false);
  const [newSla, setNewSla] = useState({
    priority: 'NORMAL',
    serviceOrderType: '',
    hours: 24,
    isOverride: false,
  });
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    roleCode: 'analista',
    sector: 'NOC',
  });
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [editUser, setEditUser] = useState({
    name: '',
    email: '',
    password: '',
    roleCode: 'analista',
    sector: 'NOC',
  });
  const [newSectorName, setNewSectorName] = useState('');
  const [sectorEditId, setSectorEditId] = useState<string | null>(null);
  const [sectorEditName, setSectorEditName] = useState('');
  const [sectorSaving, setSectorSaving] = useState(false);
  const [editingSaving, setEditingSaving] = useState(false);
  const [sectorError, setSectorError] = useState('');
  const sectorOptions = sectors.length ? sectors.map((item) => item.name) : DEFAULT_SECTOR_OPTIONS;
  const ensureSectorOption = (sectorName: string | undefined) => {
    if (!sectorName) return sectorOptions;
    if (sectorOptions.includes(sectorName)) return sectorOptions;
    return [sectorName, ...sectorOptions];
  };

  const loadUsers = async () => {
    if (!tenantId || !canManageUsers) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/iam/users?tenantId=${encodeURIComponent(tenantId)}`, {
        cache: 'no-store',
      });
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

  const loadSectors = async () => {
    if (!tenantId || !canManageUsers) return;
    setSectorsLoading(true);
    setSectorError('');
    try {
      const response = await fetch(`/api/iam/tenants/${encodeURIComponent(tenantId)}/sectors`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Falha ao listar setores.'));
      }
      const payload = await response.json();
      const mapped = Array.isArray(payload)
        ? payload
            .filter(
              (item: unknown): item is { id: string; name: string } =>
                Boolean(item) &&
                typeof item === 'object' &&
                typeof (item as { id?: unknown }).id === 'string' &&
                typeof (item as { name?: unknown }).name === 'string',
            )
            .map((item) => ({ id: item.id, name: item.name.trim() }))
            .filter((item: TenantSector) => item.name.length > 0)
        : [];
      setSectors(mapped);
    } catch (error) {
      setSectorError(error instanceof Error ? error.message : 'Falha ao listar setores.');
      setSectors([]);
    } finally {
      setSectorsLoading(false);
    }
  };

  useEffect(() => {
    if (!tenantId || !canManageUsers) return;
    loadUsers();
    loadAuditLogs();
    loadSlaPolicies();
  }, [tenantId, canManageUsers]);

  const loadSlaPolicies = async () => {
    if (!tenantId) return;
    setSlaLoading(true);
    try {
      const res = await fetch(`/api/iam/tenants/${tenantId}/sla`);
      if (res.ok) setSlaPolicies(await res.json());
    } catch {
    } finally {
      setSlaLoading(false);
    }
  };

  const saveSlaPolicy = async (policy: SlaPolicy) => {
    if (!tenantId || slaSaving) return;
    setSlaSaving(true);
    try {
      const res = await fetch(`/api/iam/tenants/${tenantId}/sla`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(policy),
      });
      if (!res.ok) throw new Error('Falha ao salvar política de SLA');
      await loadSlaPolicies();
      notify?.('Política SLA atualizada.');
      if (!policy.id) {
        setNewSla({ priority: 'NORMAL', serviceOrderType: '', hours: 24, isOverride: false });
      }
    } catch (err: unknown) {
      notify?.(err instanceof Error ? err.message : 'Falha ao salvar política de SLA');
    } finally {
      setSlaSaving(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!tenantId) return;
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/iam/tenants/${tenantId}/audit`);
      if (res.ok) {
        setAuditLogs(await res.json());
      }
    } catch {
      // Ignora falha silenciosamente na UI para não bloquear
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (!tenantId || !canManageUsers) return;
    loadSectors();
  }, [tenantId, canManageUsers]);

  useEffect(() => {
    if (!sectorOptions.length) return;
    if (!sectorOptions.includes(newUser.sector)) {
      setNewUser((prev) => ({ ...prev, sector: sectorOptions[0] }));
    }
  }, [newUser.sector, sectorOptions.join('|')]);

  useEffect(() => {
    const loadRoles = async () => {
      if (!tenantId || !canManageUsers) return;
      try {
        const response = await fetch('/api/iam/roles', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        const mapped = Array.isArray(payload)
          ? payload
              .filter(
                (roleItem: unknown): roleItem is { code: string; name?: string } =>
                  Boolean(roleItem) &&
                  typeof roleItem === 'object' &&
                  typeof (roleItem as { code?: unknown }).code === 'string',
              )
              .map((roleItem) => ({
                code: roleItem.code,
                name: roleItem.name || ROLE_CODE_TO_LABEL[roleItem.code] || roleItem.code,
              }))
          : [];
        if (mapped.length > 0) {
          setRoles(mapped);
          const defaultRole =
            mapped.find((roleItem: RoleItem) => roleItem.code === 'analista')?.code ||
            mapped[0].code;
          setNewUser((prev) => ({ ...prev, roleCode: defaultRole }));
        }
      } catch {}
    };
    loadRoles();
  }, [tenantId, canManageUsers]);

  const functionRoleOptions = (
    roles.length ? roles : [{ code: 'analista', name: 'Analista' }]
  ).filter((roleItem: RoleItem) => roleItem.code === 'analista' || roleItem.code === 'gerente');

  const availableFunctionRoleOptions = functionRoleOptions.length
    ? functionRoleOptions
    : [
        { code: 'analista', name: 'Analista' },
        { code: 'gerente', name: 'Gestor' },
      ];

  const roleAsFunctionLabel = (roleCode: string) =>
    roleCode === 'gerente' ? 'Gestor' : 'Analista';

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const validateUserFields = () => {
    const errs: Record<string, string> = {};
    if (!newUser.name.trim()) errs.name = 'Nome e obrigatorio.';
    if (!newUser.email.trim()) errs.email = 'E-mail e obrigatorio.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email.trim()))
      errs.email = 'E-mail invalido.';
    if (!newUser.password.trim()) errs.password = 'Senha e obrigatoria.';
    else if (newUser.password.length < 8) errs.password = 'Minimo 8 caracteres.';
    if (!newUser.sector) errs.sector = 'Setor e obrigatorio.';
    if (!newUser.roleCode) errs.roleCode = 'Funcao e obrigatoria.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateEditFields = () => {
    const errs: Record<string, string> = {};
    if (!editUser.name.trim()) errs.editName = 'Nome e obrigatorio.';
    if (!editUser.email.trim()) errs.editEmail = 'E-mail e obrigatorio.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editUser.email.trim()))
      errs.editEmail = 'E-mail invalido.';
    if (editUser.password && editUser.password.length < 8)
      errs.editPassword = 'Minimo 8 caracteres.';
    if (!editUser.sector) errs.editSector = 'Setor e obrigatorio.';
    if (!editUser.roleCode) errs.editRoleCode = 'Funcao e obrigatoria.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openEditUser = (userItem: TenantUser) => {
    setEditingUser(userItem);
    setEditUser({
      name: userItem.name || '',
      email: userItem.email || '',
      password: '',
      roleCode: userItem.roleCode || 'analista',
      sector: userItem.sector || sectorOptions[0] || 'NOC',
    });
    setFieldErrors({});
    setModalType('edit_user');
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
            sector: newUser.sector,
          }),
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao criar usuario.'));
        }
        setNewUser((prev) => ({
          ...prev,
          name: '',
          email: '',
          password: '',
          sector: sectorOptions[0] || 'NOC',
        }));
        setFieldErrors({});
        setModalType(null);
        notify?.('Usuário criado.');
        await loadUsers();
      } catch (error) {
        notify?.(error instanceof Error ? error.message : 'Falha ao criar usuario.');
      }
    })();
  };

  const createSector = () => {
    if (!tenantId || sectorSaving) return;
    const name = newSectorName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      setSectorError('Informe um setor valido com ao menos 2 caracteres.');
      return;
    }
    (async () => {
      setSectorSaving(true);
      setSectorError('');
      try {
        const response = await fetch(`/api/iam/tenants/${encodeURIComponent(tenantId)}/sectors`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao criar setor.'));
        }
        setNewSectorName('');
        await loadSectors();
        notify?.('Setor criado.');
      } catch (error) {
        setSectorError(error instanceof Error ? error.message : 'Falha ao criar setor.');
      } finally {
        setSectorSaving(false);
      }
    })();
  };

  const saveSectorEdit = () => {
    if (!tenantId || !sectorEditId || sectorSaving) return;
    const name = sectorEditName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      setSectorError('Informe um setor valido com ao menos 2 caracteres.');
      return;
    }
    (async () => {
      setSectorSaving(true);
      setSectorError('');
      try {
        const response = await fetch(
          `/api/iam/tenants/${encodeURIComponent(tenantId)}/sectors/${encodeURIComponent(sectorEditId)}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name }),
          },
        );
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao atualizar setor.'));
        }
        setSectorEditId(null);
        setSectorEditName('');
        await loadSectors();
        notify?.('Setor atualizado.');
      } catch (error) {
        setSectorError(error instanceof Error ? error.message : 'Falha ao atualizar setor.');
      } finally {
        setSectorSaving(false);
      }
    })();
  };

  const removeSector = (sector: TenantSector) => {
    if (!tenantId || sectorSaving) return;
    if (!window.confirm(`Remover setor "${sector.name}"?`)) return;
    (async () => {
      setSectorSaving(true);
      setSectorError('');
      try {
        const response = await fetch(
          `/api/iam/tenants/${encodeURIComponent(tenantId)}/sectors/${encodeURIComponent(sector.id)}`,
          {
            method: 'DELETE',
          },
        );
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao remover setor.'));
        }
        if (sectorEditId === sector.id) {
          setSectorEditId(null);
          setSectorEditName('');
        }
        await loadSectors();
        notify?.('Setor removido.');
      } catch (error) {
        setSectorError(error instanceof Error ? error.message : 'Falha ao remover setor.');
      } finally {
        setSectorSaving(false);
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
          throw new Error(
            await readApiErrorMessage(response, 'Falha ao alterar status do usuario.'),
          );
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
        const response = await fetch(
          `/api/iam/users/${encodeURIComponent(userItem.id)}?tenantId=${encodeURIComponent(tenantId)}`,
          {
            method: 'DELETE',
          },
        );
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

  const saveEditedUser = () => {
    if (!tenantId || !editingUser || editingSaving) return;
    if (!validateEditFields()) return;
    (async () => {
      setEditingSaving(true);
      try {
        const payload: Record<string, string> = {
          tenantId,
          name: editUser.name.trim(),
          email: editUser.email.trim(),
          roleCode: editUser.roleCode,
          sector: editUser.sector,
        };
        if (editUser.password.trim()) {
          payload.password = editUser.password;
        }
        const response = await fetch(`/api/iam/users/${encodeURIComponent(editingUser.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao atualizar usuario.'));
        }
        notify?.('Usuário atualizado.');
        setModalType(null);
        setEditingUser(null);
        setEditUser((prev) => ({ ...prev, password: '' }));
        setFieldErrors({});
        await loadUsers();
      } catch (error) {
        notify?.(error instanceof Error ? error.message : 'Falha ao atualizar usuario.');
      } finally {
        setEditingSaving(false);
      }
    })();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {(() => {
        const sectionCardClass = cn(
          'rounded-xl border shadow-sm overflow-hidden',
          dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200',
        );
        const sectionHeaderClass = cn(
          'px-6 py-4 border-b flex justify-between items-center',
          dark ? 'border-slate-700/60 bg-[#0d1628]/80' : 'border-slate-100 bg-slate-50/50',
        );
        const labelClass = cn(
          'text-xs font-bold uppercase tracking-wide',
          dark ? 'text-slate-400' : 'text-slate-500',
        );
        const inputBaseClass = cn(
          'w-full border p-2 rounded mt-1 text-sm',
          dark
            ? 'bg-[#0d1628]/80 border-slate-700/60 text-slate-100 placeholder:text-slate-500'
            : 'bg-white border-slate-300 text-slate-800',
        );
        const secondaryBtnClass = cn(
          'px-3 py-1.5 text-xs border rounded transition-colors',
          dark
            ? 'border-slate-700 text-slate-300 hover:bg-white/5'
            : 'border-slate-300 text-slate-700 hover:bg-slate-100',
        );
        const dangerBtnClass = cn(
          'px-3 py-1.5 text-xs border rounded transition-colors',
          dark
            ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
            : 'border-rose-300 text-rose-700 hover:bg-rose-50',
        );
        return (
          <>
            <div
              className={cn(
                'flex items-center gap-4 border-b pb-6',
                dark ? 'border-slate-700/60' : 'border-slate-200',
              )}
            >
              <div
                className={cn(
                  'p-3 border rounded-xl shadow-sm',
                  dark ? 'bg-[#111b2e]/75 border-slate-700/60' : 'bg-white border-slate-200',
                )}
              >
                <Settings size={24} className={cn(dark ? 'text-slate-300' : 'text-slate-700')} />
              </div>
              <div>
                <h2
                  className={cn('text-2xl font-bold', dark ? 'text-slate-100' : 'text-slate-900')}
                >
                  Configurações
                </h2>
                <p className={cn('mt-1', dark ? 'text-slate-400' : 'text-slate-500')}>
                  Gestão de usuários do tenant.
                </p>
              </div>
            </div>

            {canManageUsers && (
              <div className={sectionCardClass}>
                <div className={sectionHeaderClass}>
                  <h3
                    className={cn(
                      'font-bold text-sm uppercase tracking-wide flex items-center',
                      dark ? 'text-slate-200' : 'text-slate-800',
                    )}
                  >
                    <Settings
                      size={16}
                      className={cn('mr-2', dark ? 'text-cyan-300' : 'text-cyan-600')}
                    />{' '}
                    Setores Operacionais
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex flex-col md:flex-row gap-2">
                    <input
                      value={newSectorName}
                      onChange={(e) => setNewSectorName(e.target.value)}
                      placeholder="Ex.: NOC Backbone"
                      className={inputBaseClass}
                    />
                    <button
                      onClick={createSector}
                      disabled={sectorSaving}
                      className={cn(
                        'px-4 py-2 text-sm rounded-lg border whitespace-nowrap transition-colors disabled:opacity-60',
                        dark
                          ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/30'
                          : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
                      )}
                    >
                      {sectorSaving ? 'Salvando...' : 'Adicionar setor'}
                    </button>
                  </div>
                  {sectorError && (
                    <div
                      className={cn(
                        'text-xs border rounded-lg px-3 py-2',
                        dark
                          ? 'border-rose-700/40 bg-rose-900/20 text-rose-300'
                          : 'border-rose-200 bg-rose-50 text-rose-700',
                      )}
                    >
                      {sectorError}
                    </div>
                  )}
                  <div
                    className={cn(
                      'divide-y rounded-lg border',
                      dark
                        ? 'divide-slate-700/60 border-slate-700/60'
                        : 'divide-slate-100 border-slate-200',
                    )}
                  >
                    {sectorsLoading && (
                      <div className="p-4 text-sm text-slate-500">Carregando setores...</div>
                    )}
                    {!sectorsLoading && sectors.length === 0 && (
                      <div className="p-4 text-sm text-slate-500">
                        Nenhum setor customizado cadastrado. O analista usa a lista padrão até você
                        criar setores aqui.
                      </div>
                    )}
                    {!sectorsLoading &&
                      sectors.map((sector) => (
                        <div key={sector.id} className="p-3 flex items-center gap-2">
                          {sectorEditId === sector.id ? (
                            <>
                              <input
                                value={sectorEditName}
                                onChange={(e) => setSectorEditName(e.target.value)}
                                className={cn(inputBaseClass, 'mt-0')}
                              />
                              <button
                                onClick={saveSectorEdit}
                                disabled={sectorSaving}
                                className={secondaryBtnClass}
                              >
                                Salvar
                              </button>
                              <button
                                onClick={() => {
                                  setSectorEditId(null);
                                  setSectorEditName('');
                                }}
                                className={secondaryBtnClass}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <div
                                className={cn(
                                  'flex-1 text-sm font-medium',
                                  dark ? 'text-slate-200' : 'text-slate-800',
                                )}
                              >
                                {sector.name}
                              </div>
                              <button
                                onClick={() => {
                                  setSectorEditId(sector.id);
                                  setSectorEditName(sector.name);
                                }}
                                className={secondaryBtnClass}
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => removeSector(sector)}
                                className={dangerBtnClass}
                              >
                                Apagar
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {canManageUsers && (
              <div className={sectionCardClass}>
                <div className={sectionHeaderClass}>
                  <h3
                    className={cn(
                      'font-bold text-sm uppercase tracking-wide flex items-center',
                      dark ? 'text-slate-200' : 'text-slate-800',
                    )}
                  >
                    <UserCog
                      size={16}
                      className={cn('mr-2', dark ? 'text-indigo-300' : 'text-purple-500')}
                    />{' '}
                    Gerenciar Usuários do Tenant
                  </h3>
                  <button
                    onClick={() => setModalType('user')}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center border',
                      dark
                        ? 'bg-indigo-500/15 text-indigo-200 border-indigo-500/30 hover:bg-indigo-500/25'
                        : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
                    )}
                  >
                    <Plus size={14} className="mr-1" /> Novo Usuário
                  </button>
                </div>

                <div className={cn('divide-y', dark ? 'divide-slate-700/60' : 'divide-slate-100')}>
                  {loading && (
                    <div className="p-6 space-y-3">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-14 rounded-lg animate-pulse',
                            dark ? 'bg-slate-800/60' : 'bg-slate-50',
                          )}
                        />
                      ))}
                    </div>
                  )}
                  {!loading &&
                    users.map((u: TenantUser) => (
                      <div
                        key={u.id}
                        className={cn(
                          'p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors',
                          dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm',
                              dark ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600',
                            )}
                          >
                            {u.name
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                          <div>
                            <h4
                              className={cn(
                                'font-bold text-sm',
                                dark ? 'text-slate-100' : 'text-slate-800',
                              )}
                            >
                              {u.name}
                            </h4>
                            <div
                              className={cn(
                                'flex items-center text-xs gap-2',
                                dark ? 'text-slate-400' : 'text-slate-500',
                              )}
                            >
                              <span>{u.email}</span>
                              <span>•</span>
                              <Badge
                                color={u.active ? 'green' : 'orange'}
                                className="py-0 px-1.5 text-[10px]"
                              >
                                {u.active ? 'Ativo' : 'Inativo'}
                              </Badge>
                              <Badge color="blue" className="py-0 px-1.5 text-[10px]">
                                {roleAsFunctionLabel(u.roleCode)}
                              </Badge>
                              <Badge color="slate" className="py-0 px-1.5 text-[10px]">
                                {u.sector || 'NOC'}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditUser(u)} className={secondaryBtnClass}>
                            Editar
                          </button>
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
                      <Users
                        size={28}
                        className={cn('mx-auto mb-3', dark ? 'text-slate-500' : 'text-slate-300')}
                      />
                      <p
                        className={cn(
                          'text-sm font-medium mb-1',
                          dark ? 'text-slate-400' : 'text-slate-500',
                        )}
                      >
                        Nenhum usuario no tenant.
                      </p>
                      <p className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400')}>
                        Clique em &quot;Novo Usuário&quot; para adicionar.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {canManageUsers && (
              <div className={sectionCardClass}>
                <div className={sectionHeaderClass}>
                  <h3
                    className={cn(
                      'font-bold text-sm uppercase tracking-wide flex items-center',
                      dark ? 'text-slate-200' : 'text-slate-800',
                    )}
                  >
                    Logs de Auditoria
                  </h3>
                </div>
                <div className="p-4 overflow-x-auto">
                  {auditLoading ? (
                    <div className="text-sm text-slate-500">Carregando auditoria...</div>
                  ) : auditLogs.length === 0 ? (
                    <div className="text-sm text-slate-500">Nenhum log encontrado.</div>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead
                        className={cn(
                          'text-xs uppercase',
                          dark ? 'text-slate-400 bg-slate-800/50' : 'text-slate-500 bg-slate-50',
                        )}
                      >
                        <tr>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Ação</th>
                          <th className="px-4 py-3">Usuário</th>
                          <th className="px-4 py-3">Recurso</th>
                          <th className="px-4 py-3">IP</th>
                        </tr>
                      </thead>
                      <tbody
                        className={cn(
                          'divide-y',
                          dark ? 'divide-slate-700/60' : 'divide-slate-200',
                        )}
                      >
                        {auditLogs.map((log) => (
                          <tr
                            key={log.id}
                            className={cn(
                              'transition-colors',
                              dark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50',
                            )}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-4 py-3">
                              <Badge color="blue">{log.action}</Badge>
                            </td>
                            <td className="px-4 py-3">{log.actorUser?.name || 'Sistema'}</td>
                            <td className="px-4 py-3">
                              {log.resourceType} {log.resourceId}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{log.ipAddress || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {canManageUsers && (
              <div className={sectionCardClass}>
                <div className={sectionHeaderClass}>
                  <h3
                    className={cn(
                      'font-bold text-sm uppercase tracking-wide flex items-center',
                      dark ? 'text-slate-200' : 'text-slate-800',
                    )}
                  >
                    Políticas de SLA (Prazos)
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex flex-col md:flex-row gap-2 items-end">
                    <div className="w-full">
                      <label className={labelClass}>Prioridade</label>
                      <select
                        className={inputBaseClass}
                        value={newSla.priority}
                        onChange={(e) => setNewSla({ ...newSla, priority: e.target.value })}
                      >
                        <option value="BAIXA">Baixa</option>
                        <option value="NORMAL">Normal</option>
                        <option value="ALTA">Alta</option>
                        <option value="CRITICA">Crítica</option>
                      </select>
                    </div>
                    <div className="w-full">
                      <label className={labelClass}>Tipo de OS (override)</label>
                      <select
                        className={inputBaseClass}
                        value={newSla.serviceOrderType}
                        disabled={!newSla.isOverride}
                        onChange={(e) => setNewSla({ ...newSla, serviceOrderType: e.target.value })}
                      >
                        {[
                          'ROMPIMENTO',
                          'LENTIDAO',
                          'CONFIGURACAO_ONU',
                          'TROCA_SENHA',
                          'CANCELAMENTO',
                          'AUDITORIA',
                          'INSTALACAO',
                          'BGP',
                        ].map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-full">
                      <label className={labelClass}>Horas</label>
                      <input
                        type="number"
                        min="1"
                        className={inputBaseClass}
                        value={newSla.hours}
                        onChange={(e) => setNewSla({ ...newSla, hours: Number(e.target.value) })}
                      />
                    </div>
                    <label className="flex items-center gap-2 mb-3 whitespace-nowrap text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSla.isOverride}
                        onChange={(e) =>
                          setNewSla({
                            ...newSla,
                            isOverride: e.target.checked,
                            serviceOrderType: e.target.checked
                              ? newSla.serviceOrderType || 'INSTALACAO'
                              : '',
                          })
                        }
                      />
                      Sobrescrever Genéricos
                    </label>
                    <button
                      onClick={() =>
                        saveSlaPolicy({
                          ...newSla,
                          serviceOrderType: newSla.serviceOrderType || null,
                        })
                      }
                      disabled={slaSaving}
                      className={cn(
                        'px-4 py-2 text-sm rounded-lg border whitespace-nowrap transition-colors disabled:opacity-60',
                        dark
                          ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/30'
                          : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
                      )}
                    >
                      {slaSaving ? 'Salvando...' : 'Adicionar Regra'}
                    </button>
                  </div>

                  <div
                    className={cn(
                      'divide-y rounded-lg border',
                      dark
                        ? 'divide-slate-700/60 border-slate-700/60'
                        : 'divide-slate-100 border-slate-200',
                    )}
                  >
                    {slaLoading ? (
                      <div className="p-4 text-sm text-slate-500">Carregando políticas...</div>
                    ) : slaPolicies.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500">
                        Nenhuma política cadastrada. O sistema usará os padrões do Ajust ERP.
                      </div>
                    ) : (
                      slaPolicies.map((p) => (
                        <div key={p.id} className="p-3 flex items-center justify-between gap-4">
                          <div className="flex gap-4 items-center">
                            <Badge
                              color={
                                p.priority === 'CRITICA'
                                  ? 'red'
                                  : p.priority === 'ALTA'
                                    ? 'orange'
                                    : 'blue'
                              }
                            >
                              {p.priority}
                            </Badge>
                            <span
                              className={cn(
                                'text-sm font-bold',
                                dark ? 'text-slate-200' : 'text-slate-800',
                              )}
                            >
                              {p.hours} horas
                            </span>
                            <span
                              className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}
                            >
                              {p.serviceOrderType
                                ? `Aplicável apenas em: ${p.serviceOrderType}`
                                : 'Padrão da Prioridade'}
                            </span>
                            {p.isOverride && (
                              <Badge color="purple" className="text-[10px]">
                                Override
                              </Badge>
                            )}
                          </div>
                          <button
                            onClick={() => saveSlaPolicy({ id: p.id, active: !p.active })}
                            className={secondaryBtnClass}
                          >
                            {p.active ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {modalType === 'user' && (
              <Modal
                title="Novo Usuário"
                onClose={() => setModalType(null)}
                actions={
                  <>
                    <button
                      onClick={() => setModalType(null)}
                      className={cn(
                        'px-4 py-2 text-sm rounded-lg transition-colors',
                        dark
                          ? 'text-slate-300 hover:bg-white/5'
                          : 'text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={createUser}
                      className={cn(
                        'px-4 py-2 text-sm rounded-lg border transition-colors',
                        dark
                          ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/30'
                          : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
                      )}
                    >
                      Criar Usuário
                    </button>
                  </>
                }
              >
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>
                      Nome<span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <input
                      value={newUser.name}
                      onChange={(e) => {
                        setNewUser((s) => ({ ...s, name: e.target.value }));
                        setFieldErrors((p) => ({ ...p, name: undefined }));
                      }}
                      className={cn(inputBaseClass, fieldErrors.name && 'border-rose-400')}
                    />
                    {fieldErrors.name && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.name}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      Email/Login<span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <input
                      value={newUser.email}
                      onChange={(e) => {
                        setNewUser((s) => ({ ...s, email: e.target.value }));
                        setFieldErrors((p) => ({ ...p, email: undefined }));
                      }}
                      className={cn(inputBaseClass, fieldErrors.email && 'border-rose-400')}
                    />
                    {fieldErrors.email && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      Senha Inicial<span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => {
                        setNewUser((s) => ({ ...s, password: e.target.value }));
                        setFieldErrors((p) => ({ ...p, password: undefined }));
                      }}
                      className={cn(inputBaseClass, fieldErrors.password && 'border-rose-400')}
                    />
                    {fieldErrors.password && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.password}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      Função<span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <select
                      value={newUser.roleCode}
                      onChange={(e) => setNewUser((s) => ({ ...s, roleCode: e.target.value }))}
                      className={inputBaseClass}
                    >
                      {availableFunctionRoleOptions.map(
                        (roleItem: { code: string; name: string }) => (
                          <option key={roleItem.code} value={roleItem.code}>
                            {roleAsFunctionLabel(roleItem.code)}
                          </option>
                        ),
                      )}
                    </select>
                    {fieldErrors.roleCode && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.roleCode}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      Setor<span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <select
                      value={newUser.sector}
                      onChange={(e) => setNewUser((s) => ({ ...s, sector: e.target.value }))}
                      className={inputBaseClass}
                    >
                      {ensureSectorOption(newUser.sector).map((sectorOption) => (
                        <option key={sectorOption} value={sectorOption}>
                          {sectorOption}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.sector && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.sector}</p>
                    )}
                  </div>
                </div>
              </Modal>
            )}

            {modalType === 'edit_user' && editingUser && (
              <Modal
                title={`Editar Usuário - ${editingUser.name}`}
                onClose={() => {
                  setModalType(null);
                  setEditingUser(null);
                  setEditUser((prev) => ({ ...prev, password: '' }));
                  setFieldErrors({});
                }}
                actions={
                  <>
                    <button
                      onClick={() => {
                        setModalType(null);
                        setEditingUser(null);
                        setEditUser((prev) => ({ ...prev, password: '' }));
                        setFieldErrors({});
                      }}
                      className={cn(
                        'px-4 py-2 text-sm rounded-lg transition-colors',
                        dark
                          ? 'text-slate-300 hover:bg-white/5'
                          : 'text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveEditedUser}
                      disabled={editingSaving}
                      className={cn(
                        'px-4 py-2 text-sm rounded-lg border transition-colors disabled:opacity-60',
                        dark
                          ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/30'
                          : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
                      )}
                    >
                      {editingSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </>
                }
              >
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>
                      Nome<span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <input
                      value={editUser.name}
                      onChange={(e) => {
                        setEditUser((s) => ({ ...s, name: e.target.value }));
                        setFieldErrors((p) => ({ ...p, editName: undefined }));
                      }}
                      className={cn(inputBaseClass, fieldErrors.editName && 'border-rose-400')}
                    />
                    {fieldErrors.editName && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.editName}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      E-mail<span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <input
                      value={editUser.email}
                      onChange={(e) => {
                        setEditUser((s) => ({ ...s, email: e.target.value }));
                        setFieldErrors((p) => ({ ...p, editEmail: undefined }));
                      }}
                      className={cn(inputBaseClass, fieldErrors.editEmail && 'border-rose-400')}
                    />
                    {fieldErrors.editEmail && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.editEmail}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Nova Senha (opcional)</label>
                    <input
                      type="password"
                      value={editUser.password}
                      onChange={(e) => {
                        setEditUser((s) => ({ ...s, password: e.target.value }));
                        setFieldErrors((p) => ({ ...p, editPassword: undefined }));
                      }}
                      placeholder="Deixe em branco para manter a senha atual"
                      className={cn(inputBaseClass, fieldErrors.editPassword && 'border-rose-400')}
                    />
                    {fieldErrors.editPassword && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.editPassword}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      Função<span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <select
                      value={editUser.roleCode}
                      onChange={(e) => {
                        setEditUser((s) => ({ ...s, roleCode: e.target.value }));
                        setFieldErrors((p) => ({ ...p, editRoleCode: undefined }));
                      }}
                      className={cn(inputBaseClass, fieldErrors.editRoleCode && 'border-rose-400')}
                    >
                      {availableFunctionRoleOptions.map(
                        (roleItem: { code: string; name: string }) => (
                          <option key={roleItem.code} value={roleItem.code}>
                            {roleAsFunctionLabel(roleItem.code)}
                          </option>
                        ),
                      )}
                    </select>
                    {fieldErrors.editRoleCode && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.editRoleCode}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      Setor<span className="text-rose-500 ml-0.5">*</span>
                    </label>
                    <select
                      value={editUser.sector}
                      onChange={(e) => {
                        setEditUser((s) => ({ ...s, sector: e.target.value }));
                        setFieldErrors((p) => ({ ...p, editSector: undefined }));
                      }}
                      className={cn(inputBaseClass, fieldErrors.editSector && 'border-rose-400')}
                    >
                      {ensureSectorOption(editUser.sector).map((sectorOption) => (
                        <option key={sectorOption} value={sectorOption}>
                          {sectorOption}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.editSector && (
                      <p className="text-xs text-rose-500 mt-1">{fieldErrors.editSector}</p>
                    )}
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
