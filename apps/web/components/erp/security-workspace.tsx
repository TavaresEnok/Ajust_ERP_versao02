'use client';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useErp, useErpQuery, useErpAction } from '@/lib/erp/gateway';
import { type SecuritySession } from '@/lib/erp/contracts';
import { parseFields } from '@/lib/erp/fields';
import {
  ConnectionNotice,
  ContractFields,
  ContractForm,
  ErpEmpty,
  QueryState,
} from './contract-form';
import { PageHeading, PanelHeading } from './primitives';
import { OperationControl } from './operation-controls';
import { displayValue } from './resource-page';
import { TwoFactorSettings } from './two-factor-settings';
export function SecurityWorkspace({
  embedded = false,
  initialTab = 'sessions',
  initialUserId = '',
}: {
  embedded?: boolean;
  initialTab?: string;
  initialUserId?: string;
}) {
  const { scope } = useErp();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [userId, setUserId] = useState(initialUserId);
  const [error, setError] = useState('');
  const manager = !scope || ['super_admin', 'gerente'].includes(scope.role);
  const sessions = useErpQuery<SecuritySession[]>(
    userId
      ? manager
        ? `/auth/sessions/user/${encodeURIComponent(userId)}`
        : null
      : '/auth/sessions',
  );
  const me = useErpQuery<{
    user?: { name?: string; email?: string };
    name?: string;
    email?: string;
  }>('/auth/me');
  const action = useErpAction();
  async function endSession() {
    await mutate(() => true, undefined, { revalidate: false });
    router.replace('/login');
    router.refresh();
  }
  return (
    <>
      {!embedded && (
        <>
          <PageHeading
            title="Sessões e segurança"
            description="Gerencie acessos, identidade e verificação em duas etapas no ERP."
          />
          {!sessions.connected && <ConnectionNotice />}
        </>
      )}
      <Tabs defaultValue={initialTab} className="gap-5">
        <div className={embedded ? 'hidden' : 'overflow-x-auto'}>
          <TabsList variant="line">
            <TabsTrigger value="sessions">Sessões</TabsTrigger>
            <TabsTrigger value="profile">Perfil e senha</TabsTrigger>
            <TabsTrigger value="2fa">Autenticação em duas etapas</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="sessions">
          <section className="panel">
            <PanelHeading
              title={userId ? 'Sessões do colaborador' : 'Minhas sessões'}
              description="Dispositivos ativos e revogação individual."
            />
            {manager && (
              <form
                className="flex flex-col gap-4 px-6 pb-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError('');
                  try {
                    const values = parseFields(
                      [
                        {
                          name: 'userId',
                          label: 'UUID do colaborador',
                          type: 'uuid',
                          required: true,
                        },
                      ],
                      new FormData(event.currentTarget),
                    );
                    setUserId(String(values.userId));
                  } catch (error) {
                    setError((error as Error).message);
                  }
                }}
              >
                <ContractFields
                  fields={[{ name: 'userId', label: 'Selecionar colaborador', type: 'uuid' }]}
                />
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" variant="outline">
                    Consultar sessões
                  </Button>
                  <Button variant="ghost" type="reset" onClick={() => setUserId('')}>
                    Minhas sessões
                  </Button>
                </div>
                {error && (
                  <p role="alert" className="text-xs text-danger">
                    {error}
                  </p>
                )}
              </form>
            )}
            <QueryState
              loading={sessions.isLoading}
              error={sessions.error}
              onRetry={() => void sessions.mutate()}
            />
            {!sessions.error &&
              !sessions.isLoading &&
              (sessions.data?.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Dispositivo</th>
                        <th>IP</th>
                        <th>Início</th>
                        <th>Expira</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.data.map((row) => (
                        <tr key={row.id}>
                          <td>
                            {displayValue(row.device || row.userAgent)}
                            {row.isCurrent ? ' · atual' : ''}
                          </td>
                          <td>{displayValue(row.ip)}</td>
                          <td>{displayValue(row.createdAt)}</td>
                          <td>{displayValue(row.expiresAt)}</td>
                          <td>
                            <OperationControl
                              title="Revogar sessão"
                              description={
                                row.isCurrent
                                  ? 'Você será desconectado deste dispositivo.'
                                  : 'O dispositivo perderá acesso ao ERP.'
                              }
                              path={`/auth/sessions/${encodeURIComponent(row.id)}`}
                              method="DELETE"
                              after={async () => {
                                if (row.isCurrent) await endSession();
                                else await sessions.mutate();
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ErpEmpty connected={sessions.connected} />
              ))}
            <div className="flex flex-wrap gap-3 border-t border-border p-6">
              <OperationControl
                title="Encerrar todas as minhas sessões"
                description="Todos os seus dispositivos serão desconectados. O BFF deve também limpar os cookies de autenticação."
                path="/auth/logout-all"
                after={endSession}
              />
              {userId && (
                <OperationControl
                  title="Revogar todas do colaborador"
                  description="Operação restrita ao super administrador e registrada pelo ERP."
                  path={`/auth/admin/revoke-sessions/${encodeURIComponent(userId)}`}
                  roles={['super_admin']}
                  after={() => sessions.mutate()}
                />
              )}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="profile">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Dados do perfil</h2>
            <QueryState loading={me.isLoading} error={me.error} />
            <ContractForm
              key={JSON.stringify(me.data)}
              values={me.data?.user || me.data}
              fields={[
                { name: 'name', label: 'Nome', min: 2 },
                { name: 'email', label: 'E-mail', type: 'email' },
              ]}
              connected={action.connected}
              pending={action.pending}
              onSubmit={async (values) => {
                if (!Object.keys(values).length) throw new Error('Preencha ao menos um campo.');
                await action.execute({ path: '/auth/me', method: 'PATCH', body: values });
                await me.mutate();
              }}
            />
            <h2 className="section-title mt-8 mb-5">Alterar senha</h2>
            <ContractForm
              fields={[
                {
                  name: 'currentPassword',
                  label: 'Senha atual',
                  type: 'password',
                  required: true,
                  min: 1,
                },
                {
                  name: 'newPassword',
                  label: 'Nova senha',
                  type: 'password',
                  required: true,
                  min: 8,
                },
              ]}
              connected={action.connected}
              pending={action.pending}
              onSubmit={async (values) => {
                await action.execute({ path: '/auth/me', method: 'PATCH', body: values });
                await endSession();
              }}
            />
          </section>
        </TabsContent>
        <TabsContent value="2fa">
          <TwoFactorSettings />
        </TabsContent>
      </Tabs>
    </>
  );
}
