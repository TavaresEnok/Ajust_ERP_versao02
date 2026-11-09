import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useVaultConfirmation, type VaultConfirmation } from './vault-confirmation';

let result: Promise<VaultConfirmation | null> | null = null;

function Harness() {
  const confirmation = useVaultConfirmation();
  return (
    <>
      <button onClick={() => (result = confirmation.request())}>Pedir</button>
      {confirmation.dialog}
    </>
  );
}

async function open() {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Pedir' }));
  await screen.findByRole('dialog');
}

afterEach(() => {
  cleanup();
  result = null;
});

describe('Confirmação do cofre (C-054)', () => {
  it('só libera com motivo e senha preenchidos', async () => {
    await open();
    const confirm = screen.getByRole('button', { name: 'Confirmar consulta' });
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Motivo da consulta'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Sua senha atual'), { target: { value: 'x' } });
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Motivo da consulta'), {
      target: { value: '  Chamado 123  ' },
    });
    expect(confirm).toHaveProperty('disabled', false);
  });

  it('entrega motivo sem espaços e senha, e limpa os campos', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Motivo da consulta'), {
      target: { value: '  Chamado 123  ' },
    });
    fireEvent.change(screen.getByLabelText('Sua senha atual'), { target: { value: 's3nha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar consulta' }));
    await expect(result).resolves.toEqual({ reason: 'Chamado 123', currentPassword: 's3nha' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('fechar sem confirmar devolve null', async () => {
    await open();
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    });
    await expect(result).resolves.toBeNull();
  });
});
