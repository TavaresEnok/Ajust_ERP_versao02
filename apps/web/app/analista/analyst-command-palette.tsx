'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, FileText, Search, SquareTerminal } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewItem = {
  id: string;
  label: string;
};

type OrderItem = {
  id: string | number;
  protocol: string;
  provider: string;
  tech?: string | null;
  owner?: string | null;
  status?: string;
};

type PaletteEntry =
  | { kind: 'view'; id: string; label: string }
  | { kind: 'order'; id: string | number; protocol: string; provider: string; status?: string };

export function AnalystCommandPalette({
  open,
  dark,
  views,
  orders,
  onClose,
  onNavigate,
  onOpenOrder,
}: {
  open: boolean;
  dark: boolean;
  views: ViewItem[];
  orders: OrderItem[];
  onClose: () => void;
  onNavigate: (viewId: string) => void;
  onOpenOrder: (order: OrderItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredViews = useMemo(
    () =>
      views.filter(
        (view) => !normalizedQuery || view.label.toLowerCase().includes(normalizedQuery),
      ),
    [views, normalizedQuery],
  );

  const filteredOrders = useMemo(
    () =>
      orders
        .filter((order) => {
          if (!normalizedQuery) return false;
          return (
            order.protocol.toLowerCase().includes(normalizedQuery) ||
            order.provider.toLowerCase().includes(normalizedQuery) ||
            (order.tech || '').toLowerCase().includes(normalizedQuery) ||
            (order.owner || '').toLowerCase().includes(normalizedQuery)
          );
        })
        .slice(0, 10),
    [orders, normalizedQuery],
  );

  const entries = useMemo<PaletteEntry[]>(
    () => [
      ...filteredViews.map((view) => ({ kind: 'view' as const, id: view.id, label: view.label })),
      ...filteredOrders.map((order) => ({
        kind: 'order' as const,
        id: order.id,
        protocol: order.protocol,
        provider: order.provider,
        status: order.status,
      })),
    ],
    [filteredViews, filteredOrders],
  );

  useEffect(() => {
    if (selectedIndex > Math.max(entries.length - 1, 0)) {
      setSelectedIndex(0);
    }
  }, [entries.length, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(current + 1, Math.max(entries.length - 1, 0)));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const entry = entries[selectedIndex];
        if (!entry) return;
        if (entry.kind === 'view') {
          onNavigate(entry.id);
        } else {
          const order = orders.find((item) => item.id === entry.id);
          if (order) onOpenOrder(order);
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entries, onClose, onNavigate, onOpenOrder, open, orders, selectedIndex]);

  if (!open) return null;

  itemRefs.current = [];

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center p-3 pt-[10vh] sm:p-6 sm:pt-[14vh]">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />

      <div
        className={cn(
          'relative w-full max-w-2xl overflow-hidden rounded-2xl border shadow-xl',
          dark ? 'border-slate-700/50 bg-[#111827]/95' : 'border-slate-200 bg-white',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-3 border-b px-4 py-3',
            dark ? 'border-slate-700/50 bg-[#0f172a]/80' : 'border-slate-100 bg-slate-50/80',
          )}
        >
          <Search size={16} className={dark ? 'text-slate-500' : 'text-slate-400'} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Buscar paginas, protocolos ou provedores..."
            className={cn(
              'flex-1 bg-transparent text-sm outline-none',
              dark
                ? 'text-slate-100 placeholder:text-slate-500'
                : 'text-slate-900 placeholder:text-slate-400',
            )}
          />
          <kbd
            className={cn(
              'rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
              dark
                ? 'border-slate-700/50 bg-white/5 text-slate-400'
                : 'border-slate-200 bg-white text-slate-500',
            )}
          >
            ESC
          </kbd>
        </div>

        <div className="max-h-[62vh] overflow-y-auto custom-scrollbar p-2">
          <SectionTitle dark={dark} label="Paginas" />
          {filteredViews.length > 0 ? (
            filteredViews.map((view, index) => {
              const selected = selectedIndex === index;
              return (
                <button
                  key={view.id}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  onClick={() => {
                    onNavigate(view.id);
                    onClose();
                  }}
                  className={cn(
                    'mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    selected
                      ? dark
                        ? 'bg-blue-500/12 text-blue-300'
                        : 'bg-blue-50 text-blue-700'
                      : dark
                        ? 'text-slate-200 hover:bg-white/5'
                        : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg border',
                      selected
                        ? dark
                          ? 'border-blue-500/30 bg-blue-500/12 text-blue-300'
                          : 'border-blue-200 bg-blue-50 text-blue-700'
                        : dark
                          ? 'border-slate-700/50 bg-white/5 text-slate-400'
                          : 'border-slate-200 bg-slate-50 text-slate-500',
                    )}
                  >
                    <SquareTerminal size={14} />
                  </span>
                  <span className="flex-1 text-sm font-medium">{view.label}</span>
                  <ArrowRight
                    size={14}
                    className={selected ? '' : dark ? 'text-slate-500' : 'text-slate-400'}
                  />
                </button>
              );
            })
          ) : (
            <EmptyLine dark={dark} label="Nenhuma pagina encontrada." />
          )}

          <SectionTitle dark={dark} label="Ordens de Servico" className="mt-3" />
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order, index) => {
              const absoluteIndex = filteredViews.length + index;
              const selected = selectedIndex === absoluteIndex;
              return (
                <button
                  key={order.id}
                  ref={(node) => {
                    itemRefs.current[absoluteIndex] = node;
                  }}
                  onClick={() => {
                    onOpenOrder(order);
                    onClose();
                  }}
                  className={cn(
                    'mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    selected
                      ? dark
                        ? 'bg-cyan-500/12 text-cyan-300'
                        : 'bg-cyan-50 text-cyan-700'
                      : dark
                        ? 'text-slate-200 hover:bg-white/5'
                        : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-[11px]',
                      selected
                        ? dark
                          ? 'border-cyan-500/30 bg-cyan-500/12 text-cyan-300'
                          : 'border-cyan-200 bg-cyan-50 text-cyan-700'
                        : dark
                          ? 'border-slate-700/50 bg-white/5 text-slate-400'
                          : 'border-slate-200 bg-slate-50 text-slate-500',
                    )}
                  >
                    <FileText size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-semibold">{order.protocol}</div>
                    <div
                      className={cn('truncate text-xs', dark ? 'text-slate-400' : 'text-slate-500')}
                    >
                      {order.provider}
                    </div>
                  </div>
                  <ArrowRight
                    size={14}
                    className={selected ? '' : dark ? 'text-slate-500' : 'text-slate-400'}
                  />
                </button>
              );
            })
          ) : (
            <EmptyLine
              dark={dark}
              label={normalizedQuery ? 'Nenhuma O.S encontrada.' : 'Digite para buscar O.S.'}
            />
          )}
        </div>

        <div
          className={cn(
            'flex flex-wrap items-center gap-3 border-t px-4 py-2.5 text-[11px]',
            dark
              ? 'border-slate-700/50 bg-[#0f172a]/80 text-slate-500'
              : 'border-slate-100 bg-slate-50 text-slate-500',
          )}
        >
          <Hotkey dark={dark} label="Navegar">
            ↑↓
          </Hotkey>
          <Hotkey dark={dark} label="Abrir">
            ENTER
          </Hotkey>
          <Hotkey dark={dark} label="Fechar">
            ESC
          </Hotkey>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  dark,
  label,
  className,
}: {
  dark: boolean;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'px-2 py-2 text-[11px] font-bold uppercase tracking-[0.08em]',
        dark ? 'text-slate-500' : 'text-slate-400',
        className,
      )}
    >
      {label}
    </div>
  );
}

function EmptyLine({ dark, label }: { dark: boolean; label: string }) {
  return (
    <div className={cn('px-3 py-2 text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>
      {label}
    </div>
  );
}

function Hotkey({
  dark,
  label,
  children,
}: {
  dark: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd
        className={cn(
          'rounded-md border px-1.5 py-0.5 font-mono text-[10px]',
          dark
            ? 'border-slate-700/50 bg-white/5 text-slate-400'
            : 'border-slate-200 bg-white text-slate-500',
        )}
      >
        {children}
      </kbd>
      {label}
    </span>
  );
}
