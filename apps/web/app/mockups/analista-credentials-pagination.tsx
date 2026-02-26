'use client';

import React from 'react';

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

type AnalystCredentialsPaginationProps = {
  dark: boolean;
  offset: number;
  pageCount: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

export function AnalystCredentialsPagination({
  dark,
  offset,
  pageCount,
  total,
  onPrev,
  onNext
}: AnalystCredentialsPaginationProps) {
  if (total <= 0) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border rounded-lg px-3 py-2 text-xs',
        dark ? 'border-slate-700/50 bg-[#0f172a]/80 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
      )}
    >
      <span>
        Mostrando {Math.min(offset + 1, total)}-{Math.min(offset + pageCount, total)} de {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={offset === 0}
          className={cn(
            'px-2 py-1 rounded border disabled:opacity-40',
            dark ? 'border-slate-700/50 hover:bg-white/5' : 'border-slate-300 hover:bg-slate-100'
          )}
        >
          Anterior
        </button>
        <button
          onClick={onNext}
          disabled={offset + pageCount >= total}
          className={cn(
            'px-2 py-1 rounded border disabled:opacity-40',
            dark ? 'border-slate-700/50 hover:bg-white/5' : 'border-slate-300 hover:bg-slate-100'
          )}
        >
          Proxima
        </button>
      </div>
    </div>
  );
}
