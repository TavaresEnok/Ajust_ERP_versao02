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
  onDirtyChange,
}: {
  providerId?: string;
  occurrence?: IntakeOccurrence;
  pending: boolean;
  connected: boolean;
  onSubmit: (path: string, body: Record<string, unknown>) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
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
  const field = (name: string) => orderFields.find((f) => f.name === name)!;
  const what = 'O que aconteceu';
  const who = 'Para quem';
  const owner = 'Quem cuida';
  // Mesmos campos e regras de orderFields; só a ordem e o agrupamento mudam.
  const fields: FieldSpec[] = [
    { ...field('title'), section: what },
    { ...field('type'), section: what },
    { ...field('description'), section: what },
    ...selection.map((f) => ({ ...f, section: who })),
    { ...field('origin'), section: who },
    { ...field('sector'), section: who },
    { ...field('assigneeUserId'), section: owner },
    { ...field('priority'), section: owner },
    { ...field('ownerUserId'), advanced: true },
    {
      ...field('deadlineAt'),
      label: 'Prazo excepcional',
      hint: 'Opcional. Sem ele, vale o prazo do serviço.',
      advanced: true,
    },
    { ...field('internalNotes'), advanced: true },
  ];
  return (
    <div className="space-y-5">
      {!occurrence && !providerId && (
        <div
          role="radiogroup"
          aria-label="Destino da nova O.S."
          className="inline-flex w-fit rounded-lg border border-border p-0.5 text-sm"
        >
          {(
            [
              ['new', 'Novo atendimento'],
              ['existing', 'Em ocorrência existente'],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                mode === value
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
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
        onDirtyChange={onDirtyChange}
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
      >
        {mode === 'new' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={completed}
              onChange={(event) => setCompleted(event.target.checked)}
            />
            Registrar trabalho já realizado
            <span className="text-xs">(a O.S. já nasce concluída)</span>
          </label>
        )}
      </OrderContractForm>
    </div>
  );
}
