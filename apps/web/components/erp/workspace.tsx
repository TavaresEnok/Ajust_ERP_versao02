'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from './app-shell';
import { Dashboard } from './dashboard';
import { OrdersPage, OrderDetail } from './orders';
import { OrderForm } from './order-form';
import { ProvidersPage, ProviderDetail, TechniciansPage, TechnicianDetail } from './people-pages';
import { CalendarPage, OccurrencesPage } from './calendar-pages';
import { KnowledgePage } from './knowledge-pages';
import { CredentialsPage, NotesPage } from './personal-pages';
import { SlaPage, HealthPage } from './monitor-pages';
import { ReportsPage } from './reports-page';
import { OnCallPage, OrderTrailPage } from './operational-pages';
import { CatalogPage, WorkflowsPage } from './catalog-pages';
import { AssetsPage } from './assets-page';
import { TenantsPage } from './tenants-page';
import { SettingsPage, NotificationsConfigPage } from './settings-pages';
import { SecurityPage, IntegrationsPage } from './security-pages';
import { AuthPage, SatisfactionPage } from './public-pages';
import { PageHeading } from './primitives';
import dynamic from 'next/dynamic';
import { modules } from '@/lib/erp/modules';
import { useErp } from '@/lib/erp/gateway';
import { canAccessSection } from '@/lib/erp/access';
import { ModuleSurface } from './module-surface';
import { detailTabLabels } from '@/lib/erp/routes';
import { operationalSections } from './operational-router';
const AuditWorkspace = dynamic(() =>
  import('./audit-workspace').then((module) => module.AuditWorkspace),
);
const ResourcePage = dynamic(() => import('./resource-page').then((module) => module.ResourcePage));
const RecordWorkspace = dynamic(() =>
  import('./record-workspace').then((module) => module.RecordWorkspace),
);
const WorkflowEditorPage = dynamic(() =>
  import('./workflow-editor').then((module) => module.WorkflowEditorPage),
);
const ProcessTemplatesPage = dynamic(() =>
  import('./process-templates').then((module) => module.ProcessTemplatesPage),
);
const SlaWorkspace = dynamic(() => import('./sla-workspace').then((module) => module.SlaWorkspace));
const CmdbWorkspace = dynamic(() =>
  import('./cmdb-workspace').then((module) => module.CmdbWorkspace),
);
const TenantAdministration = dynamic(() =>
  import('./tenant-administration').then((module) => module.TenantAdministration),
);
const IntegrationWorkspace = dynamic(() =>
  import('./integration-workspace').then((module) => module.IntegrationWorkspace),
);
const RealtimeEventsWorkspace = dynamic(() =>
  import('./realtime-events-workspace').then((module) => module.RealtimeEventsWorkspace),
);
export function Workspace({ path = '/' }: { path?: string }) {
  const { scope } = useErp();
  if (['/login', '/forgot-password', '/reset-password'].includes(path))
    return <AuthPage mode={path.slice(1)} />;
  if (path.startsWith('/csat/')) return <SatisfactionPage token={path.split('/')[2] || ''} />;
  const parts = path.split('/').filter(Boolean);
  const section = parts[1];
  const id = parts[2];
  const detailSection = parts[3];
  function content() {
    const base =
      parts[0] === 'cliente' || parts[0] === 'portal'
        ? '/cliente'
        : parts[0] === 'analista'
          ? '/analista'
          : '/gerencia';
    if (section === 'operacoes' && id && modules[id]) {
      if (parts[3] && ['orders', 'occurrences', 'changes'].includes(id))
        return (
          <RecordWorkspace
            key={path}
            kind={id as 'orders' | 'occurrences' | 'changes'}
            id={parts[3]}
            base={base}
          />
        );
      return <ResourcePage key={path} moduleKey={id} base={base} />;
    }
    if (section === 'empresa') return <TenantAdministration />;
    if (section === 'ixc') return <IntegrationWorkspace />;
    if (section === 'eventos-tempo-real') return <RealtimeEventsWorkspace />;
    if (section === 'mudancas')
      return id ? (
        <RecordWorkspace kind="changes" id={id} base={base} />
      ) : (
        <ResourcePage moduleKey="changes" base={base} />
      );
    if (section === 'apontamentos') return <ResourcePage moduleKey="time" base={base} />;
    if (section === 'usuarios') return <ResourcePage moduleKey="users" base={base} />;
    if (section === 'auditoria') return <AuditWorkspace />;
    if (section === 'processos') return <ProcessTemplatesPage />;
    if (section === 'automacoes') return <WorkflowEditorPage key={path} id={id} />;
    if (section === 'calendario-sla') return <SlaWorkspace />;
    if (section === 'configuracoes-ativos') return <CmdbWorkspace />;
    if (path === '/' || path === '/gerencia') return <Dashboard />;
    if (path === '/analista') return <Dashboard analyst />;
    if (path === '/cliente' || path === '/portal') return <OrdersPage customer />;
    if (section === 'ordens')
      return id === 'nova' ? (
        <>
          <PageHeading
            title="Nova ordem de serviço"
            description="Uma nova solicitação com tudo que sua equipe precisa."
          />
          <OrderForm inline />
        </>
      ) : id ? (
        <OrderDetail key={path} id={id} initialTab={detailTabLabels[detailSection]} />
      ) : (
        <OrdersPage
          analyst={parts[0] === 'analista'}
          customer={parts[0] === 'cliente' || parts[0] === 'portal'}
        />
      );
    if (section === 'agenda') return <CalendarPage />;
    if (section === 'ocorrencias')
      return <OccurrencesPage key={path} id={id} initialTab={detailTabLabels[detailSection]} />;
    if (section === 'provedores')
      return id ? (
        <ProviderDetail
          key={path}
          id={id}
          initialTab={
            detailSection === 'ordens' ? 'Ordens de serviço' : detailTabLabels[detailSection]
          }
        />
      ) : (
        <ProvidersPage />
      );
    if (section === 'tecnicos')
      return id ? (
        <TechnicianDetail
          key={path}
          id={id}
          initialTab={
            detailSection === 'ordens'
              ? 'Ordens de serviço'
              : detailSection === 'agenda'
                ? 'Agenda'
                : detailSection === 'sessoes'
                  ? 'Sessões'
                  : 'Visão geral'
          }
        />
      ) : (
        <TechniciansPage />
      );
    if (section === 'sla') return <SlaPage />;
    if (section === 'saude') return <HealthPage />;
    if (section === 'plantao') return <OnCallPage />;
    if (section === 'ativos')
      return <AssetsPage key={path} id={id} initialTab={detailTabLabels[detailSection]} />;
    if (section === 'ajustpedia')
      return <KnowledgePage key={path} id={id} editing={detailSection === 'editar'} />;
    if (section === 'credenciais') return <CredentialsPage />;
    if (section === 'notas') return <NotesPage />;
    if (section === 'relatorios') return <ReportsPage />;
    if (section === 'empresas')
      return <TenantsPage key={path} id={id} initialTab={detailTabLabels[detailSection]} />;
    if (section === 'servicos')
      return (
        <CatalogPage key={path} kind="services" id={id} editOnOpen={detailSection === 'editar'} />
      );
    if (section === 'politicas-sla')
      return (
        <CatalogPage key={path} kind="policies" id={id} editOnOpen={detailSection === 'editar'} />
      );
    if (section === 'workflows') return <WorkflowsPage id={id} />;
    if (section === 'seguranca') return <SecurityPage key={id} section={id} />;
    if (section === 'notificacoes') return <NotificationsConfigPage key={id} section={id} />;
    if (section === 'integracoes') return <IntegrationsPage key={id} section={id} />;
    if (section === 'configuracoes')
      return id === 'notificacoes' ? (
        <NotificationsConfigPage />
      ) : id === 'integracoes' ? (
        <IntegrationsPage />
      ) : id === 'empresa' ? (
        <TenantAdministration />
      ) : (
        <SettingsPage key={id} section={id === 'meu-perfil' ? 'perfil' : id} />
      );
    if (section === 'trilha-os') return <OrderTrailPage />;
    return (
      <>
        <PageHeading
          title="Vamos encontrar seu caminho?"
          description="Esta página não está disponível no ambiente demonstrativo."
        />
        <Link href="/" className="text-link">
          Voltar para o dashboard
        </Link>
      </>
    );
  }
  const base =
    parts[0] === 'cliente' || parts[0] === 'portal'
      ? '/cliente'
      : parts[0] === 'analista'
        ? '/analista'
        : '/gerencia';
  const allowed = !scope || canAccessSection(scope.role, section, id);
  const hasOperational = !section || operationalSections.has(section);
  return (
    <AppShell>
      <Suspense fallback={<p className="p-8 text-muted-foreground">Preparando seu workspace...</p>}>
        {!allowed ? (
          <PageHeading
            title="Acesso não disponível"
            description="Seu perfil não possui acesso a esta área. O backend também deve validar todas as operações."
          />
        ) : hasOperational ? (
          <ModuleSurface key={path}>{content()}</ModuleSurface>
        ) : (
          content()
        )}
      </Suspense>
    </AppShell>
  );
}
