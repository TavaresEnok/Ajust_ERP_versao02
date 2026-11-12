import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVaultConfirmation } from './vault-confirmation';

describe('Consulta ao cofre sem confirmação (decisão de 12/11/2026)', () => {
  it('libera direto, sem diálogo, motivo ou senha', async () => {
    const { result } = renderHook(() => useVaultConfirmation());
    expect(result.current.dialog).toBeNull();
    await expect(result.current.request()).resolves.toEqual({});
  });
});
