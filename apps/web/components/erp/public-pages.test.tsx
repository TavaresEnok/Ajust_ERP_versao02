import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/erp/gateway', () => ({
  useErpPublicAction: () => ({ connected: true, pending: false, execute: vi.fn() }),
  useErpPublicQuery: () => ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

import { AuthPage } from './public-pages';

describe('AuthPage security', () => {
  it('nunca exibe credenciais fixas, senhas ou contas de demonstração na tela pública de login', () => {
    const { container } = render(<AuthPage mode="login" />);
    const text = container.textContent || '';

    expect(screen.queryByText(/Acessos de demonstração/i)).toBeNull();
    expect(text).not.toMatch(/@ajust\.invalid/i);
    expect(text).not.toMatch(/Aj!/);
    expect(text).not.toMatch(/gestores\.admin|anderson\.alves|meganet\.teste/i);
  });
});
