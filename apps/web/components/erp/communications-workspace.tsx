'use client';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ResourcePage } from './resource-page';
import { OperationControl } from './operation-controls';
import { SecretReveal } from './secret-reveal';
import { IntegrationWorkspace } from './integration-workspace';
import { PageHeading } from './primitives';
import type { RoleCode } from '@/lib/erp/contracts';
const managers: RoleCode[] = ['super_admin', 'gerente'];
export function CommunicationsWorkspace({ kind }: { kind: 'notifications' | 'integrations' }) {
  const [createdKey, setCreatedKey] = useState<{ id: string; name: string; key: string } | null>(
    null,
  );
  if (kind === 'notifications')
    return (
      <>
        <ResourcePage moduleKey="notificationRules" />
        <section className="panel mt-5 p-6">
          <h2 className="section-title mb-3">Notificação de ordem por WhatsApp</h2>
          <p className="mb-5 text-xs leading-6 text-muted-foreground">
            O envio usa o provedor configurado no ERP. A confirmação da requisição não certifica a
            entrega ao destinatário.
          </p>
          <OperationControl
            title="Preparar envio de ordem"
            description="Confira o destinatário e o conteúdo antes de solicitar o envio real."
            path="/notifications/whatsapp/dispatch-order"
            roles={[...managers, 'analista']}
            fields={[
              { name: 'orderId', label: 'UUID da ordem', type: 'uuid', required: true },
              { name: 'target', label: 'Destino opcional' },
              { name: 'customMessage', label: 'Mensagem personalizada', type: 'textarea' },
            ]}
          />
        </section>
      </>
    );
  return (
    <>
      <PageHeading
        title="Integrações e API"
        description="Credenciais por empresa, IXC e contratos de entrada do backend original."
      />
      <Tabs defaultValue="keys" className="gap-5">
        <div className="overflow-x-auto">
          <TabsList variant="line">
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="ixc">IXC</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="keys">
          <ResourcePage
            moduleKey="apiKeys"
            onCreated={(row) => {
              if (typeof row.key === 'string')
                setCreatedKey({ id: row.id, name: String(row.name), key: row.key });
            }}
            rowActions={(row, refresh) =>
              row.active ? (
                <OperationControl
                  title="Revogar"
                  description="O acesso desta chave deixará de funcionar. Esta operação exige confirmação do servidor."
                  path={`/api-keys/${encodeURIComponent(row.id)}/revoke`}
                  method="PATCH"
                  roles={managers}
                  after={refresh}
                />
              ) : null
            }
          />
          {createdKey && (
            <SecretReveal
              key={createdKey.id}
              recordId={createdKey.id}
              title={createdKey.name}
              field="key"
              initialValue={createdKey.key}
              onDismiss={() => setCreatedKey(null)}
            />
          )}
        </TabsContent>
        <TabsContent value="ixc">
          <IntegrationWorkspace />
        </TabsContent>
        <TabsContent value="webhooks">
          <section className="panel p-6">
            <h2 className="section-title mb-4">Entrada de solicitações via chat</h2>
            <p className="mb-4 text-xs leading-6 text-muted-foreground">
              POST /webhooks/chat/incoming · Authorization: Bearer (chave da empresa). O tenant é
              derivado da chave; não aceite que o navegador escolha outra empresa.
            </p>
            <dl className="grid gap-5 text-xs sm:grid-cols-2">
              {[
                ['title', 'Título · 1 a 200 caracteres'],
                ['description', 'Descrição · 1 a 20.000 caracteres'],
                ['requester', 'Solicitante · 1 a 200 caracteres'],
                ['priority / type', 'Enums de prioridade e tipo de serviço'],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt className="mb-2 font-mono text-muted-foreground">{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <Alert className="mt-6">
              <AlertTitle>Sem endpoint de assinatura ou histórico de entregas</AlertTitle>
              <AlertDescription>
                O ZIP possui entrada de chat e webhook IXC, não um CRUD genérico de assinaturas.
                Gestão de destinos de saída está em Notificações. Retentativas e logs de entrega
                exigem contrato adicional; nenhum endpoint foi inventado.
              </AlertDescription>
            </Alert>
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}
