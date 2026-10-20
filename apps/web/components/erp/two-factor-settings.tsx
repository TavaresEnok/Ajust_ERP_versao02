'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useErpQuery, useErpAction } from '@/lib/erp/gateway';
import { errorMessage } from '@/lib/erp/contracts';
import { ContractForm, QueryState } from './contract-form';
export function TwoFactorSettings() {
  const status = useErpQuery<{ enabled: boolean }>('/auth/2fa/status');
  const action = useErpAction();
  const [setup, setSetup] = useState<{ secret: string; provisioning_url: string } | null>(null);
  useEffect(() => {
    if (!setup) return;
    const timer = setTimeout(() => setSetup(null), 300000);
    const hide = () => {
      if (document.hidden) setSetup(null);
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [setup]);
  return (
    <section className="panel p-6">
      <h2 className="section-title mb-4">Aplicativo autenticador · TOTP</h2>
      <QueryState
        loading={status.isLoading}
        error={status.error}
        onRetry={() => void status.mutate()}
      />
      <p className="mb-5 text-xs text-muted-foreground">
        {!status.data
          ? 'Situação ainda não consultada no ERP.'
          : status.data.enabled
            ? 'Autenticação em duas etapas ativada.'
            : 'Autenticação em duas etapas desativada.'}
      </p>
      {!status.data?.enabled && (
        <>
          <Alert className="mb-5">
            <AlertTitle>Configuração em duas etapas</AlertTitle>
            <AlertDescription>
              Primeiro solicite uma chave ao servidor. Cadastre-a no aplicativo autenticador e
              confirme o código. Não são gerados segredos fictícios nem QR codes externos.
            </AlertDescription>
          </Alert>
          {!setup ? (
            <Button
              disabled={!action.connected || action.pending || !status.data}
              onClick={async () => {
                try {
                  const result = await action.execute<{ secret: string; provisioning_url: string }>(
                    { path: '/auth/2fa/setup', method: 'POST' },
                  );
                  if (
                    typeof result.secret !== 'string' ||
                    !result.provisioning_url?.startsWith('otpauth://')
                  )
                    throw new Error('Configuração retornada pelo ERP é inválida.');
                  setSetup(result);
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            >
              Iniciar configuração no ERP
            </Button>
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-xs text-muted-foreground">
                Chave manual · apagada ao sair da aba ou após cinco minutos.
              </p>
              <output className="select-all break-all rounded-lg border border-border bg-muted p-4 font-mono text-sm">
                {setup.secret}
              </output>
              <ContractForm
                fields={[
                  {
                    name: 'code',
                    label: 'Código do autenticador',
                    required: true,
                    pattern: '^[0-9]{6}$',
                    min: 6,
                    max: 6,
                  },
                ]}
                connected={action.connected}
                pending={action.pending}
                label="Confirmar e ativar 2FA"
                onSubmit={async (values) => {
                  await action.execute({
                    path: '/auth/2fa/confirm',
                    method: 'POST',
                    body: { secret: setup.secret, ...values },
                  });
                  setSetup(null);
                  await status.mutate();
                  toast.success('Ativação confirmada pelo ERP');
                }}
              />
              <Button variant="ghost" onClick={() => setSetup(null)}>
                Descartar configuração
              </Button>
            </div>
          )}
        </>
      )}
      {(status.data?.enabled || !action.connected) && (
        <div className="mt-6">
          <h3 className="section-title mb-4">Desativar duas etapas</h3>
          <ContractForm
            fields={[
              {
                name: 'password',
                label: 'Confirme sua senha',
                type: 'password',
                required: true,
                min: 1,
                max: 256,
              },
            ]}
            connected={action.connected && Boolean(status.data?.enabled)}
            pending={action.pending}
            onSubmit={async (values) => {
              await action.execute({ path: '/auth/2fa/disable', method: 'POST', body: values });
              await status.mutate();
              toast.success('Desativação confirmada pelo ERP');
            }}
            label="Desativar 2FA no ERP"
          />
        </div>
      )}
    </section>
  );
}
