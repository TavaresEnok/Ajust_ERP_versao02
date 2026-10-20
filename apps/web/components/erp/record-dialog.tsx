'use client';
import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { modules, createPayload } from '@/lib/erp/modules';
import { routeModules, listRecords, refreshVisualData } from '@/lib/erp/visual-data';
import type { FieldSpec } from '@/lib/erp/fields';
import type { ErpRecord } from '@/lib/erp/contracts';
import { ContractForm, QueryState } from './contract-form';
export type FormField = {
  name: string;
  label: string;
  type?: string;
  options?: string[];
  value?: string;
  required?: boolean;
  placeholder?: string;
};
export function RecordDialog({
  title,
  description,
  fields,
  label,
  trigger,
  open: controlled,
  onOpenChange,
  recordId,
  moduleKey: explicitModule,
  endpoint,
  contractFields,
  onCreated,
  record,
  footer,
}: {
  title: string;
  description?: string;
  fields: FormField[];
  onSave?: (values: Record<string, string>) => void;
  label?: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  recordId?: string;
  moduleKey?: string;
  endpoint?: string;
  contractFields?: FieldSpec[];
  onCreated?: (record: ErpRecord) => void;
  record?: ErpRecord;
  footer?: ReactNode;
}) {
  const [local, setLocal] = useState(false);
  const open = controlled ?? local;
  const setOpen = onOpenChange ?? setLocal;
  const path = usePathname().split('/').filter(Boolean);
  const moduleKey = explicitModule || routeModules[path[1]];
  const config = modules[moduleKey];
  const { scope } = useErp();
  const action = useErpAction();
  const { mutate } = useSWRConfig();
  const query = useErpQuery<unknown>(
    open && recordId && !record && config
      ? config.endpoint +
          (moduleKey === 'catalog'
            ? '?activeOnly=false'
            : moduleKey === 'articles' &&
                (!scope || ['super_admin', 'gerente'].includes(scope.role))
              ? '?includeDrafts=true'
              : '')
      : null,
  );
  const row =
    (record?.id === recordId ? record : undefined) ||
    listRecords(query.data)
      .map((row) =>
        row.user && typeof row.user === 'object'
          ? { ...row, ...(row.user as object), roleCode: (row.role as { code?: string })?.code }
          : row,
      )
      .find((row) => row.id === recordId);
  const allowed =
    !scope ||
    (recordId ? config?.updateRoles || config?.createRoles : config?.createRoles)?.includes(
      scope.role,
    ) !== false;
  const specs =
    contractFields ||
    (recordId
      ? config?.updateFields ||
        config?.fields.filter(
          (f) => moduleKey !== 'users' || !['tenantId', 'password'].includes(f.name),
        )
      : config?.fields) ||
    fields.map((f) => ({
      name: f.name,
      label: f.label,
      type:
        f.type === 'textarea'
          ? ('textarea' as const)
          : f.type === 'email'
            ? ('email' as const)
            : undefined,
      required: f.required !== false,
    }));
  const editable = allowed && (!recordId || !!config?.update || !!endpoint);
  const safeSpecs = specs.map((field) =>
    scope?.role === 'cliente' && field.name === 'roleCode'
      ? { ...field, options: { cliente: 'Cliente', leitura: 'Somente leitura' } }
      : field,
  );
  return (
    <>
      {controlled === undefined &&
        (trigger ? (
          <button type="button" aria-label={title} onClick={() => setOpen(true)}>
            {trigger}
          </button>
        ) : (
          <Button onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" />
            {label || title}
          </Button>
        ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {description ||
                'Preencha os dados do cadastro. A alteração é confirmada somente pelo ERP.'}
            </DialogDescription>
          </DialogHeader>
          <QueryState
            loading={query.isLoading}
            error={query.error}
            onRetry={() => void query.mutate()}
          />
          {!allowed && (
            <p role="alert" className="text-xs text-danger">
              Seu perfil não pode realizar esta operação.
            </p>
          )}
          <ContractForm
            key={`${recordId || 'new'}-${String(row?.updatedAt || '')}`}
            fields={safeSpecs}
            values={row || (scope ? { tenantId: scope.tenantId } : {})}
            connected={
              action.connected && editable && !!(endpoint || config) && (!recordId || !!row)
            }
            pending={action.pending}
            label="Salvar alterações"
            onSubmit={async (values) => {
              if (!editable || (!endpoint && !config))
                throw new Error('Esta operação não possui contrato disponível.');
              const created = await action.execute<ErpRecord | undefined>({
                path:
                  endpoint ||
                  `${config.endpoint}${recordId ? `/${encodeURIComponent(recordId)}` : ''}`,
                method: recordId ? config?.updateMethod || 'PATCH' : 'POST',
                body: createPayload(moduleKey, values),
              });
              if (!recordId && created) onCreated?.(created);
              await refreshVisualData(mutate);
              setOpen(false);
              toast.success('Alteração confirmada pelo ERP');
            }}
          />
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          {footer}
        </DialogContent>
      </Dialog>
    </>
  );
}
