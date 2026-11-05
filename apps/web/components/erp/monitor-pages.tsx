'use client';
import Link from 'next/link';
import { Activity, CheckCircle2, Timer } from 'lucide-react';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import { useRouteBase } from '@/lib/erp/visual-data';
import { PageHeading, Metric, StatusBadge } from './primitives';
import { QueryState } from './contract-form';
export { SlaPage } from './sla-monitor';

export function HealthPage() {
  const base = useRouteBase();
  const { scope } = useErp();
  const manager = !scope || ['super_admin', 'gerente'].includes(scope.role);
  const query = useErpQuery<{
    services?: { database?: { ok?: boolean }; redis?: { ok?: boolean } };
    stats?: { activeSessions?: number };
  }>(manager ? '/reports/health-summary' : null);
  const services = query.error ? undefined : query.data?.services;
  const database = services?.database?.ok;
  const redis = services?.redis?.ok;
  const available = database === undefined || redis === undefined ? undefined : database && redis;
  return (
    <>
      <PageHeading
        title="Saúde do sistema"
        description="Diagnóstico técnico do ERP: banco de dados, cache e sessões."
      >
        <StatusBadge
          status={
            available === undefined
              ? 'Sem diagnóstico'
              : available
                ? 'Serviços disponíveis'
                : 'Atenção'
          }
        />
      </PageHeading>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Metric
          label="Banco de dados"
          value={database === undefined ? '—' : database ? 'Disponível' : 'Indisponível'}
          foot="verificação do backend"
          icon={Activity}
        />
        <Metric
          label="Cache Redis"
          value={redis === undefined ? '—' : redis ? 'Disponível' : 'Indisponível'}
          foot="verificação do backend"
          icon={Timer}
        />
        <Metric
          label="Sessões ativas"
          value={String(query.error ? '—' : (query.data?.stats?.activeSessions ?? '—'))}
          foot="na consulta de diagnóstico"
          icon={CheckCircle2}
        />
      </div>
      <div className="panel p-5">
        <h2 className="section-title">Acompanhamento da operação</h2>
        <p className="section-subtitle">
          Os indicadores de atendimento e os diagnósticos técnicos possuem bases diferentes.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link className="text-link" href={base}>
            Painel da gerência
          </Link>
          <Link className="text-link" href={`${base}/sla`}>
            Prazos da equipe
          </Link>
          <Link className="text-link" href={`${base}/relatorios?tab=satisfaction`}>
            Satisfação dos atendimentos
          </Link>
        </div>
      </div>
    </>
  );
}
