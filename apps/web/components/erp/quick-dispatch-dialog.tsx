'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { orderTypes, priorities, type ErpRecord } from '@/lib/erp/contracts';
import { errorMessage } from '@/lib/erp/contracts';
import { modules, orderFields } from '@/lib/erp/modules';
import { listRecords, refreshVisualData, useRouteBase } from '@/lib/erp/visual-data';
import { ContractForm } from './contract-form';

const templates = [
  { id: 'bgp', title: 'Incidente de sessão BGP', type: 'BGP', priority: 'CRITICA' },
  { id: 'fiber', title: 'Rompimento de fibra ou link', type: 'ROMPIMENTO', priority: 'CRITICA' },
  { id: 'degradation', title: 'Lentidão ou degradação', type: 'LENTIDAO', priority: 'ALTA' },
  { id: 'dns', title: 'Atendimento de DNS', type: 'DNS', priority: 'NORMAL' },
] as const;

const quickFields = orderFields.filter((field) =>
  ['title', 'type', 'priority', 'description', 'requester', 'sector', 'origin'].includes(
    field.name,
  ),
);

function isOrderType(value: unknown): value is keyof typeof orderTypes {
  return typeof value === 'string' && value in orderTypes;
}

function isPriority(value: unknown): value is keyof typeof priorities {
  return typeof value === 'string' && value in priorities;
}

export function QuickDispatchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const base = useRouteBase();
  const { scope } = useErp();
  const action = useErpAction();
  const { mutate } = useSWRConfig();
  const canCreate = !scope || modules.orders.createRoles?.includes(scope.role) === true;
  const catalog = useErpQuery<unknown>(
    open && canCreate ? '/service-catalog?activeOnly=true' : null,
  );
  const services = useMemo(
    () => listRecords(catalog.data).filter((record) => typeof record.name === 'string'),
    [catalog.data],
  );
  const [templateId, setTemplateId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const template = templates.find((item) => item.id === templateId);
  const service = services.find((item) => item.id === serviceId);
  const values = {
    title: typeof service?.name === 'string' ? service.name : template?.title,
    type: isOrderType(service?.category) ? service.category : template?.type,
    priority: isPriority(service?.defaultPriority) ? service.defaultPriority : template?.priority,
    description: typeof service?.description === 'string' ? service.description : undefined,
  };

  async function create(values: Record<string, unknown>) {
    try {
      const record = await action.execute<ErpRecord>({
        path: '/service-orders',
        method: 'POST',
        body: values,
      });
      await refreshVisualData(mutate);
      onOpenChange(false);
      toast.success('Ordem criada pelo ERP');
      if (record?.id) router.push(`${base}/ordens/${encodeURIComponent(record.id)}`);
    } catch (cause) {
      throw new Error(errorMessage(cause));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Despacho rápido</DialogTitle>
          <DialogDescription>
            Abra uma ordem com os campos do ERP. A empresa e o escopo vêm da sessão; o SLA oficial é
            calculado pelo backend.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <Field>
            <FieldLabel htmlFor="dispatch-template">Modelo de preenchimento</FieldLabel>
            <select
              id="dispatch-template"
              className="native-select w-full"
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value);
                setServiceId('');
              }}
            >
              <option value="">Sem modelo</option>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <FieldDescription>
              O modelo apenas sugere tipo, título e prioridade; não substitui política de SLA nem
              validação do servidor.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="dispatch-service">Serviço ativo do catálogo</FieldLabel>
            <select
              id="dispatch-service"
              className="native-select w-full"
              value={serviceId}
              disabled={!catalog.connected || catalog.isLoading}
              onChange={(event) => {
                setServiceId(event.target.value);
                if (event.target.value) setTemplateId('');
              }}
            >
              <option value="">Não selecionar serviço</option>
              {services.map((item) => (
                <option key={item.id} value={item.id}>
                  {String(item.name)}
                </option>
              ))}
            </select>
            <FieldDescription>
              {catalog.connected
                ? 'A seleção preenche os campos correspondentes; o contrato da ordem não envia um ID de catálogo.'
                : 'O catálogo será carregado após a conexão com o ERP.'}
            </FieldDescription>
          </Field>
          {catalog.error && (
            <p role="alert" className="text-xs text-danger">
              {errorMessage(catalog.error)}
            </p>
          )}
          <ContractForm
            key={`${templateId}:${serviceId}`}
            fields={quickFields}
            values={values}
            connected={action.connected && canCreate}
            pending={action.pending}
            label="Criar ordem"
            onSubmit={create}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
