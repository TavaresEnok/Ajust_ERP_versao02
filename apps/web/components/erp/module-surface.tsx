'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { routeModules, useVisualSource, useRouteBase } from '@/lib/erp/visual-data';
import { ConnectionNotice, QueryState } from './contract-form';
import { PageHeading } from './primitives';

export function ModuleSurface({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [, section, id] = path.split('/').filter(Boolean);
  const moduleKey = routeModules[section];
  const visualKey: Record<string, string> = {
    tenants: 'tenants',
    users: 'technicians',
    catalog: 'services',
    slaPolicies: 'policies',
    occurrences: 'incidents',
    calendar: 'events',
  };
  // Só a tela de detalhe precisa conferir se o registro existe. Nas listagens a própria página
  // busca o que mostra; buscar aqui baixava a lista inteira do módulo (inclusive todas as O.S.
  // e o cofre) a cada navegação.
  const checksRecord = Boolean(id && moduleKey && !['nova', 'novo'].includes(id));
  const query = useVisualSource(checksRecord ? visualKey[moduleKey] || moduleKey : '');
  const base = useRouteBase();
  const missing =
    id &&
    moduleKey &&
    !['nova', 'novo'].includes(id) &&
    query.connected &&
    !query.isLoading &&
    !query.error &&
    !query.raw.some((r) => r.id === id || (r.user as { id?: string } | undefined)?.id === id);
  if (missing)
    return (
      <>
        <PageHeading
          title="Página não encontrada"
          description={`O registro ${id} não foi encontrado ou não está disponível para sua sessão.`}
        />
        <Link className="text-link" href={`${base}/${section || ''}`}>
          Voltar para a listagem
        </Link>
      </>
    );
  if (id && moduleKey && query.isLoading) return <QueryState loading />;
  if (id && moduleKey && query.error)
    return <QueryState error={query.error} onRetry={() => void query.mutate()} />;
  return (
    <>
      {!query.connected && <ConnectionNotice />}
      {children}
    </>
  );
}
