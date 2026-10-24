'use client';
import type { ProviderRow, TechnicianRow } from '@/lib/demo-data';
import { useRouteBase, useVisualSource, listRecords } from '@/lib/erp/visual-data';
import { useErpQuery } from '@/lib/erp/gateway';
import { SecurityWorkspace } from './security-workspace';
import { OperationControl } from './operation-controls';
import { useSWRConfig } from 'swr';
import { refreshVisualData } from '@/lib/erp/visual-data';
import { ErpEmpty } from './contract-form';
import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Search,
  MoreHorizontal,
  ArrowLeft,
  Mail,
  MapPin,
  Globe,
  ExternalLink,
  Timer,
  ClipboardList,
  CheckCircle2,
  ArrowDownToLine,
  Phone,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrders, exportCsv, useDemoCollection } from '@/lib/demo-store';
import {
  PageHeading,
  PanelHeading,
  Avatar,
  StatusBadge,
  ViewLink,
  Metric,
  SearchEmpty,
} from './primitives';
import { RecordDialog } from './record-dialog';
import { OrdersTable } from './orders';
import { VolumeChart } from './dashboard-charts';
import { cn } from '@/lib/utils';
export function ProvidersPage() {
  const portalBase = useRouteBase();
  const [providers, setProviders] = useDemoCollection<ProviderRow>('providers');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const filtered = providers.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (status === 'Todos' || p.status === status),
  );
  return (
    <>
      <PageHeading
        title="Provedores"
        description="Relacionamentos bem cuidados. Operação mais conectada."
      >
        <Button
          variant="outline"
          onClick={() =>
            exportCsv(
              'provedores',
              ['Nome', 'E-mail', 'Cidade', 'Status'],
              filtered.map((p) => [p.name, p.email, p.city, p.status]),
            )
          }
        >
          <ArrowDownToLine data-icon="inline-start" />
          Exportar
        </Button>
        <RecordDialog
          title="Novo provedor"
          fields={[
            { name: 'name', label: 'Nome do provedor' },
            { name: 'email', label: 'E-mail de contato', type: 'email' },
            { name: 'city', label: 'Cidade e estado' },
          ]}
        />
      </PageHeading>
      <div className="mb-5 flex flex-wrap justify-between gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            aria-label="Buscar provedores"
            placeholder="Buscar nome do provedor..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-52 bg-transparent text-xs outline-none"
          />
        </div>
        <select
          className="native-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status dos provedores"
        >
          <option>Todos</option>
          <option>Ativo</option>
          <option>Inativo</option>
        </select>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p, i) => (
          <article className="panel" key={p.id}>
            <div className="flex items-center justify-between p-5 pb-3">
              <span
                className={cn(
                  'flex size-11 items-center justify-center rounded-xl text-sm font-semibold',
                  i % 3 === 0
                    ? 'bg-secondary text-primary'
                    : i % 3 === 1
                      ? 'bg-info/10 text-info'
                      : 'bg-warning/10 text-warning',
                )}
              >
                {p.initials}
              </span>
              <StatusBadge status={p.status} />
            </div>
            <div className="px-5">
              <Link
                href={portalBase + '/provedores/' + p.id}
                className="text-[15px] font-semibold tracking-tight hover:text-primary"
              >
                {p.name}
              </Link>
              <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <MapPin className="size-3" />
                {p.city}
              </p>
              <p className="mt-2 text-[10px] text-muted-foreground">{p.email}</p>
              <div className="my-5 grid grid-cols-3 divide-x divide-border">
                <div>
                  <p className="text-[9px] text-muted-foreground">Total de ordens</p>
                  <strong className="mt-1 block text-xl font-medium">{p.orders}</strong>
                </div>
                <div className="pl-3">
                  <p className="text-[9px] text-muted-foreground">Em aberto</p>
                  <strong className="mt-1 block text-xl font-medium">{p.active}</strong>
                </div>
                <div className="pl-3">
                  <p className="text-[9px] text-muted-foreground">Dentro do SLA</p>
                  <strong className="mt-1 block text-xl font-medium text-primary">
                    {String(p.sla) === '—' ? '—' : `${String(p.sla).replace('.', ',')}%`}
                  </strong>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <ViewLink href={portalBase + '/provedores/' + p.id}>Visão 360° do provedor</ViewLink>
              <RecordDialog
                title="Editar provedor"
                recordId={p.id}
                trigger={
                  <MoreHorizontal
                    className="size-4 text-muted-foreground"
                    aria-label={'Editar ' + p.name}
                  />
                }
                fields={[
                  { name: 'name', label: 'Nome', value: p.name },
                  {
                    name: 'email',
                    label: 'E-mail',
                    type: 'email',
                    value: p.email,
                  },
                  { name: 'city', label: 'Cidade', value: p.city },
                  {
                    name: 'status',
                    label: 'Status',
                    options: ['Ativo', 'Inativo'],
                    value: p.status,
                  },
                ]}
              />
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && <SearchEmpty />}
    </>
  );
}
export function ProviderDetail({
  id,
  initialTab = 'Visão geral',
}: {
  id: string;
  initialTab?: string;
}) {
  const portalBase = useRouteBase();
  const [providerItems] = useDemoCollection<ProviderRow>('providers');
  const provider = providerItems.find((p) => p.id === id);
  const source = useVisualSource('providers');
  const raw = source.raw.find((row) => row.id === id);
  const orderSource = useVisualSource('orders');
  const { orders } = useOrders();
  const [tab, setTab] = useState(initialTab);
  if (!provider)
    return (
      <>
        <PageHeading
          title="Provedor indisponível"
          description={`O registro ${id} não está disponível na consulta atual.`}
        />
        <Link href={portalBase + '/provedores'} className="text-link">
          Voltar para provedores
        </Link>
      </>
    );
  const providerOrders = orders.filter((order) =>
    orderSource.raw.some((row) => row.id === order.id && row.tenantId === id),
  );
  return (
    <>
      <Link
        href={portalBase + '/provedores'}
        className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft className="size-3" />
        Todos os provedores
      </Link>
      <PageHeading
        title={provider.name}
        description="Visão 360° · Dados, atendimentos e acessos do provedor."
      >
        <StatusBadge status={provider.status} />
        <RecordDialog title="Editar provedor" moduleKey="tenants" recordId={id} fields={[]} />
        <Link href={portalBase + '/ordens/nova'} className="text-link">
          Abrir nova ordem
          <ClipboardList className="size-4" />
        </Link>
      </PageHeading>
      <div className="mb-6 flex gap-6 overflow-x-auto border-b border-border">
        {['Visão geral', 'Ordens de serviço', 'Contatos', 'Serviços', 'Histórico'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'whitespace-nowrap border-b-2 pb-3 text-xs',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Visão geral' ? (
        <>
          <div className="metrics-grid mb-5 grid grid-cols-4 gap-4">
            <Metric
              label="Ordens de serviço"
              value={String(provider.orders)}
              change="ERP"
              foot="neste mês"
              icon={ClipboardList}
            />
            <Metric
              label="Em aberto"
              value={String(provider.active)}
              change="ERP"
              foot="em atendimento"
              icon={Timer}
            />
            <Metric
              label="Cumprimento de SLA"
              value={String(provider.sla) === '—' ? '—' : provider.sla + '%'}
              change="ERP"
              foot="neste mês"
              icon={ShieldCheck}
            />
            <Metric
              label="Satisfação"
              value={raw?.csatAverage !== undefined ? String(raw.csatAverage) : '—'}
              change="Satisfação"
              foot="consulte as pesquisas recebidas"
              icon={CheckCircle2}
            />
          </div>
          <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_300px]">
            <section className="panel">
              <PanelHeading title="Atendimentos no período" />
              <div className="px-5 pb-5">
                <VolumeChart tenantId={id} />
              </div>
            </section>
            <section className="panel">
              <PanelHeading title="Informações do provedor" />
              <div className="flex flex-col gap-5 px-5 pb-5">
                {[
                  {
                    icon: Building2,
                    label: 'Razão social',
                    text: String(raw?.legalName || '—'),
                  },
                  { icon: Mail, label: 'E-mail', text: provider.email },
                  { icon: MapPin, label: 'Localização', text: provider.city },
                  {
                    icon: CalendarDays,
                    label: 'Cliente desde',
                    text: raw?.createdAt
                      ? new Date(String(raw.createdAt)).toLocaleDateString('pt-BR')
                      : '—',
                  },
                ].map((i) => (
                  <div key={i.label} className="flex gap-3">
                    <i.icon className="mt-1 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-[9px] text-muted-foreground">{i.label}</p>
                      <p className="mt-1 text-xs">{i.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="panel">
            <PanelHeading title="Últimas ordens" />
            <OrdersTable orders={providerOrders} compact />
          </section>
        </>
      ) : tab === 'Ordens de serviço' ? (
        <section className="panel">
          <OrdersTable orders={providerOrders} />
        </section>
      ) : tab === 'Contatos' ? (
        <div className="panel p-6">
          <h2 className="section-title">Responsável pela operação</h2>
          <p className="my-3 text-xs">{String(raw?.techContactName || '—')}</p>
          <p className="mb-3 text-xs text-muted-foreground">
            {String(raw?.techContactPhone || '—')}
          </p>
          <a href={'mailto:' + provider.email} className="text-link">
            <Mail />
            {provider.email}
          </a>
        </div>
      ) : tab === 'Serviços' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {!Array.isArray(raw?.services) && (
            <div className="panel p-6 text-xs leading-6 text-muted-foreground">
              O cadastro IAM não expõe serviços contratados por provedor. O catálogo operacional
              continua disponível em Serviços.
            </div>
          )}
          {(Array.isArray(raw?.services) ? raw.services.map(String) : []).map((s) => (
            <div className="panel p-5" key={s}>
              <CheckCircle2 className="mb-4 size-5 text-primary" />
              <h2 className="section-title">{s}</h2>
              <p className="mt-3 text-xs text-muted-foreground">Serviço contratado · SLA padrão</p>
            </div>
          ))}
        </div>
      ) : (
        <section className="panel p-6">
          <p className="mb-4 text-xs text-muted-foreground">
            Datas cadastrais retornadas pelo ERP. Eventos detalhados ficam na auditoria.
          </p>
          {[
            raw?.createdAt
              ? `Cadastro · ${new Date(String(raw.createdAt)).toLocaleString('pt-BR')}`
              : 'Data de cadastro não informada',
            raw?.updatedAt
              ? `Última atualização · ${new Date(String(raw.updatedAt)).toLocaleString('pt-BR')}`
              : 'Sem data de atualização',
          ].map((t) => (
            <div key={t} className="timeline-item text-xs">
              {t}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
export function TechniciansPage() {
  const portalBase = useRouteBase();
  const { mutate } = useSWRConfig();
  const [team, setTeam] = useDemoCollection<TechnicianRow>('technicians');
  const teamSource = useVisualSource('technicians');
  const analystIds = new Set(
    teamSource.raw
      .filter((row) => (row.role as { code?: string })?.code === 'analista')
      .map((row) => (row.user as { id?: string })?.id || row.id),
  );
  const analysts = team.filter((person) => analystIds.has(person.id));
  const [search, setSearch] = useState('');
  return (
    <>
      <PageHeading
        title="Equipe técnica"
        description="Pessoas conectadas. Atendimentos que fazem a diferença."
      >
        <Link className="text-link" href={`${portalBase}/relatorios?tab=team`}>
          Performance da equipe
        </Link>
        <Link className="text-link" href={`${portalBase}/usuarios`}>
          Usuários e acessos
        </Link>
        <RecordDialog
          title="Adicionar integrante"
          fields={[
            { name: 'name', label: 'Nome completo' },
            { name: 'email', label: 'E-mail corporativo', type: 'email' },
            {
              name: 'role',
              label: 'Cargo',
              options: ['Analista de redes', 'Analista de suporte', 'Técnico de campo', 'Gestor'],
            },
          ]}
        />
      </PageHeading>
      <p className="mb-5 rounded-lg border border-border p-4 text-xs leading-6 text-muted-foreground">
        Contas bloqueadas não conseguem entrar no ERP. O gestor deve conferir os dados de acesso e
        ativar apenas quem fará parte da equipe operacional.
      </p>
      <div className="panel">
        <PanelHeading
          title="Pessoas da operação"
          description={
            analysts.length +
            ' analistas · contas administrativas e de clientes ficam em Usuários e acessos'
          }
        >
          <div className="flex items-center gap-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar integrante..."
              aria-label="Buscar integrante"
              className="w-36 bg-transparent text-xs outline-none"
            />
          </div>
        </PanelHeading>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Integrante</th>
                <th>Função</th>
                <th>Situação do acesso</th>
                <th>O.S. ativas</th>
                <th>O.S. concluídas</th>
                <th>SLA</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {analysts
                .filter((t) => (t.name + t.role).toLowerCase().includes(search.toLowerCase()))
                .map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link
                        className="flex items-center gap-3"
                        href={portalBase + '/tecnicos/' + t.id}
                      >
                        <Avatar name={t.name} />
                        <span>
                          <strong className="block font-medium">{t.name}</strong>
                          <span className="mt-1 block text-[9px] text-muted-foreground">
                            {t.email}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>{t.role}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>{t.active}</td>
                    <td>{t.done}</td>
                    <td className="text-primary">{t.sla}</td>
                    <td>
                      <RecordDialog
                        title="Editar integrante"
                        recordId={t.id}
                        trigger={
                          <MoreHorizontal className="size-4" aria-label={'Editar ' + t.name} />
                        }
                        fields={[
                          { name: 'name', label: 'Nome', value: t.name },
                          { name: 'role', label: 'Função', value: t.role },
                          {
                            name: 'status',
                            label: 'Disponibilidade',
                            value: t.status,
                            options: ['Disponível', 'Em atendimento', 'Em campo', 'Ausente'],
                          },
                        ]}
                      />
                      <OperationControl
                        title="Remover integrante"
                        description={`Remover o acesso de ${t.name}? O servidor valida os vínculos e as permissões.`}
                        path={`/iam/users/${encodeURIComponent(t.id)}`}
                        method="DELETE"
                        roles={['super_admin', 'gerente', 'cliente']}
                        after={async () => {
                          await refreshVisualData(mutate);
                        }}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-5">
        <div className="flex items-center gap-3">
          <Users className="size-5 text-primary" />
          <div>
            <h2 className="section-title">Equipe bem distribuída, operação mais leve.</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Consulte a agenda e a escala de plantão para organizar a capacidade do time.
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-6">
          <ViewLink href={portalBase + '/agenda'}>Agenda da equipe</ViewLink>
          <ViewLink href={portalBase + '/plantao'}>Escala de plantão</ViewLink>
        </div>
      </div>
    </>
  );
}
export function TechnicianDetail({
  id,
  initialTab = 'Visão geral',
}: {
  id: string;
  initialTab?: string;
}) {
  const portalBase = useRouteBase();
  const [team] = useDemoCollection<TechnicianRow>('technicians');
  const member = team.find((t) => t.id === id);
  const { orders } = useOrders();
  const [tab, setTab] = useState(initialTab);
  const events = useErpQuery<unknown>(tab === 'Agenda' ? '/calendar/events/all' : null);
  const orderSource = useVisualSource('orders');
  const assignedOrders = orders.filter((order) =>
    orderSource.raw.some(
      (raw) => raw.id === order.id && (raw.assigneeUserId === id || raw.ownerUserId === id),
    ),
  );
  if (!member)
    return (
      <PageHeading title="Técnico não encontrado" description={`Registro ${id} indisponível.`} />
    );
  return (
    <>
      <Link href={portalBase + '/tecnicos'} className="mb-4 text-link">
        <ArrowLeft />
        Voltar para equipe
      </Link>
      <PageHeading title={member.name} description={member.role + ' · ' + member.email}>
        <StatusBadge status={member.status} />
        <RecordDialog title="Editar técnico" moduleKey="users" recordId={id} fields={[]} />
      </PageHeading>
      <div className="mb-6 flex flex-wrap gap-3">
        {['Visão geral', 'Ordens de serviço', 'Agenda', 'Sessões'].map((name) => (
          <Button
            key={name}
            onClick={() => setTab(name)}
            variant={tab === name ? 'secondary' : 'outline'}
          >
            {name}
          </Button>
        ))}
      </div>
      {tab === 'Sessões' ? (
        <SecurityWorkspace embedded initialUserId={id} />
      ) : tab === 'Agenda' ? (
        <section className="panel p-6">
          <h2 className="section-title mb-5">Compromissos do integrante</h2>
          {listRecords(events.data)
            .filter((event) => event.assigneeId === id)
            .map((event) => (
              <div className="timeline-item" key={event.id}>
                <p className="text-xs">{String(event.title)}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(String(event.startAt)).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          {!listRecords(events.data).some((event) => event.assigneeId === id) && (
            <ErpEmpty connected={events.connected} />
          )}
          <Link href={`${portalBase}/agenda`} className="text-link mt-5">
            Abrir agenda da equipe
          </Link>
        </section>
      ) : (
        <>
          <div className="metrics-grid mb-5 grid grid-cols-3 gap-4">
            <Metric
              label="Atendimentos ativos"
              value={String(member.active)}
              change="Hoje"
              foot="carga de trabalho"
              icon={ClipboardList}
            />
            <Metric
              label="Ordens concluídas"
              value={String(member.done)}
              change="ERP"
              foot="neste período"
              icon={CheckCircle2}
            />
            <Metric
              label="Cumprimento de SLA"
              value={String(member.sla)}
              change="ERP"
              foot="indicador retornado pelo servidor"
              icon={Timer}
            />
          </div>
          <section className="panel">
            <PanelHeading title="Ordens do integrante" />
            <OrdersTable orders={assignedOrders} />
          </section>
        </>
      )}
    </>
  );
}
