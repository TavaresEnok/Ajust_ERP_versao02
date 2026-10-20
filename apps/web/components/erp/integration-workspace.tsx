'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useErp, useErpAction } from '@/lib/erp/gateway';
import { errorMessage } from '@/lib/erp/contracts';
import { ContractForm, ConnectionNotice } from './contract-form';
import { PageHeading } from './primitives';
export function IntegrationWorkspace({ embedded = false }: { embedded?: boolean }) {
  const { scope } = useErp();
  const action = useErpAction();
  const [confirm, setConfirm] = useState(false);
  const [reconciled, setReconciled] = useState(false);
  const manager = !scope || ['super_admin', 'gerente'].includes(scope.role);
  return (
    <>
      {!embedded && (
        <PageHeading
          title="Integração IXC e reconciliação"
          description="Configuração do conector existente no backend, sem reconstruir a integração."
        />
      )}
      {!action.connected && <ConnectionNotice />}
      <Tabs defaultValue="IXC" className="gap-5">
        <TabsList variant="line">
          <TabsTrigger value="IXC">IXC</TabsTrigger>
          <TabsTrigger value="Reconciliação">Reconciliação</TabsTrigger>
          <TabsTrigger value="Webhooks">Webhooks</TabsTrigger>
        </TabsList>
        <TabsContent value="IXC">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Configuração por empresa</h2>
            <ContractForm
              fields={[
                { name: 'baseUrl', label: 'URL base do IXC', type: 'url', required: true },
                {
                  name: 'status',
                  label: 'Situação',
                  options: { ACTIVE: 'Ativa', INACTIVE: 'Inativa' },
                  defaultValue: 'INACTIVE',
                },
                {
                  name: 'apiToken',
                  label: 'Token da API IXC',
                  type: 'password',
                  min: 8,
                  hint: 'Opcional; em branco mantém a configuração do servidor.',
                },
                { name: 'webhookSecret', label: 'Segredo do webhook', type: 'password', min: 8 },
              ]}
              connected={action.connected && manager}
              pending={action.pending}
              onSubmit={async (values) => {
                await action.execute({
                  path: '/integrations/ixc/configure',
                  method: 'POST',
                  body: values,
                });
                toast.success('Configuração confirmada pelo ERP');
              }}
            />
            <Alert className="mt-5">
              <AlertTitle>Credenciais e configuração sensível</AlertTitle>
              <AlertDescription>
                apiToken e webhookSecret são opcionais e nunca são carregados de volta em campos ou
                listagens. Em prévia, não use segredos reais. O BFF deve encaminhá-los com
                autorização e sem logs, e filtrar a resposta do conector.
              </AlertDescription>
            </Alert>
          </section>
        </TabsContent>
        <TabsContent value="Reconciliação">
          <section className="panel p-6">
            <h2 className="section-title mb-3">Reconciliar dados com o IXC</h2>
            <p className="mb-5 text-xs leading-6 text-muted-foreground">
              Executa a reconciliação manual do tenant da sessão. Pode criar ou atualizar registros
              conforme as regras do backend. Nenhuma solicitação será enviada até a confirmação.
            </p>
            <Button
              disabled={!action.connected || !manager || action.pending}
              onClick={() => setConfirm(true)}
            >
              Revisar reconciliação
            </Button>
            {reconciled && (
              <p role="status" className="mt-5 text-xs text-primary">
                O servidor respondeu à solicitação de reconciliação. Consulte os eventos de
                sincronização para validar o resultado.
              </p>
            )}
          </section>
        </TabsContent>
        <TabsContent value="Webhooks">
          <Alert>
            <AlertTitle>Entrega e verificação no backend original</AlertTitle>
            <AlertDescription>
              /integrations/ixc/webhook valida x-ixc-signature e possui limitação de requisições.
              Não envie eventos de teste contendo tenantId pelo navegador. O controller IXC deste
              ZIP não expõe listagem de conflitos/eventos; a tela de resolução de conflitos depende
              desse contrato.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reconciliação IXC</DialogTitle>
            <DialogDescription>
              Esta operação atua sobre a empresa autenticada e pode alterar dados operacionais.
              Confirme para solicitar ao backend.
            </DialogDescription>
          </DialogHeader>
          <Button
            disabled={!action.connected || action.pending}
            onClick={async () => {
              try {
                await action.execute({ path: '/integrations/ixc/reconcile', method: 'POST' });
                setConfirm(false);
                setReconciled(true);
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          >
            Confirmar no ERP
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
