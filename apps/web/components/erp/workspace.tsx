'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from './app-shell';
import { AuthPage, SatisfactionPage } from './public-pages';
import { PageHeading } from './primitives';
import dynamic from 'next/dynamic';
import { modules } from '@/lib/erp/modules';
import { useErp } from '@/lib/erp/gateway';
import { canAccessSection } from '@/lib/erp/access';
import { ModuleSurface } from './module-surface';
import { detailTabLabels } from '@/lib/erp/routes';
import { operationalSections } from './operational-router';
// Cada tela carrega só quando é aberta: com imports estáticos, até o /login baixava o ERP
// inteiro (gráficos, editor de fluxos, cofre).
const Dashboard = dynamic(() => import('./dashboard').then((module) => module.Dashboard));
const ShiftReportsPage = dynamic(() =>
  import('./shift-reports').then((module) => module.ShiftReportsPage),
);
const AnalystDashboard = dynamic(() =>
  import('./analyst-dashboard').then((module) => module.AnalystDashboard),
);
const OrdersPage = dynamic(() => import('./orders').then((module) => module.OrdersPage));
const OrderDetail = dynamic(() => import('./orders').then((module) => module.OrderDetail));
const OrderForm = dynamic(() => import('./order-form').then((module) => module.OrderForm));
const TechniciansPage = dynamic(() =>
  import('./people-pages').then((module) => module.TechniciansPage),
);
const TechnicianDetail = dynamic(() =>
  import('./people-pages').then((module) => module.TechnicianDetail),
);
const CalendarPage = dynamic(() =>
  import('./calendar-pages').then((module) => module.CalendarPage),
);
const OccurrencesPage = dynamic(() =>
  import('./calendar-pages').then((module) => module.OccurrencesPage),
);
const KnowledgePage = dynamic(() =>
  import('./knowledge-pages').then((module) => module.KnowledgePage),
);
const CredentialsPage = dynamic(() =>
  import('./personal-pages').then((module) => module.CredentialsPage),
);
const NotesPage = dynamic(() => import('./personal-pages').then((module) => module.NotesPage));
const SlaPage = dynamic(() => import('./monitor-pages').then((module) => module.SlaPage));
const HealthPage = dynamic(() => import('./monitor-pages').then((module) => module.HealthPage));
const ReportsPage = dynamic(() => import('./reports-page').then((module) => module.ReportsPage));
const OnCallPage = dynamic(() => import('./operational-pages').then((module) => module.OnCallPage));
const OrderTrailPage = dynamic(() =>
  import('./operational-pages').then((module) => module.OrderTrailPage),
);
const CatalogPage = dynamic(() => import('./catalog-pages').then((module) => module.CatalogPage));
const ServiceTypesAnalyticsPage = dynamic(() =>
  import('./service-types-analytics').then((module) => module.ServiceTypesAnalyticsPage),
);
const TenantsPage = dynamic(() => import('./tenants-page').then((module) => module.TenantsPage));
const SettingsPage = dynamic(() =>
  import('./settings-pages').then((module) => module.SettingsPage),
);
const NotificationsConfigPage = dynamic(() =>
  import('./settings-pages').then((module) => module.NotificationsConfigPage),
);
const SecurityPage = dynamic(() =>
  import('./security-pages').then((module) => module.SecurityPage),
);
const IntegrationsPage = dynamic(() =>
  import('./security-pages').then((module) => module.IntegrationsPage),
);
const CustomerPortal = dynamic(() =>
  import('./customer-portal').then((module) => module.CustomerPortal),
);
const SecurityWorkspace = dynamic(() =>
  import('./security-workspace').then((module) => module.SecurityWorkspace),
);
const AuditWorkspace = dynamic(() =>
  import('./audit-workspace').then((module) => module.AuditWorkspace),
);
const CustomerDirectory = dynamic(() =>
  import('./customer-directory').then((m) => m.CustomerDirectory),
);
const NetworkTopologiesPage = dynamic(() =>
  import('./network-topologies').then((m) => m.NetworkTopologiesPage),
);
const ResourcePage = dynamic(() => import('./resource-page').then((module) => module.ResourcePage));
const RecordWorkspace = dynamic(() =>
  import('./record-workspace').then((module) => module.RecordWorkspace),
);
const WorkflowEditorPage = dynamic(() =>
  import('./workflow-editor').then((module) => module.WorkflowEditorPage),
);
const ProcessTemplatesPage = dynamic(() =>
  import('./operational-workflows').then((module) => module.ServiceProcessesHub),
);
const WorkflowsHub = dynamic(() =>
  import('./workflow-designer').then((module) => module.WorkflowsHub),
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
const UserGuide = dynamic(() => import('./user-guide').then((module) => module.UserGuide));
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
    if (scope?.role === 'cliente' && scope.customerId) {
      if (section === 'notas') return <NotesPage />;
      if (section === 'configuracoes' || section === 'seguranca')
        return <SecurityWorkspace initialTab="profile" />;
      if (!section || section === 'ordens' || section === 'agenda')
        return (
          <CustomerPortal key={path} section={section} id={section === 'ordens' ? id : undefined} />
        );
      return (
        <PageHeading
          title="Área não disponível no portal do cliente"
          description="Consulte seus atendimentos, agenda, notas pessoais ou sua conta."
        />
      );
    }
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
    if (section === 'processos') return <ProcessTemplatesPage id={id} base={base} />;
    if (section === 'automacoes') return <WorkflowEditorPage key={path} id={id} />;
    if (section === 'calendario-sla') return <SlaWorkspace />;
    if (section === 'politicas-sla' && !id) return <SlaWorkspace initialTab="Políticas" />;
    if (section === 'configuracoes-ativos') return <CmdbWorkspace />;
    if (path === '/' || path === '/gerencia')
      return scope?.role === 'analista' ? <AnalystDashboard /> : <Dashboard />;
    if (path === '/analista') return <AnalystDashboard />;
    if (path === '/cliente' || path === '/portal') return <OrdersPage customer />;
    if (section === 'ordens')
      return id === 'nova' ? (
        <>
          <PageHeading
            title="Abrir atendimento"
            description="Uma nova ocorrência com a primeira O.S., ou um novo trabalho em uma ocorrência existente."
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
    if (section === 'provedores') return <CustomerDirectory key={path} id={id} />;
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
    if (section === 'ativos') return <NetworkTopologiesPage key={path} customerId={id} />;
    if (section === 'ajustpedia')
      return <KnowledgePage key={path} id={id} editing={detailSection === 'editar'} />;
    if (section === 'credenciais') return <CredentialsPage />;
    if (section === 'notas') return <NotesPage />;
    if (section === 'relatorios-turno') return <ShiftReportsPage />;
    if (section === 'relatorios') return <ReportsPage />;
    if (section === 'empresas')
      return <TenantsPage key={path} id={id} initialTab={detailTabLabels[detailSection]} />;
    if (section === 'servicos')
      return id ? (
        <CatalogPage key={path} kind="services" id={id} editOnOpen={detailSection === 'editar'} />
      ) : (
        <ServiceTypesAnalyticsPage />
      );
    if (section === 'politicas-sla')
      return (
        <CatalogPage key={path} kind="policies" id={id} editOnOpen={detailSection === 'editar'} />
      );
    if (section === 'workflows') return <WorkflowsHub id={id} />;
    if (section === 'guia')
      return <UserGuide audience={base === '/analista' ? 'analista' : 'gerencia'} />;
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
  // Topologies resolve provider IDs themselves, rather than legacy equipment IDs.
  const hasOperational = section !== 'ativos' && (!section || operationalSections.has(section));
  return (
    <AppShell>
      <Suspense fallback={<p className="p-8 text-muted-foreground">Preparando seu workspace...</p>}>
        {!allowed ? (
          <PageHeading
            title="Acesso não disponível"
            description="Seu perfil não possui acesso a esta área. O backend também deve validar todas as operações."
          />
        ) : scope?.role === 'cliente' && scope.customerId ? (
          content()
        ) : hasOperational ? (
          <ModuleSurface key={path}>{content()}</ModuleSurface>
        ) : (
          content()
        )}
      </Suspense>
    </AppShell>
  );
}
