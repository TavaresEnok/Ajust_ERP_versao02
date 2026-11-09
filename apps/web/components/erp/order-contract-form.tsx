'use client';
import { useRef, useState, type ComponentProps } from 'react';
import { Sparkles, Undo2 } from 'lucide-react';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import { orderTypes, priorities } from '@/lib/erp/contracts';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { ContractForm, QueryState } from './contract-form';

type CatalogService = Record<string, unknown> & { id: string; name: string };
type Draft = Record<string, unknown>;

/** Campos que um serviço do catálogo preenche no rascunho. */
function serviceValues(service: CatalogService | undefined): Draft {
  if (!service) return {};
  return {
    title: service.name,
    ...(typeof service.description === 'string' ? { description: service.description } : {}),
    ...(typeof service.category === 'string' && service.category in orderTypes
      ? { type: service.category }
      : {}),
    ...(typeof service.defaultPriority === 'string' && service.defaultPriority in priorities
      ? { priority: service.defaultPriority }
      : {}),
  };
}

const isBlank = (value: unknown) =>
  value === undefined || value === null || String(value).trim() === '';
const same = (a: unknown, b: unknown) => String(a ?? '').trim() === String(b ?? '').trim();

export function OrderContractForm(props: ComponentProps<typeof ContractForm>) {
  const { scope } = useErp();
  const allowed = !scope || ['super_admin', 'gerente', 'analista', 'cliente'].includes(scope.role);
  const catalog = useErpQuery<unknown>(allowed ? '/service-catalog?activeOnly=true' : null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState('');
  // Valores atuais do rascunho; null enquanto nenhum serviço foi escolhido.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [kept, setKept] = useState<string[]>([]);
  const [undo, setUndo] = useState<{ selected: string; draft: Draft | null } | null>(null);
  const services = Array.isArray(catalog.data)
    ? catalog.data.filter(
        (row): row is CatalogService =>
          !!row &&
          typeof row === 'object' &&
          typeof row.id === 'string' &&
          typeof row.name === 'string',
      )
    : [];
  const service = services.find((row) => row.id === selected);
  const values = draft ?? props.values;

  /** Lê o que está digitado agora no formulário, sem perder nada. */
  function currentDraft(): Draft {
    const form = wrapper.current?.querySelector('form');
    const base: Draft = { ...(values || {}) };
    if (!form) return base;
    const data = new FormData(form);
    for (const field of props.fields) {
      if (field.type === 'password') continue;
      if (field.type === 'checkbox') base[field.name] = data.has(field.name);
      else if (data.has(field.name)) base[field.name] = data.get(field.name);
    }
    return base;
  }

  function choose(nextId: string) {
    if (nextId === selected) return;
    const current = currentDraft();
    const previous = serviceValues(service);
    const next = serviceValues(services.find((row) => row.id === nextId));
    const merged: Draft = { ...current };
    const preserved: string[] = [];
    // Campos do serviço anterior que o usuário não alterou voltam ao valor inicial.
    for (const [name, value] of Object.entries(previous)) {
      if (same(current[name], value)) merged[name] = props.values?.[name];
    }
    // O novo serviço só preenche o que está vazio ou ainda veio do catálogo.
    for (const [name, value] of Object.entries(next)) {
      const typed = current[name];
      if (isBlank(typed) || same(typed, previous[name]) || same(typed, value)) merged[name] = value;
      else preserved.push(name);
    }
    props.onDirtyChange?.(true);
    setUndo({ selected, draft: current });
    setKept(preserved);
    setDraft(merged);
    setSelected(nextId);
    setFormKey((key) => key + 1);
  }

  function revert() {
    if (!undo) return;
    setSelected(undo.selected);
    setDraft(undo.draft);
    setKept([]);
    setUndo(null);
    setFormKey((key) => key + 1);
  }

  const keptLabels = kept
    .map((name) => props.fields.find((field) => field.name === name)?.label || name)
    .join(', ');

  return (
    <div ref={wrapper} className="flex flex-col gap-5">
      {allowed && (
        <Field>
          <FieldLabel htmlFor="order-catalog">Serviço do catálogo (opcional)</FieldLabel>
          <select
            id="order-catalog"
            className="native-select w-full"
            value={selected}
            disabled={!catalog.connected || catalog.isLoading}
            onChange={(event) => choose(event.target.value)}
          >
            <option value="">Sem serviço · preencher manualmente</option>
            {services.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          {undo ? (
            <p
              role="status"
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
            >
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              <span>
                {service
                  ? `Sugestões de “${service.name}” aplicadas.`
                  : 'Sugestões do catálogo removidas.'}
                {keptLabels && ` Mantivemos o que você digitou em ${keptLabels}.`}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                onClick={revert}
              >
                <Undo2 className="size-3" aria-hidden />
                Desfazer
              </button>
            </p>
          ) : (
            <FieldDescription>
              {catalog.connected
                ? 'Sugere título, tipo, prioridade e as etapas. Tudo pode ser editado.'
                : 'Os serviços aparecerão após conectar o ERP. O preenchimento manual continua disponível.'}
            </FieldDescription>
          )}
        </Field>
      )}
      {service &&
        typeof service.workflowTemplateCode === 'string' &&
        service.workflowTemplateCode && (
          <p role="note" className="text-sm text-muted-foreground">
            O atendimento seguirá as etapas configuradas para este serviço. As evidências
            necessárias aparecerão em cada etapa.
          </p>
        )}
      <QueryState
        loading={catalog.isLoading}
        error={catalog.error}
        onRetry={() => void catalog.mutate()}
      />
      {service &&
        (typeof service.slaHours === 'number' ||
          typeof service.estimatedMinutes === 'number' ||
          (Array.isArray(service.checklist) && service.checklist.length > 0)) && (
          <details className="rounded-lg border border-border px-4 py-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Referência do serviço
              {typeof service.slaHours === 'number' &&
                ` · prazo ${
                  service.slaHours % 24 === 0
                    ? `${service.slaHours / 24} ${service.slaHours === 24 ? 'dia útil' : 'dias úteis'}`
                    : `${service.slaHours} horas úteis`
                }`}
            </summary>
            {Array.isArray(service.checklist) && (
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
                {service.checklist
                  .filter((item): item is string => typeof item === 'string')
                  .map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
              </ul>
            )}
          </details>
        )}
      <ContractForm
        {...props}
        key={formKey}
        values={values}
        onSubmit={(data) =>
          props.onSubmit({
            ...data,
            ...(service?.workflowTemplateCode
              ? { workflowTemplateCode: service.workflowTemplateCode }
              : {}),
            // O servidor usa o prazo (SLA) próprio do serviço, quando houver.
            ...(service ? { serviceCatalogItemId: service.id } : {}),
          })
        }
      />
    </div>
  );
}
