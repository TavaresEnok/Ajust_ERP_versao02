'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Cable, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { parseFields, type FieldSpec } from '@/lib/erp/fields';
import { errorMessage } from '@/lib/erp/contracts';
import { ReferenceField, fieldReference } from './reference-field';
export function ConnectionNotice() {
  return (
    <Alert className="mb-5">
      <Cable />
      <AlertTitle>Preparado para o ERP · backend não conectado</AlertTitle>
      <AlertDescription>
        Explore os formulários e valide os campos. Nenhuma operação será enviada, nenhum registro
        fictício será apresentado como real. Rascunhos não são salvos. Não utilize senhas ou
        segredos reais nesta prévia.
      </AlertDescription>
    </Alert>
  );
}
export function ErpEmpty({ connected = false }: { connected?: boolean }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Cable />
        </EmptyMedia>
        <EmptyTitle>{connected ? 'Nada cadastrado ainda' : 'Sem conexão com o ERP'}</EmptyTitle>
        <EmptyDescription>
          {connected
            ? 'Quando houver registros, eles aparecem aqui.'
            : 'Entre novamente para carregar os dados. Nada é mostrado sem conexão.'}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function QueryState({
  loading,
  error,
  onRetry,
}: {
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  if (loading)
    return (
      <div className="flex flex-col gap-3 p-6" role="status" aria-label="Carregando registros">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  if (error)
    return (
      <Alert variant="destructive">
        <Info />
        <AlertTitle>Não foi possível carregar</AlertTitle>
        <AlertDescription>
          {errorMessage(error)}
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  return null;
}
function inputValue(value: unknown, type?: string) {
  if (value === undefined || value === null) return undefined;
  if (type === 'list' && Array.isArray(value)) return value.join(', ');
  if (type === 'json' && typeof value === 'object') return JSON.stringify(value, null, 2);
  if (type === 'datetime-local' && typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()))
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  return String(value);
}
export function ContractFields({
  fields,
  values = {},
}: {
  fields: FieldSpec[];
  values?: Record<string, unknown>;
}) {
  const prefix = useId();
  const grouped = fields.some((field) => field.section || field.advanced);
  if (grouped) {
    const main = fields.filter((field) => !field.advanced);
    const extra = fields.filter((field) => field.advanced);
    const sections: { title?: string; fields: FieldSpec[] }[] = [];
    for (const field of main) {
      const last = sections[sections.length - 1];
      if (last && last.title === field.section) last.fields.push(field);
      else sections.push({ title: field.section, fields: [field] });
    }
    return (
      <div className="flex flex-col gap-5 [&_[data-slot=field-label]]:font-normal [&_[data-slot=field-label]]:text-muted-foreground">
        {sections.map((section, index) => (
          <section
            key={section.title || index}
            className={`flex flex-col gap-3 ${index ? 'border-t border-border pt-5' : ''}`}
          >
            {section.title && (
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
            )}
            <ContractFieldGrid prefix={prefix} fields={section.fields} values={values} />
          </section>
        ))}
        {extra.length > 0 && (
          <details className="group rounded-lg border border-border">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm text-muted-foreground hover:text-foreground">
              Mais opções
            </summary>
            <div className="border-t border-border p-4">
              <ContractFieldGrid prefix={prefix} fields={extra} values={values} />
            </div>
          </details>
        )}
      </div>
    );
  }
  return <ContractFieldGrid prefix={prefix} fields={fields} values={values} />;
}

function ContractFieldGrid({
  prefix,
  fields,
  values,
}: {
  prefix: string;
  fields: FieldSpec[];
  values: Record<string, unknown>;
}) {
  return (
    <FieldGroup className="form-grid">
      {fields.map((field) => {
        const id = prefix + field.name;
        const value = values[field.name] ?? field.defaultValue;
        return (
          <Field
            key={field.name}
            className={['textarea', 'json'].includes(field.type || '') ? 'full-field' : undefined}
          >
            <FieldLabel htmlFor={id}>
              {field.label}
              {field.required ? ' *' : ''}
            </FieldLabel>
            {fieldReference(field) ? (
              <ReferenceField
                key={`${field.name}-${inputValue(value) || 'new'}`}
                id={id}
                field={field}
                value={inputValue(value)}
              />
            ) : field.options ? (
              <select
                id={id}
                name={field.name}
                className="native-select"
                required={field.required}
                defaultValue={inputValue(value)}
              >
                <option value="">Selecione</option>
                {Object.entries(field.options).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            ) : field.type === 'checkbox' ? (
              <input
                id={id}
                name={field.name}
                type="checkbox"
                className="size-4 accent-primary"
                defaultChecked={Boolean(value)}
              />
            ) : field.type === 'textarea' || field.type === 'json' ? (
              <Textarea
                id={id}
                name={field.name}
                required={field.required}
                minLength={field.min}
                maxLength={field.max}
                defaultValue={inputValue(value, field.type)}
                rows={4}
                spellCheck={field.type !== 'json'}
              />
            ) : (
              <Input
                id={id}
                name={field.name}
                type={['uuid', 'list'].includes(field.type || '') ? 'text' : field.type || 'text'}
                required={field.required}
                min={field.type === 'number' ? field.min : undefined}
                max={field.type === 'number' ? field.max : undefined}
                minLength={field.type !== 'number' ? field.min : undefined}
                maxLength={field.type !== 'number' ? field.max : undefined}
                pattern={field.pattern}
                step={field.type === 'number' ? (field.integer ? '1' : 'any') : undefined}
                defaultValue={field.type === 'password' ? undefined : inputValue(value, field.type)}
                autoComplete={field.type === 'password' ? 'new-password' : undefined}
              />
            )}
            {field.hint && <FieldDescription>{field.hint}</FieldDescription>}
          </Field>
        );
      })}
    </FieldGroup>
  );
}
export function ContractForm({
  fields,
  values,
  onSubmit,
  connected,
  pending,
  label = 'Enviar ao ERP',
  children,
  draft = false,
  onDirtyChange,
}: {
  fields: FieldSpec[];
  values?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  connected: boolean;
  pending?: boolean;
  label?: string;
  children?: ReactNode;
  draft?: boolean;
  /** Avisa quem abriu o formulário que há algo digitado e ainda não enviado. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirtyChange?.(dirty);
    if (!dirty) return;
    // Fechar ou recarregar a aba com o formulário preenchido pede confirmação do navegador.
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, onDirtyChange]);
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError('');
    setValidated(false);
    try {
      const data = parseFields(fields, new FormData(event.currentTarget));
      if (!connected && !draft) {
        setValidated(true);
        return;
      }
      await onSubmit(data);
      setDirty(false);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      onInput={() => setDirty(true)}
      onChange={() => setDirty(true)}
      className="flex flex-col gap-5"
    >
      <ContractFields fields={fields} values={values} />
      {children}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {validated && (
        <Alert>
          <Check />
          <AlertTitle>Campos validados · não enviado</AlertTitle>
          <AlertDescription>
            O formulário está preenchido. A operação depende da conexão com o ERP e da validação das
            regras no servidor.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
        <p className="mr-auto text-[10px] text-muted-foreground">
          {connected
            ? 'A alteração só será confirmada após a resposta do servidor.'
            : 'Prévia do formulário. Nenhum dado será salvo.'}
        </p>
        <Button type="submit" disabled={pending || submitting}>
          {pending || submitting
            ? 'Enviando...'
            : draft
              ? 'Aplicar ao rascunho'
              : connected
                ? label
                : 'Validar preenchimento'}
        </Button>
      </div>
    </form>
  );
}
