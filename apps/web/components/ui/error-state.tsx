'use client';

import { AlertTriangle, RefreshCw, WifiOff, Lock, ServerCrash } from 'lucide-react';
import { cn } from '@/lib/utils';

type ErrorVariant = 'default' | 'network' | 'auth' | 'not-found' | 'server';

interface ErrorStateProps {
  title?: string;
  message?: string;
  variant?: ErrorVariant;
  onRetry?: () => void;
  className?: string;
}

const VARIANT_CONFIG: Record<
  ErrorVariant,
  { icon: React.ComponentType<{ className?: string }>; defaultTitle: string; color: string }
> = {
  default: { icon: AlertTriangle, defaultTitle: 'Algo deu errado', color: 'text-amber-500' },
  network: { icon: WifiOff, defaultTitle: 'Sem conexão', color: 'text-gray-400' },
  auth: { icon: Lock, defaultTitle: 'Sem permissão', color: 'text-red-400' },
  'not-found': { icon: AlertTriangle, defaultTitle: 'Não encontrado', color: 'text-gray-400' },
  server: { icon: ServerCrash, defaultTitle: 'Erro no servidor', color: 'text-red-500' },
};

export function ErrorState({
  title,
  message,
  variant = 'default',
  onRetry,
  className,
}: ErrorStateProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn('flex flex-col items-center justify-center py-16 px-8 text-center', className)}
    >
      <div className={cn('mb-4', config.color)}>
        <Icon className="w-10 h-10" />
      </div>
      <h3 className="text-base font-semibold text-content-primary mb-1">
        {title ?? config.defaultTitle}
      </h3>
      {message && <p className="text-sm text-content-secondary max-w-sm mb-4">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function InlineError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">{message ?? 'Erro ao carregar dados.'}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 text-red-600 hover:text-red-800 font-medium">
          Recarregar
        </button>
      )}
    </div>
  );
}
