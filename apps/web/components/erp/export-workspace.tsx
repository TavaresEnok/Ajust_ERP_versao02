'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import {
  errorMessage,
  orderTypes,
  orderStatuses,
  priorities,
  queryPath,
  type ErpRecord,
  type ErpDownload,
} from '@/lib/erp/contracts';
import { ContractForm, ErpEmpty, QueryState } from './contract-form';
import { PanelHeading } from './primitives';
import { displayValue } from './resource-page';
import { ReportTable } from './data-report';
import type { FieldSpec } from '@/lib/erp/fields';
export async function saveDownload(
  download: ((path: string) => Promise<Blob | ErpDownload>) | undefined,
  path: string,
  filename: string,
) {
  if (!download) throw new Error('O adaptador de download não foi configurado.');
  const result = await download(path);
  const metadata = result instanceof Blob ? { blob: result } : result;
  const url = URL.createObjectURL(metadata.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = metadata.fileName || filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (metadata.truncated)
    toast.warning(
      `Exportação truncada pelo ERP${metadata.rowCount !== undefined ? ` em ${metadata.rowCount} linhas` : ''}. Restrinja os filtros para obter o restante.`,
    );
}
export function ExportWorkspace({ audit = false }: { audit?: boolean }) {
  const { transport, scope } = useErp();
  const [pending, setPending] = useState(false);
  const query = useErpQuery<{ items?: ErpRecord[] } | ErpRecord[]>(
    !audit ? '/service-orders/export/history?limit=20&offset=0' : null,
  );
  const fields: FieldSpec[] = audit
    ? [
        { name: 'startDate', label: 'De', type: 'datetime-local' },
        { name: 'endDate', label: 'Até', type: 'datetime-local' },
        {
          name: 'format',
          label: 'Formato',
          options: { csv: 'CSV', json: 'JSON' },
          defaultValue: 'csv',
          required: true,
        },
      ]
    : [
        { name: 'from', label: 'De', type: 'datetime-local' },
        { name: 'to', label: 'Até', type: 'datetime-local' },
        { name: 'status', label: 'Status', options: orderStatuses },
        { name: 'priority', label: 'Prioridade', options: priorities },
        { name: 'type', label: 'Tipo', options: orderTypes },
        { name: 'search', label: 'Busca', min: 2 },
      ];
  const rows = Array.isArray(query.data) ? query.data : query.data?.items || [];
  return (
    <div className="flex flex-col gap-5">
      <section className="panel p-6">
        <h2 className="section-title mb-5">
          {audit ? 'Exportar auditoria' : 'Exportar ordens de serviço'}
        </h2>
        <ContractForm
          fields={fields}
          connected={Boolean(transport && scope)}
          pending={pending}
          label="Gerar e baixar do ERP"
          onSubmit={async (values) => {
            setPending(true);
            try {
              const format = String(values.format || 'csv');
              const filters = Object.fromEntries(
                Object.entries(values).map(([key, value]) => [key, String(value)]),
              );
              await saveDownload(
                transport?.downloadWithMetadata || transport?.download,
                queryPath(audit ? '/audit/export' : '/service-orders/export/csv', filters),
                `ajust-${audit ? 'auditoria' : 'ordens'}.${format}`,
              );
              if (!audit) await query.mutate();
              toast.success('Arquivo recebido do ERP');
            } finally {
              setPending(false);
            }
          }}
        />
        <Alert className="mt-5">
          <AlertTitle>Exportação original, sem fila inventada</AlertTitle>
          <AlertDescription>
            {audit
              ? 'O controller oferece CSV e JSON por período. O backend deve autorizar e neutralizar fórmulas perigosas no CSV.'
              : 'O ZIP oferece geração CSV síncrona, histórico e novo download. Não há API de jobs/polling de relatórios. O adaptador lê x-export-rows e x-export-truncated e avisa se o arquivo estiver truncado. O BFF deve preservar esses cabeçalhos.'}
          </AlertDescription>
        </Alert>
      </section>
      {!audit && (
        <section className="panel">
          <PanelHeading
            title="Histórico de exportações"
            description="Arquivos gerados pelo servidor, não exportações de registros demonstrativos."
          />
          <QueryState loading={query.isLoading} error={query.error} />
          {rows.length ? (
            <>
              <ReportTable
                data={rows}
                columns={[
                  { key: 'fileName', label: 'Arquivo' },
                  { key: 'rowCount', label: 'Linhas' },
                  { key: 'createdAt', label: 'Gerado em' },
                ]}
              />
              <div className="flex flex-wrap gap-3 p-6">
                {rows.map((row) => (
                  <Button
                    variant="outline"
                    size="sm"
                    key={row.id}
                    disabled={pending || !query.connected}
                    onClick={async () => {
                      setPending(true);
                      try {
                        await saveDownload(
                          transport?.downloadWithMetadata || transport?.download,
                          `/service-orders/export/${encodeURIComponent(row.id)}/download`,
                          String(row.fileName || 'ordens.csv'),
                        );
                      } catch (error) {
                        toast.error(errorMessage(error));
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Baixar {displayValue(row.fileName)}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <ErpEmpty connected={query.connected} />
          )}
        </section>
      )}
    </div>
  );
}
