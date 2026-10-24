export type FieldSpec = {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'textarea'
    | 'number'
    | 'email'
    | 'password'
    | 'url'
    | 'datetime-local'
    | 'date'
    | 'time'
    | 'checkbox'
    | 'list'
    | 'uuid'
    | 'json';
  reference?: {
    resource:
      | 'users'
      | 'customers'
      | 'orders'
      | 'occurrences'
      | 'changes'
      | 'tenants'
      | 'events'
      | 'sectors'
      | 'origins';
    value?: 'id' | 'name';
  };
  options?: Readonly<Record<string, string>>;
  required?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  nullable?: boolean;
  pattern?: string;
  hint?: string;
  defaultValue?: string | number | boolean;
};
export function parseFields(specs: FieldSpec[], form: FormData) {
  const result: Record<string, unknown> = {};
  for (const field of specs) {
    const text = String(form.get(field.name) ?? '');
    const raw = field.type === 'password' ? text : text.trim();
    if (field.type === 'checkbox') {
      result[field.name] = form.has(field.name);
      continue;
    }
    if (!raw) {
      if (field.required) throw new Error(`Preencha ${field.label.toLowerCase()}.`);
      if (field.nullable) result[field.name] = null;
      continue;
    }
    if (field.pattern && !new RegExp(field.pattern).test(raw))
      throw new Error(`Formato inválido em ${field.label}.`);
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw))
      throw new Error(`E-mail inválido em ${field.label}.`);
    if (field.type === 'url') {
      try {
        const url = new URL(raw);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        throw new Error(`URL HTTP ou HTTPS inválida em ${field.label}.`);
      }
    }
    if (field.type === 'number' && field.integer && !Number.isInteger(Number(raw)))
      throw new Error(`${field.label} deve ser um número inteiro.`);
    if (field.options && !(raw in field.options))
      throw new Error(`Seleção inválida em ${field.label}.`);
    if (
      field.type === 'uuid' &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
    )
      throw new Error(`${field.label}: informe um UUID real, não um protocolo demonstrativo.`);
    let value: unknown = raw;
    if (field.type === 'number') {
      value = Number(raw);
      if (
        !Number.isFinite(value) ||
        (field.min !== undefined && Number(value) < field.min) ||
        (field.max !== undefined && Number(value) > field.max)
      )
        throw new Error(`Valor fora do intervalo em ${field.label}.`);
    } else if (field.type === 'datetime-local') {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) throw new Error(`Data inválida em ${field.label}.`);
      value = date.toISOString();
    } else if (field.type === 'list')
      value = raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    else if (field.type === 'json') {
      try {
        value = JSON.parse(raw);
      } catch {
        throw new Error(`JSON inválido em ${field.label}.`);
      }
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${field.label} deve ser um objeto JSON.`);
    } else if (!field.options && field.type !== 'uuid') {
      if (field.min !== undefined && raw.length < field.min)
        throw new Error(`${field.label}: mínimo de ${field.min} caracteres.`);
      if (field.max !== undefined && raw.length > field.max)
        throw new Error(`${field.label}: máximo de ${field.max} caracteres.`);
    }
    result[field.name] = value;
  }
  if (
    result.plannedStart &&
    result.plannedEnd &&
    String(result.plannedEnd) <= String(result.plannedStart)
  )
    throw new Error('O fim da janela deve ser posterior ao início.');
  if (result.startTime && result.endTime && String(result.endTime) <= String(result.startTime))
    throw new Error('O horário de término deve ser posterior ao início.');
  if (result.timezone) {
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: String(result.timezone) });
    } catch {
      throw new Error('Informe um fuso horário IANA válido.');
    }
  }
  if (result.expiresAt && new Date(String(result.expiresAt)) <= new Date())
    throw new Error('A expiração deve estar no futuro.');
  if (result.channel && result.target) {
    if (result.channel === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(result.target)))
      throw new Error('Informe um e-mail de destino válido.');
    if (result.channel !== 'EMAIL') {
      try {
        const url = new URL(String(result.target));
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
      } catch {
        throw new Error('Informe uma URL HTTP ou HTTPS de destino válida.');
      }
    }
  }
  for (const [start, end] of [
    ['startAt', 'endAt'],
    ['startsAt', 'endsAt'],
    ['from', 'to'],
    ['periodStart', 'periodEnd'],
    ['startDate', 'endDate'],
  ]) {
    if (result[start] && result[end] && String(result[end]) < String(result[start]))
      throw new Error('O fim do período não pode ser anterior ao início.');
  }
  return result;
}
