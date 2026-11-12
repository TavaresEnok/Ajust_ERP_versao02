'use client';
/**
 * Confirmação de consulta ao cofre. Desde 12/11/2026, por decisão da gestão, o cofre não pede
 * mais motivo nem senha: a consulta é liberada direto e continua registrada na auditoria (quem,
 * quando, qual acesso) e limitada por hora no servidor. O hook mantém a mesma interface para os
 * chamadores (request() devolve o corpo da requisição; dialog não renderiza nada).
 */
export type VaultConfirmation = { reason?: string; currentPassword?: string };
const EMPTY: VaultConfirmation = {};
export function useVaultConfirmation() {
  return {
    request: () => Promise.resolve<VaultConfirmation | null>(EMPTY),
    dialog: null,
  };
}
