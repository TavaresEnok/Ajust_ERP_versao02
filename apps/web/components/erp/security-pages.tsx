'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Monitor, ShieldCheck, Network, Webhook, BookOpen } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useErpQuery } from '@/lib/erp/gateway';
import { listRecords, useRouteBase } from '@/lib/erp/visual-data';
import type { ErpRecord } from '@/lib/erp/contracts';
import { PageHeading, PanelHeading, StatusBadge } from './primitives';
import { RecordDialog } from './record-dialog';
import { SecurityWorkspace } from './security-workspace';
import { IntegrationWorkspace } from './integration-workspace';
import { OperationControl } from './operation-controls';
import { SecretReveal } from './secret-reveal';
import { QueryState, ErpEmpty } from './contract-form';

export function SecurityPage({ section = 'sessoes' }: { section?: string }) {
  const base = useRouteBase();
  return (
    <>
      <PageHeading
        title="Sessões e segurança"
        description="Visibilidade e controle sobre os acessos da sua operação."
      />
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-primary/15 bg-secondary/50 p-6">
        <ShieldCheck className="size-8 shrink-0 text-primary" />
        <div>
          <h2 className="section-title">Seu ambiente, sob controle.</h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Consulte dispositivos, gerencie seu perfil e proteja os acessos com verificação em duas
            etapas.
          </p>
        </div>
      </div>
      <nav aria-label="Seções de segurança" className="mb-6 flex flex-wrap gap-3">
        {[
          ['sessoes', 'Sessões'],
          ['perfil', 'Perfil e senha'],
          ['2fa', 'Autenticação em duas etapas'],
        ].map(([slug, name]) => (
          <Link
            key={slug}
            href={`${base}/seguranca/${slug}`}
            aria-current={section === slug ? 'page' : undefined}
            className={buttonVariants({ variant: section === slug ? 'secondary' : 'outline' })}
          >
            {name}
          </Link>
        ))}
      </nav>
      <SecurityWorkspace
        key={section}
        embedded
        initialTab={section === 'perfil' ? 'profile' : section === '2fa' ? '2fa' : 'sessions'}
      />
      <section className="panel mt-5 p-6">
        <h2 className="section-title">Eventos de segurança</h2>
        <p className="my-4 text-xs leading-6 text-muted-foreground">
          A auditoria preserva autor, data e recurso das operações autorizadas.
        </p>
        <Link className="text-link" href={`${base}/auditoria`}>
          Consultar auditoria operacional
        </Link>
      </section>
    </>
  );
}
export function IntegrationsPage({ section = 'integracoes' }: { section?: string }) {
  const base = useRouteBase();
  const query = useErpQuery<unknown>(
    section === 'chaves' || section === 'api-keys' ? '/api-keys' : null,
  );
  const keys = listRecords(query.data);
  const [docs, setDocs] = useState(false);
  const [createdKey, setCreatedKey] = useState<ErpRecord | null>(null);
  const tab = section === 'api-keys' ? 'chaves' : section;
  return (
    <>
      <PageHeading
        title="Integrações e API"
        description="Conecte suas ferramentas. Amplie as possibilidades."
      >
        <Button variant="outline" onClick={() => setDocs(true)}>
          <BookOpen data-icon="inline-start" />
          Referência da API
        </Button>
        {tab === 'chaves' && (
          <RecordDialog
            title="Nova chave de API"
            moduleKey="apiKeys"
            fields={[]}
            onCreated={(record) => {
              if (typeof record.key === 'string') setCreatedKey(record);
            }}
          />
        )}
      </PageHeading>
      <nav aria-label="Seções de integrações" className="mb-6 flex flex-wrap gap-3">
        {[
          ['integracoes', 'Integrações'],
          ['chaves', 'Chaves de API'],
          ['webhooks', 'Webhooks'],
          ['ixc', 'IXC'],
        ].map(([slug, name]) => (
          <Link
            key={slug}
            href={`${base}/integracoes/${slug}`}
            aria-current={tab === slug ? 'page' : undefined}
            className={buttonVariants({ variant: tab === slug ? 'secondary' : 'outline' })}
          >
            {name}
          </Link>
        ))}
      </nav>
      {tab === 'integracoes' ? (
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              name: 'API REST',
              icon: Network,
              text: 'Conecte o Ajust ERP aos sistemas da sua operação.',
              href: `${base}/integracoes/chaves`,
            },
            {
              name: 'Notificações',
              icon: Webhook,
              text: 'Eventos para manter suas ferramentas sincronizadas.',
              href: `${base}/notificacoes`,
            },
            {
              name: 'Monitoramento',
              icon: Monitor,
              text: 'Visibilidade sobre a infraestrutura e equipamentos.',
              href: `${base}/saude`,
            },
            {
              name: 'IXC',
              icon: Network,
              text: 'Configuração do conector e reconciliação por empresa.',
              href: `${base}/integracoes/ixc`,
            },
          ].map((item) => (
            <article key={item.name} className="panel p-6">
              <item.icon className="mb-5 size-7 text-primary" />
              <h2 className="section-title">{item.name}</h2>
              <p className="my-4 min-h-12 text-xs leading-6 text-muted-foreground">{item.text}</p>
              <Link href={item.href} className={buttonVariants({ variant: 'outline' })}>
                Configurar integração
              </Link>
            </article>
          ))}
        </div>
      ) : tab === 'chaves' ? (
        <section className="panel">
          <PanelHeading
            title="Chaves de API"
            description="Metadados por empresa. O segredo é exibido apenas uma vez após a criação."
          />
          <QueryState
            loading={query.isLoading}
            error={query.error}
            onRetry={() => void query.mutate()}
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Identificador</th>
                  <th>Criação</th>
                  <th>Expiração</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td>{String(key.name)}</td>
                    <td className="font-mono text-muted-foreground">{key.id}</td>
                    <td>
                      {key.createdAt
                        ? new Date(String(key.createdAt)).toLocaleString('pt-BR')
                        : '—'}
                    </td>
                    <td>
                      {key.expiresAt
                        ? new Date(String(key.expiresAt)).toLocaleString('pt-BR')
                        : 'Sem expiração'}
                    </td>
                    <td>
                      <StatusBadge status={key.active ? 'Ativa' : 'Revogada'} />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {key.active === true && (
                          <OperationControl
                            title="Revogar"
                            description="Esta chave perderá acesso à API do ERP."
                            path={`/api-keys/${encodeURIComponent(key.id)}/revoke`}
                            method="PATCH"
                            roles={['super_admin', 'gerente']}
                            after={async () => {
                              await query.mutate();
                            }}
                          />
                        )}
                        <OperationControl
                          title="Remover"
                          description="Remover definitivamente esta chave?"
                          path={`/api-keys/${encodeURIComponent(key.id)}`}
                          method="DELETE"
                          roles={['super_admin', 'gerente']}
                          after={async () => {
                            await query.mutate();
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!keys.length && !query.isLoading && !query.error && (
            <ErpEmpty connected={query.connected} />
          )}
        </section>
      ) : tab === 'ixc' ? (
        <IntegrationWorkspace embedded />
      ) : (
        <section className="panel max-w-3xl p-6">
          <h2 className="section-title">Eventos e webhooks</h2>
          <p className="my-5 text-xs leading-6 text-muted-foreground">
            Eventos de saída são configurados pelas regras de notificação com canal Webhook, gatilho
            e destino HTTPS.
          </p>
          <Link className="text-link" href={`${base}/notificacoes/regras`}>
            Configurar eventos de saída
          </Link>
          <h3 className="section-title mt-7">Entrada de solicitações via chat</h3>
          <p className="my-4 break-words font-mono text-xs">POST /webhooks/chat/incoming</p>
          <p className="text-xs leading-6 text-muted-foreground">
            Authorization: Bearer com chave da empresa. O tenant é derivado da chave no servidor; o
            corpo recebe title, description, requester, priority e type. O contrato original não
            expõe gerenciamento de assinaturas genéricas nem histórico de entregas.
          </p>
        </section>
      )}
      {createdKey && (
        <SecretReveal
          key={createdKey.id}
          recordId={createdKey.id}
          title={String(createdKey.name)}
          field="key"
          initialValue={String(createdKey.key)}
          onDismiss={() => setCreatedKey(null)}
        />
      )}
      <Dialog open={docs} onOpenChange={setDocs}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>API do Ajust ERP</DialogTitle>
            <DialogDescription>Contratos identificados no backend original.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 rounded-lg bg-muted p-5 font-mono text-[11px]">
            {[
              'GET /service-orders',
              'GET /iam/tenants',
              'GET /cmdb/assets',
              'GET /knowledge/articles',
              'GET /calendar/events',
              'POST /api-keys',
              'POST /webhooks/chat/incoming',
            ].map((route) => (
              <p key={route}>{route}</p>
            ))}
          </div>
          <p className="text-xs leading-6 text-muted-foreground">
            O gateway utiliza um BFF da mesma origem. Autenticação, autorização e segredos
            permanecem sob responsabilidade do backend existente.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
