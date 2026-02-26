'use client';

import { useEffect, useState } from 'react';

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

type ThemeMode = 'white' | 'light-blue' | 'dark-blue' | 'cyber-purple';

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('erp-dark', mode === 'dark-blue');
  document.documentElement.setAttribute('data-erp-tone', mode);
}

function ThemeToneSwatches({
  selected,
  onSelect,
  compact,
}: {
  selected: ThemeMode;
  onSelect: (mode: ThemeMode) => void;
  compact: boolean;
}) {
  const items: Array<{ key: ThemeMode; label: string; bg: string; border: string; ring: string }> = [
    { key: 'white', label: 'Branco', bg: 'bg-white', border: 'border-slate-300/70', ring: 'ring-slate-300/80' },
    { key: 'light-blue', label: 'Azul claro', bg: 'bg-[#2754d6]', border: 'border-blue-600/80', ring: 'ring-blue-600/80' },
    { key: 'dark-blue', label: 'Azul escuro', bg: 'bg-[#1e3a8a]', border: 'border-blue-500/70', ring: 'ring-blue-500/80' },
    { key: 'cyber-purple', label: 'Roxo Cyber', bg: 'bg-[#7c3aed]', border: 'border-fuchsia-400/80', ring: 'ring-fuchsia-400/90' },
  ];

  return (
    <div className={cn('inline-flex items-center gap-1 rounded-md border border-blue-300/30 bg-blue-500/10 p-1', compact && 'p-[3px]')}>
      {items.map((item) => {
        const active = selected === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            title={item.label}
            aria-label={item.label}
            aria-pressed={active}
            className={cn(
              compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
              'rounded-[5px] border transition-all',
              item.bg,
              item.border,
              active ? cn('ring-2 opacity-100', item.ring) : 'opacity-70 hover:opacity-100'
            )}
          />
        );
      })}
    </div>
  );
}

export function SidebarUtilityButtons({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>('light-blue');

  useEffect(() => {
    applyTheme('light-blue');
  }, []);

  function onSelectTheme(next: ThemeMode) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className={cn('flex items-center gap-2', compact ? 'flex-col' : 'flex-row w-full')}>
      <div
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-200',
          compact ? 'h-9 w-9' : 'flex-1 px-3 py-2 text-xs font-semibold whitespace-nowrap'
        )}
        title="Tema"
      >
        <ThemeToneSwatches selected={theme} onSelect={onSelectTheme} compact={compact} />
        {!compact && <span>Tema</span>}
      </div>
    </div>
  );
}
