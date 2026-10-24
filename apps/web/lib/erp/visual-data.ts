'use client';
import { usePathname } from 'next/navigation';
import { type Dispatch, type SetStateAction } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { useErp, useErpAction, useErpQuery } from './gateway';
import { modules } from './modules';
import {
  errorMessage,
  orderStatuses,
  orderTypes,
  priorities,
  occurrenceStatuses,
  type ErpRecord,
} from './contracts';

export const visualModules: Record<string, string> = {
  providers: 'customers',
  technicians: 'users',
  tenants: 'tenants',
  assets: 'assets',
  articles: 'articles',
  services: 'catalog',
  policies: 'slaPolicies',
  incidents: 'occurrences',
  events: 'calendar',
  orders: 'orders',
  credentials: 'credentials',
  notes: 'notes',
  shifts: 'onCall',
  workflows: 'workflows',
};
export const routeModules: Record<string, string> = {
  provedores: 'customers',
  tecnicos: 'users',
  empresas: 'tenants',
  ativos: 'assets',
  ajustpedia: 'articles',
  servicos: 'catalog',
  'politicas-sla': 'slaPolicies',
  ocorrencias: 'occurrences',
  agenda: 'calendar',
  ordens: 'orders',
  credenciais: 'credentials',
  notas: 'notes',
  plantao: 'onCall',
};
export function listRecords(data: unknown): ErpRecord[] {
  if (Array.isArray(data)) return data as ErpRecord[];
  if (data && typeof data === 'object') {
    const value = data as Record<string, unknown>;
    return (
      Array.isArray(value.items) ? value.items : Array.isArray(value.logs) ? value.logs : []
    ) as ErpRecord[];
  }
  return [];
}
const text = (value: unknown, fallback = '—') =>
  value === undefined || value === null || value === '' ? fallback : String(value);
const date = (value: unknown) => (value ? new Date(String(value)).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' }) : '—');
const label = (labels: Readonly<Record<string, string>>, value: unknown) =>
  labels[String(value)] || text(value);
export function visualRecord(key: string, record: ErpRecord): ErpRecord {
  const user =
    record.user && typeof record.user === 'object' ? (record.user as ErpRecord) : undefined;
  const r = user
    ? {
        ...record,
        ...user,
        roleCode: (record.role as { code?: string } | undefined)?.code || record.roleCode,
      }
    : record;
  const name = text(r.name || r.tradeName || r.legalName);
  const common = {
    ...r,
    name,
    initials: name
      .split(' ')
      .map((s) => s[0])
      .slice(0, 2)
      .join(''),
    status: label(
      {
        ACTIVE: 'Ativo',
        INACTIVE: 'Inativo',
        BLOCKED: 'Acesso bloqueado',
        SUSPENDED: 'Suspenso',
        ATIVO: 'Ativo',
        INATIVO: 'Inativo',
        MANUTENCAO: 'Manutenção',
        DESATIVADO: 'Desativado',
      },
      r.status,
    ),
  };
  if (['providers', 'tenants'].includes(key))
    return {
      ...common,
      email: text(r.techContactEmail || (r.contacts as { emails?: string[] })?.emails?.[0]),
      city: text(r.city || (r.address as { cidade?: string })?.cidade),
      document: text(r.taxId),
      orders: text(r.orderCount),
      active: text(r.activeOrderCount),
      sla: text(r.slaPercentage),
      users: text(r.userCount ?? (r._count as { users?: number })?.users),
      sectors: text(r.sectorCount ?? (r._count as { sectors?: number })?.sectors),
    };
  if (key === 'technicians')
    return {
      ...common,
      email: text(r.email),
      role: text(r.roleCode),
      active: text(r.activeOrderCount),
      done: text(r.completedOrderCount),
      sla: text(r.slaPercentage),
      status: text(r.availability || common.status),
    };
  if (key === 'articles')
    return {
      ...common,
      title: text(r.title),
      text: text(r.content, ''),
      category: Array.isArray(r.tags) ? text(r.tags[0], 'Sem categoria') : 'Sem categoria',
      author: text(r.authorName || (r.author as { name?: string })?.name, 'Autor não informado'),
      date: date(r.updatedAt),
      tags: Array.isArray(r.tags) ? r.tags : [],
      status: r.isPublished ? 'Publicado' : 'Rascunho',
    };
  if (key === 'assets')
    return {
      ...common,
      type: label(
        modules.assets.fields.find((f) => f.name === 'category')?.options || {},
        r.category,
      ),
      provider: text(r.provider),
      address: text(r.host || r.ipAddress),
      model: text(r.model || r.vendor),
      snapshots: text(r.snapshotCount),
    };
  if (key === 'services')
    return {
      ...common,
      description: text(r.description, ''),
      category: label(orderTypes, r.category),
      active: r.active === true,
      count: text(r.orderCount),
    };
  if (key === 'policies')
    return {
      ...common,
      name: `SLA · ${label(priorities, r.priority)}`,
      description: `${text(r.hours)} horas · ${r.serviceOrderType ? label(orderTypes, r.serviceOrderType) : 'Todos os tipos de serviço'}`,
      category: label(priorities, r.priority),
      active: r.active === true,
      count: text(r.orderCount),
    };
  if (key === 'orders')
    return {
      ...common,
      title: text(r.title),
      protocol: text(r.protocol),
      provider: text(
        r.provider || (r.occurrence as ErpRecord | undefined)?.provider || r.tenantName,
      ),
      analyst: text(r.analystName || r.ownerName),
      status: label(orderStatuses, r.status),
      priority: label(priorities, r.priority),
      type: label(orderTypes, r.type),
      date: date(r.createdAt),
      deadline: `${r.slaEligible === false ? 'Meta demonstrativa · ' : ''}${date(r.deadlineAt)}`,
      description: text(r.description, ''),
    };
  if (key === 'incidents')
    return {
      ...common,
      title: text(r.type),
      provider: text(r.provider),
      analyst: text(r.analystResponsible),
      status: label(occurrenceStatuses, r.status),
      priority: label(priorities, r.priority),
      date: date(r.createdAt),
      time: date(r.createdAt),
      orders: Array.isArray(r.serviceOrders) ? r.serviceOrders.length : 0,
      description: text(r.description),
    };
  if (key === 'events') {
    const start = new Date(String(r.startAt));
    const end = r.endAt ? new Date(String(r.endAt)) : null;
    return {
      ...common,
      name: text(r.title),
      title: text(r.title),
      date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
      day: start.getDate(),
      month: start.getMonth(),
      year: start.getFullYear(),
      time: start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      end: end?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || '—',
      type: text(r.type),
      person: text(r.assigneeName),
      color: text(r.color, 'primary'),
    };
  }
  if (key === 'notes')
    return {
      ...common,
      title: text(r.title),
      text: text(r.content, ''),
      date: date(r.updatedAt),
      color: 'bg-card',
    };
  if (key === 'credentials')
    return {
      ...common,
      name: text(r.equipmentName),
      user: text(r.username),
      type: text(r.equipmentType),
      address: text(r.host),
      updated: date(r.updatedAt),
    };
  return common;
}
export function useVisualSource(key: string, endpointOverride?: string) {
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);
  const moduleKey = visualModules[key] || key;
  const config = modules[moduleKey];
  const { scope } = useErp();
  const allowed = !scope || !config?.roles || config.roles.includes(scope.role);
  const id =
    routeModules[parts[1]] === moduleKey && parts[2] && !['nova', 'novo'].includes(parts[2])
      ? parts[2]
      : undefined;
  const individual = id && ['orders', 'occurrences'].includes(moduleKey);
  const endpoint =
    moduleKey === 'catalog'
      ? `${config?.endpoint}?activeOnly=false`
      : moduleKey === 'articles' && (!scope || ['super_admin', 'gerente'].includes(scope.role))
        ? `${config?.endpoint}?includeDrafts=true`
        : config?.endpoint;
  const query = useErpQuery<unknown>(
    allowed && config
      ? individual
        ? `${config.endpoint}/${encodeURIComponent(id)}`
        : endpointOverride || endpoint || config.endpoint
      : null,
  );
  const raw =
    individual && query.data && !Array.isArray(query.data)
      ? [query.data as ErpRecord]
      : listRecords(query.data);
  return { ...query, raw, rows: raw.map((r) => visualRecord(key, r)), moduleKey, id };
}
export function useVisualCollection<T>(
  key: string,
  _initial: T[] = [],
  endpoint?: string,
): [T[], Dispatch<SetStateAction<T[]>>] {
  const query = useVisualSource(key, endpoint);
  const action = useErpAction();
  const { scope } = useErp();
  const { mutate } = useSWRConfig();
  const rows = query.rows as T[];
  const setRows: Dispatch<SetStateAction<T[]>> = (value) => {
    const next = typeof value === 'function' ? value(rows) : value;
    const config = modules[query.moduleKey];
    const changed = (next as ErpRecord[]).find((row) => {
      const previous = (rows as ErpRecord[]).find((r) => r.id === row.id);
      return previous && previous.active !== row.active;
    });
    if (!changed || !config?.update || !action.connected) {
      toast.info('Utilize o formulário operacional. Nenhuma alteração foi salva.');
      return;
    }
    if (scope && !(config.updateRoles || config.createRoles)?.includes(scope.role)) {
      toast.error('Seu perfil não pode alterar este registro.');
      return;
    }
    const raw = query.raw.find((r) => r.id === changed.id)!;
    const body =
      config.updateMethod === 'PUT'
        ? Object.fromEntries(
            config.fields
              .filter((f) => raw[f.name] !== undefined)
              .map((f) => [f.name, raw[f.name]]),
          )
        : {};
    void action
      .execute({
        path: `${config.endpoint}/${encodeURIComponent(changed.id)}`,
        method: config.updateMethod || 'PATCH',
        body: { ...body, active: changed.active },
      })
      .then(async () => {
        await refreshVisualData(mutate);
        toast.success('Alteração confirmada pelo ERP');
      })
      .catch((error) => toast.error(errorMessage(error)));
  };
  return [rows, setRows];
}
export async function refreshVisualData(mutate: ReturnType<typeof useSWRConfig>['mutate']) {
  await mutate((key) => Array.isArray(key) && key[0] === 'erp');
}
export function useRouteBase() {
  const path = usePathname();
  return path.startsWith('/analista')
    ? '/analista'
    : path.startsWith('/cliente') || path.startsWith('/portal')
      ? '/cliente'
      : '/gerencia';
}
