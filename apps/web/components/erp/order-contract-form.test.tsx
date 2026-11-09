import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FieldSpec } from '@/lib/erp/fields';
import { OrderContractForm } from './order-contract-form';

const catalog = [
  {
    id: 's1',
    name: 'Troca de senha Wi-Fi',
    description: 'Trocar a senha da rede',
    category: 'TROCA_SENHA',
    defaultPriority: 'BAIXA',
    estimatedMinutes: 15,
    checklist: ['Confirmar titular'],
    workflowTemplateCode: 'wf-senha',
  },
  { id: 's2', name: 'Rompimento de fibra', category: 'ROMPIMENTO', defaultPriority: 'CRITICA' },
];

vi.mock('@/lib/erp/gateway', () => ({
  useErp: () => ({ scope: { role: 'analista' } }),
  useErpQuery: () => ({
    data: catalog,
    connected: true,
    isLoading: false,
    error: null,
    mutate: vi.fn(),
  }),
}));

// Formulário mínimo: um input por campo, como o ContractForm real (FormData pelo name).
vi.mock('./contract-form', () => ({
  QueryState: () => null,
  ContractForm: (props: {
    fields: FieldSpec[];
    values?: Record<string, unknown>;
    onSubmit: (data: Record<string, unknown>) => void;
  }) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit(Object.fromEntries(new FormData(event.currentTarget)));
      }}
    >
      {props.fields.map((field) => (
        <input
          key={field.name}
          aria-label={field.label}
          name={field.name}
          defaultValue={String(props.values?.[field.name] ?? '')}
        />
      ))}
      <button type="submit">Enviar</button>
    </form>
  ),
}));

const fields: FieldSpec[] = [
  { name: 'title', label: 'Título' },
  { name: 'description', label: 'Descrição' },
  { name: 'type', label: 'Tipo' },
  { name: 'priority', label: 'Prioridade' },
];

function setup() {
  const onSubmit = vi.fn(async () => {});
  render(<OrderContractForm fields={fields} connected onSubmit={onSubmit} values={{}} />);
  const select = screen.getByLabelText('Serviço do catálogo (opcional)');
  const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
  return { onSubmit, select, input };
}

afterEach(cleanup);

describe('OrderContractForm (abertura com catálogo)', () => {
  it('preenche os campos sem abrir aviso bloqueante', () => {
    const { select, input } = setup();
    fireEvent.change(select, { target: { value: 's1' } });
    expect(input('Título').value).toBe('Troca de senha Wi-Fi');
    expect(input('Tipo').value).toBe('TROCA_SENHA');
    expect(input('Prioridade').value).toBe('BAIXA');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Sugestões de “Troca de senha Wi-Fi”');
  });

  it('mantém o que o usuário digitou e avisa quais campos ficaram', () => {
    const { select, input } = setup();
    fireEvent.change(input('Título'), { target: { value: 'Cliente sem internet no quarto' } });
    fireEvent.change(select, { target: { value: 's1' } });
    expect(input('Título').value).toBe('Cliente sem internet no quarto');
    expect(input('Tipo').value).toBe('TROCA_SENHA');
    expect(screen.getByRole('status').textContent).toContain('Mantivemos o que você digitou em Título');
  });

  it('trocar de serviço substitui só as sugestões anteriores', () => {
    const { select, input } = setup();
    fireEvent.change(select, { target: { value: 's1' } });
    fireEvent.change(input('Descrição'), { target: { value: 'Senha anotada pelo cliente' } });
    fireEvent.change(select, { target: { value: 's2' } });
    expect(input('Título').value).toBe('Rompimento de fibra');
    expect(input('Prioridade').value).toBe('CRITICA');
    expect(input('Descrição').value).toBe('Senha anotada pelo cliente');
  });

  it('Desfazer volta ao rascunho anterior', () => {
    const { select, input } = setup();
    fireEvent.change(input('Título'), { target: { value: 'Meu título' } });
    fireEvent.change(select, { target: { value: 's2' } });
    fireEvent.click(screen.getByRole('button', { name: /Desfazer/ }));
    expect((select as HTMLSelectElement).value).toBe('');
    expect(input('Título').value).toBe('Meu título');
    expect(input('Tipo').value).toBe('');
  });

  it('envia o workflow do serviço junto com os dados', () => {
    const { select, onSubmit } = setup();
    fireEvent.change(select, { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Troca de senha Wi-Fi', workflowTemplateCode: 'wf-senha' }),
    );
  });
});
