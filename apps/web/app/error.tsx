'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Erro inesperado ao renderizar uma tela. Sem este limite, uma exceção de um componente
 * derrubava a página inteira numa tela em branco.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section className="panel max-w-md p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 size-8 text-destructive" aria-hidden />
        <h1 className="text-lg font-semibold">Não foi possível exibir esta tela</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu um erro inesperado. Seus dados não foram alterados. Tente novamente; se o erro
          continuar, informe o código abaixo ao suporte.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">Código: {error.digest}</p>
        )}
        <Button type="button" className="mt-5" onClick={reset}>
          <RefreshCw data-icon="inline-start" />
          Tentar novamente
        </Button>
      </section>
    </main>
  );
}
