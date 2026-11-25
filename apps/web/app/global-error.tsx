'use client';

/** Último recurso: erro no layout raiz (o error.tsx não cobre o próprio layout). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem' }}>O Ajust ERP encontrou um erro inesperado</h1>
        <p style={{ color: '#64748b' }}>
          Atualize a página. Se o erro continuar, contate o suporte.
        </p>
        {error.digest && <p style={{ fontFamily: 'monospace' }}>Código: {error.digest}</p>}
        <button type="button" onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
