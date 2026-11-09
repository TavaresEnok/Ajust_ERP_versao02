'use client';
import { useState } from 'react';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import { orderFields } from '@/lib/erp/modules';
import { orderTypes, type ErpRecord } from '@/lib/erp/contracts';
import type { FieldSpec } from '@/lib/erp/fields';
import { OrderContractForm } from './order-contract-form';

export type IntakeOccurrence = { id: string; provider: string; sector?: string; origin?: string };
export function AttendanceIntake({
  providerId,
  occurrence,
  pending,
  connected,
  onSubmit,
}: {
  providerId?: string;
  occurrence?: IntakeOccurrence;
  pending: boolean;
  connected: boolean;
  onSubmit: (path: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const { scope, transport } = useErp();
  const customers = useErpQuery<ErpRecord[]>('/customers');
  const [mode, setMode] = useState<'new' | 'existing'>(occurrence ? 'existing' : 'new');
  const [completed, setCompleted] = useState(false);
  const fixedCustomer = customers.data?.find((c) => c.id === providerId);
  const selection: FieldSpec[] = occurrence
    ? []
    : mode === 'existing'
      ? [
          {
            name: 'occurrenceId',
            label: 'Ocorrência existente (abertas)',
            type: 'uuid',
            required: true,
            reference: { resource: 'occurrences', hideClosed: true },
          },
        ]
      : providerId
        ? []
        : [
            {
              name: 'customerId',
              label: 'Provedor',
              type: 'uuid',
              required: true,
              reference: { resource: 'customers' },
            },
          ];
  const fields = [...selection, ...orderFields.filter((f) => f.name !== 'requester')];
  return (
    <div className="space-y-5">
      {!occurrence && !providerId && (
        <fieldset className="flex flex-wrap gap-4 rounded-lg bg-muted/50 p-4 text-sm">
          <legend className="sr-only">Destino da nova O.S.</legend>
          <label className="flex gap-2">
            <input
              type="radio"
              name="intake-mode"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
            />
            Novo atendimento
          </label>
          <label className="flex gap-2">
            <input
              type="radio"
              name="intake-mode"
              checked={mode === 'existing'}
              onChange={() => setMode('existing')}
            />
            Adicionar O.S. a uma ocorrência existente
          </label>
        </fieldset>
      )}
      {mode === 'new' && (
        <label className="flex gap-3 rounded-lg border border-border p-4 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={completed}
            onChange={(event) => setCompleted(event.target.checked)}
          />
          <span>
            <strong>Registrar trabalho já realizado</strong>
            <span className="block text-muted-foreground">
              A O.S. nasce concluída. Descreva o resultado e os identificadores na descrição.
            </span>
          </span>
        </label>
      )}
      {(occurrence || fixedCustomer) && (
        <p className="rounded-lg border border-border p-3 text-sm">
          Provedor:{' '}
          <strong>{occurrence?.provider || String(fixedCustomer?.tradeName || '')}</strong>
          {occurrence ? ' · A nova O.S. ficará nesta ocorrência.' : ''}
        </p>
      )}
      <OrderContractForm
        key={`${mode}-${occurrence?.id || providerId || 'all'}`}
        fields={fields}
        values={{
          ownerUserId: scope?.userId,
          assigneeUserId: scope?.role === 'analista' ? scope.userId : undefined,
          sector: occurrence?.sector,
          origin: occurrence?.origin,
        }}
        connected={connected}
        pending={pending}
        label={
          completed
            ? 'Registrar atendimento concluído'
            : mode === 'new'
              ? 'Abrir atendimento'
              : 'Adicionar O.S. à ocorrência'
        }
        onSubmit={async (values) => {
          const { customerId, occurrenceId, ...order } = values;
          if (mode === 'existing') {
            const target =
              occurrence ||
              (await transport!.request<IntakeOccurrence>({
                path: `/service-orders/occurrences/${occurrenceId}`,
              }));
            await onSubmit('/service-orders', {
              ...order,
              requester: target.provider,
              occurrenceId: target.id,
            });
          } else {
            const customer = customers.data?.find((c) => c.id === (providerId || customerId));
            if (!customer) throw new Error('Selecione um provedor cadastrado.');
            await onSubmit('/service-orders/occurrences', {
              customerId: customer.id,
              provider: customer.tradeName || customer.legalName,
              type: orderTypes[order.type as keyof typeof orderTypes] || order.type,
              sector: order.sector,
              origin: order.origin,
              openedByName: 'Equipe Ajust',
              analystResponsible: 'Equipe Ajust',
              description: order.description,
              firstOrder: {
                ...order,
                recordCompleted: completed,
                requester: customer.tradeName || customer.legalName,
              },
            });
          }
        }}
      />
    </div>
  );
}
