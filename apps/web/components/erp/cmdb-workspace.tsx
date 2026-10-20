'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { queryPath, type ErpRecord } from '@/lib/erp/contracts';
import { ContractForm, ConnectionNotice, ErpEmpty, QueryState } from './contract-form';
import { PageHeading, PanelHeading } from './primitives';
import { displayValue, ResourcePage } from './resource-page';
type Diff = {
  fromVersion: number;
  toVersion: number;
  addedLinesCount: number;
  removedLinesCount: number;
  diffLines: { type: 'added' | 'removed' | 'unchanged'; text: string }[];
};
export function CmdbWorkspace({
  initialAssetId = '',
  initialTab = 'Inventário',
  embedded = false,
}: {
  initialAssetId?: string;
  initialTab?: string;
  embedded?: boolean;
}) {
  const { scope } = useErp();
  const action = useErpAction();
  const assets = useErpQuery<ErpRecord[]>('/cmdb/assets');
  const [assetId, setAssetId] = useState(initialAssetId);
  const [diff, setDiff] = useState<Diff | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const snapshots = useErpQuery<ErpRecord[]>(assetId ? `/cmdb/assets/${assetId}/snapshots` : null);
  const manager = !scope || ['super_admin', 'gerente', 'analista'].includes(scope.role);
  const assetOptions = Object.fromEntries(
    (assets.data || []).map((asset) => [asset.id, String(asset.name)]),
  );
  const snapshotOptions = Object.fromEntries(
    (snapshots.data || []).map((snapshot) => [
      snapshot.id,
      `Versão ${snapshot.version} · ${displayValue(snapshot.createdAt)}`,
    ]),
  );
  return (
    <>
      {!embedded && (
        <>
          <PageHeading
            title="Configurações e snapshots do ERP"
            description="Histórico versionado, vínculo de ordens e comparação real de configurações."
          />
          {!assets.connected && <ConnectionNotice />}
          <section className="panel mb-5 p-5">
            <label htmlFor="cmdb-asset" className="mb-2 block text-xs font-medium">
              Ativo do inventário original
            </label>
            <select
              id="cmdb-asset"
              className="native-select w-full"
              value={assetId}
              disabled={!assets.connected}
              onChange={(e) => {
                setAssetId(e.target.value);
                setDiff(null);
                setContent(null);
              }}
            >
              <option value="">Selecione um ativo</option>
              {Object.entries(assetOptions).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            <QueryState
              loading={assets.isLoading}
              error={assets.error}
              onRetry={() => void assets.mutate()}
            />
          </section>
        </>
      )}
      <Tabs defaultValue={initialTab} className="gap-5">
        <div className={embedded ? 'hidden' : 'overflow-x-auto'}>
          <TabsList variant="line">
            {['Inventário', 'Snapshots', 'Novo snapshot', 'Comparação', 'Vincular ordem'].map(
              (tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {tab}
                </TabsTrigger>
              ),
            )}
          </TabsList>
        </div>
        <TabsContent value="Inventário">
          <ResourcePage moduleKey="assets" />
        </TabsContent>
        <TabsContent value="Snapshots">
          <section className="panel">
            <PanelHeading
              title="Versões de configuração"
              description="Conteúdo carregado apenas quando solicitado, sem configurações fictícias."
            />
            <QueryState
              loading={snapshots.isLoading}
              error={snapshots.error}
              onRetry={() => void snapshots.mutate()}
            />
            {snapshots.data?.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Versão</th>
                      <th>Checksum</th>
                      <th>Data</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.data.map((snapshot) => (
                      <tr key={snapshot.id}>
                        <td>{displayValue(snapshot.version)}</td>
                        <td className="max-w-40 truncate">{displayValue(snapshot.checksum)}</td>
                        <td>{displayValue(snapshot.createdAt)}</td>
                        <td>{displayValue(snapshot.notes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !snapshots.isLoading &&
              !snapshots.error && <ErpEmpty connected={snapshots.connected} />
            )}
          </section>
          <section className="panel mt-5 p-5">
            <ContractForm
              fields={[
                {
                  name: 'snapshotId',
                  label: 'Snapshot a consultar',
                  options: snapshotOptions,
                  required: true,
                },
              ]}
              connected={action.connected && !!assetId}
              pending={action.pending}
              label="Carregar conteúdo"
              onSubmit={async (values) => {
                const snapshot = await action.execute<{ content: string }>({
                  path: `/cmdb/assets/${assetId}/snapshots/${values.snapshotId}`,
                });
                setContent(snapshot.content);
              }}
            />
            {content !== null && (
              <pre className="mt-5 max-h-96 overflow-auto rounded-lg bg-muted p-4 text-[10px]">
                {content}
              </pre>
            )}
          </section>
        </TabsContent>
        <TabsContent value="Novo snapshot">
          <section className="panel p-6">
            <h2 className="section-title mb-3">Registrar conteúdo de configuração</h2>
            <p className="mb-5 text-xs leading-6 text-muted-foreground">
              O endpoint original recebe o conteúdo textual, até 5 milhões de caracteres. Não há
              coleta automática de equipamentos neste contrato.
            </p>
            <ContractForm
              fields={[
                {
                  name: 'content',
                  label: 'Conteúdo do snapshot',
                  type: 'textarea',
                  required: true,
                  min: 1,
                  max: 5000000,
                },
                { name: 'notes', label: 'Notas da versão', type: 'textarea', max: 1000 },
              ]}
              connected={action.connected && !!assetId && manager}
              pending={action.pending}
              label="Registrar snapshot no ERP"
              onSubmit={async (values) => {
                await action.execute({
                  path: `/cmdb/assets/${assetId}/snapshots`,
                  method: 'POST',
                  body: values,
                });
                await snapshots.mutate();
                toast.success('Snapshot confirmado pelo ERP');
              }}
            />
          </section>
        </TabsContent>
        <TabsContent value="Comparação">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Comparar versões</h2>
            <ContractForm
              fields={[
                {
                  name: 'fromId',
                  label: 'Versão de origem',
                  options: snapshotOptions,
                  required: true,
                },
                {
                  name: 'toId',
                  label: 'Versão de destino',
                  options: snapshotOptions,
                  required: true,
                },
              ]}
              connected={action.connected && !!assetId}
              pending={action.pending}
              label="Comparar no ERP"
              onSubmit={async (values) => {
                if (values.fromId === values.toId)
                  throw new Error('Selecione duas versões diferentes.');
                setDiff(
                  await action.execute<Diff>({
                    path: queryPath(
                      `/cmdb/assets/${assetId}/snapshots-diff`,
                      values as Record<string, string>,
                    ),
                  }),
                );
              }}
            />
            {diff ? (
              <div className="mt-6">
                <p className="mb-4 text-xs">
                  v{diff.fromVersion} → v{diff.toVersion} · {diff.addedLinesCount} linhas
                  adicionadas · {diff.removedLinesCount} removidas
                </p>
                <div className="max-h-96 overflow-auto rounded-lg border border-border font-mono text-[10px]">
                  {diff.diffLines.map((line, index) => (
                    <pre
                      className={
                        line.type === 'added'
                          ? 'bg-success/10 p-1 text-success'
                          : line.type === 'removed'
                            ? 'bg-danger/10 p-1 text-danger'
                            : 'p-1 text-muted-foreground'
                      }
                      key={index}
                    >{`${line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '} ${line.text}`}</pre>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-5 text-xs text-muted-foreground">
                Nenhuma comparação executada. O resultado virá de snapshots-diff, não de um diff
                ilustrativo.
              </p>
            )}
          </section>
        </TabsContent>
        <TabsContent value="Vincular ordem">
          <section className="panel p-6">
            <h2 className="section-title mb-5">Relacionar ativo e atendimento</h2>
            <ContractForm
              fields={[
                {
                  name: 'orderId',
                  label: 'UUID da ordem de serviço',
                  type: 'uuid',
                  required: true,
                },
              ]}
              connected={action.connected && !!assetId && manager}
              pending={action.pending}
              label="Vincular no ERP"
              onSubmit={async (values) => {
                await action.execute({
                  path: `/cmdb/assets/${assetId}/link-order`,
                  method: 'POST',
                  body: values,
                });
                toast.success('Vínculo confirmado pelo ERP');
              }}
            />
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}
