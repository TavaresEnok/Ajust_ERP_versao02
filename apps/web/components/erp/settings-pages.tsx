'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Mail,
  MessageSquare,
  ShieldCheck,
  Globe,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { useErpAction, useErpQuery, useErp } from '@/lib/erp/gateway';
import { listRecords, useRouteBase } from '@/lib/erp/visual-data';
import { errorMessage } from '@/lib/erp/contracts';
import { toast } from 'sonner';
import { PageHeading, PanelHeading, StatusBadge } from './primitives';
import { RecordDialog } from './record-dialog';
import { TenantAdministration } from './tenant-administration';
import { SecurityWorkspace } from './security-workspace';
import { OperationControl } from './operation-controls';
import { QueryState, ErpEmpty } from './contract-form';
import { useAppTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import { canAccessCompanySettings } from '@/lib/erp/access';
const settings = [
  { slug: 'geral', name: 'Geral', icon: SlidersHorizontal },
  { slug: 'perfil', name: 'Meu perfil', icon: UserRound },
  { slug: 'preferencias', name: 'Preferências', icon: Globe },
  { slug: 'seguranca', name: 'Segurança', icon: ShieldCheck },
  { slug: 'sessoes', name: 'Sessões', icon: ShieldCheck },
  { slug: '2fa', name: 'Autenticação em duas etapas', icon: ShieldCheck },
];
export function SettingsPage({ section: requested = 'geral' }: { section?: string }) {
  const base = useRouteBase();
  const { scope } = useErp();
  const companyAllowed = !scope || canAccessCompanySettings(scope.role);
  const visibleSettings = settings.filter((item) => item.slug !== 'geral' || companyAllowed);
  const section = requested === 'geral' && !companyAllowed ? 'perfil' : requested;
  const { dark, ready, toggle } = useAppTheme();
  const [compact, setCompact] = useState(false);
  // O tema só é conhecido no navegador; o trecho suspenso hidrata depois do ThemeProvider.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const selected = visibleSettings.find((item) => item.slug === section);
  if (!selected)
    return (
      <PageHeading
        title="Configuração não encontrada"
        description="Escolha uma seção das configurações."
      />
    );
  return (
    <>
      <PageHeading title="Configurações" description="Cada detalhe a favor da sua operação." />
      <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
        <nav
          aria-label="Seções das configurações"
          className="flex flex-col gap-1 self-start rounded-xl border border-border bg-card p-3"
        >
          {visibleSettings.map((t) => (
            <Link
              key={t.slug}
              href={`${base}/configuracoes/${t.slug}`}
              aria-current={section === t.slug ? 'page' : undefined}
              className={cn('nav-item', section === t.slug && 'active')}
            >
              <t.icon />
              {t.name}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">
          {section === 'geral' ? (
            <TenantAdministration embedded />
          ) : section === 'preferencias' ? (
            <section className="panel">
              <PanelHeading
                title="Preferências"
                description="Preferências visuais deste navegador; sem alterações no cadastro do ERP."
              />
              <div className="px-6 pb-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="language">Idioma da interface</FieldLabel>
                    <select id="language" className="native-select">
                      <option>Português (Brasil)</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="date-format">Formato de data</FieldLabel>
                    <select id="date-format" className="native-select" disabled>
                      <option>DD/MM/AAAA</option>
                    </select>
                  </Field>
                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="compact-view">
                      Preferir tabelas compactas nesta sessão
                    </FieldLabel>
                    <Switch
                      id="compact-view"
                      checked={compact}
                      onCheckedChange={(value) => {
                        setCompact(value);
                        document.documentElement.classList.toggle('compact-tables', value);
                      }}
                    />
                  </Field>
                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="dark-mode">Modo escuro</FieldLabel>
                    <Switch
                      id="dark-mode"
                      checked={mounted && dark}
                      disabled={!mounted || !ready}
                      onCheckedChange={toggle}
                    />
                  </Field>
                  <p className="text-xs leading-6 text-muted-foreground">
                    Tema e densidade são preferências da interface. O backend original não oferece
                    contrato de preferências pessoais, idioma ou formato de data.
                  </p>
                </FieldGroup>
              </div>
            </section>
          ) : (
            <SecurityWorkspace
              key={section}
              embedded
              initialTab={
                section === 'perfil'
                  ? 'profile'
                  : section === '2fa' || section === 'seguranca'
                    ? '2fa'
                    : 'sessions'
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
export function NotificationsConfigPage({ section = 'regras' }: { section?: string }) {
  const [tab, setTab] = useState(section);
  const base = useRouteBase();
  const query = useErpQuery<unknown>('/notifications/config');
  const rows = listRecords(query.data);
  const action = useErpAction();
  const { scope } = useErp();
  const allowed = !scope || ['super_admin', 'gerente'].includes(scope.role);
  const channels = [
    {
      code: 'EMAIL',
      name: 'E-mail',
      icon: Mail,
      text: 'Envio de notificações e resumos operacionais.',
    },
    {
      code: 'WEBHOOK',
      name: 'Webhook',
      icon: Bell,
      text: 'Destinos de eventos configurados no ERP.',
    },
    {
      code: 'WHATSAPP',
      name: 'WhatsApp',
      icon: MessageSquare,
      text: 'Alertas prioritários para a equipe de plantão.',
    },
    {
      code: 'SLACK',
      name: 'Slack',
      icon: MessageSquare,
      text: 'Alertas para o workspace configurado.',
    },
  ];
  return (
    <>
      <PageHeading
        title="Notificações e alertas"
        description="O que importa, no momento certo e no canal certo."
      >
        <RecordDialog title="Nova regra de alerta" moduleKey="notificationRules" fields={[]} />
      </PageHeading>
      <div className="mb-6 flex gap-3">
        {[
          ['regras', 'Regras de alerta'],
          ['canais', 'Canais de envio'],
        ].map(([slug, name]) => (
          <Link key={slug} href={`${base}/notificacoes/${slug}`} onClick={() => setTab(slug)}>
            <Button variant={tab === slug ? 'secondary' : 'outline'}>{name}</Button>
          </Link>
        ))}
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      {tab === 'regras' ? (
        <section className="panel">
          <PanelHeading
            title="Eventos da operação"
            description="Cada regra possui canal, gatilho e destino próprios."
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Canal</th>
                  <th>Destino</th>
                  <th>Ativa</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong className="block font-medium">{String(row.name)}</strong>
                      <span className="mt-2 block text-[10px] text-muted-foreground">
                        {String(row.trigger)}
                      </span>
                    </td>
                    <td>
                      {channels.find((c) => c.code === row.channel)?.name || String(row.channel)}
                    </td>
                    <td>{String(row.target)}</td>
                    <td>
                      <Switch
                        checked={Boolean(row.active)}
                        aria-label={`Ativar ${row.name}`}
                        disabled={!action.connected || !allowed || action.pending}
                        onCheckedChange={async (active) => {
                          try {
                            await action.execute({
                              path: `/notifications/config/${encodeURIComponent(row.id)}`,
                              method: 'PATCH',
                              body: { active },
                            });
                            await query.mutate();
                            toast.success('Regra atualizada no ERP');
                          } catch (error) {
                            toast.error(errorMessage(error));
                          }
                        }}
                      />
                    </td>
                    <td>
                      <RecordDialog
                        title="Editar regra"
                        moduleKey="notificationRules"
                        recordId={row.id}
                        fields={[]}
                      />
                      <OperationControl
                        title="Remover"
                        description="Remover esta regra de notificação?"
                        path={`/notifications/config/${encodeURIComponent(row.id)}`}
                        method="DELETE"
                        roles={['super_admin', 'gerente']}
                        after={async () => {
                          await query.mutate();
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && !query.isLoading && <ErpEmpty connected={query.connected} />}
        </section>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {channels.map((c) => (
            <section key={c.code} className="panel p-6">
              <c.icon className="mb-5 size-6 text-primary" />
              <h2 className="section-title">{c.name}</h2>
              <p className="my-4 text-xs leading-6 text-muted-foreground">{c.text}</p>
              <StatusBadge
                status={
                  rows.some((r) => r.channel === c.code && r.active) ? 'Ativo' : 'Não configurado'
                }
              />
            </section>
          ))}
          <section className="panel p-6">
            <h2 className="section-title">No aplicativo</h2>
            <p className="my-4 text-xs leading-6 text-muted-foreground">
              A caixa de entrada por usuário aguarda contrato no ERP.
            </p>
            <StatusBadge status="Indisponível" />
          </section>
        </div>
      )}
      <section className="panel mt-5 p-6">
        <h2 className="section-title mb-4">Notificação de ordem por WhatsApp</h2>
        <OperationControl
          title="Preparar envio de ordem"
          description="Confira o destinatário antes de solicitar o envio ao provedor do ERP."
          path="/notifications/whatsapp/dispatch-order"
          roles={['super_admin', 'gerente', 'analista', 'tecnico']}
          fields={[
            { name: 'orderId', label: 'Ordem', type: 'uuid', required: true },
            { name: 'target', label: 'Destino opcional' },
            { name: 'customMessage', label: 'Mensagem personalizada', type: 'textarea' },
          ]}
        />
      </section>
    </>
  );
}
