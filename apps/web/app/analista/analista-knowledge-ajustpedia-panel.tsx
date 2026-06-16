'use client';

import React, { useMemo, useState } from 'react';
import { AlignLeft, Check, Copy, Edit2, Filter, Plus, Search, Star, Trash2 } from 'lucide-react';

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export type AdjustPediaEntry = {
  id: string | number;
  title: string;
  tags: string[];
  author: string;
  date: string;
  description: string;
  command: string;
};

type AnalystKnowledgeAjustpediaPanelProps = {
  dark: boolean;
  tag: string;
  onlyFav: boolean;
  canManage?: boolean;
  tags: string[];
  filteredEntries: AdjustPediaEntry[];
  favorites: Array<string | number>;
  deletingId?: string | number | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onOnlyFavToggle: () => void;
  onToggleFavorite: (id: string | number) => void;
  onCopyText: (value: string) => void;
  onEditEntry?: (entry: AdjustPediaEntry) => void;
  onDeleteEntry?: (entry: AdjustPediaEntry) => void;
  onCreateTip?: () => void;
};

export function AnalystKnowledgeAjustpediaPanel({
  dark,
  tag,
  onlyFav,
  canManage = false,
  tags,
  filteredEntries,
  favorites,
  deletingId = null,
  searchQuery,
  onSearchQueryChange,
  onTagChange,
  onOnlyFavToggle,
  onToggleFavorite,
  onCopyText,
  onEditEntry,
  onDeleteEntry,
  onCreateTip,
}: AnalystKnowledgeAjustpediaPanelProps) {
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  const visibleTags = useMemo(
    () => tags.filter((currentTag) => currentTag && currentTag !== 'Todos'),
    [tags],
  );

  const handleCopy = (id: string | number, command: string) => {
    onCopyText(command);
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
  };

  const clearFilters = () => {
    onSearchQueryChange('');
    onTagChange('Todos');
    if (onlyFav) onOnlyFavToggle();
  };

  /* ── Theme-aware class helpers ── */
  const tBgSurface = dark ? 'bg-[#111827]' : 'bg-bg-surface';
  const tBgSubtle = dark ? 'bg-[#0f172a]/80' : 'bg-bg-subtle';
  const tBgHover = dark ? 'hover:bg-white/5' : 'hover:bg-bg-hover';
  const tTextPrimary = dark ? 'text-slate-100' : 'text-content-primary';
  const tTextSecondary = dark ? 'text-slate-300' : 'text-content-secondary';
  const tTextTertiary = dark ? 'text-slate-400' : 'text-content-tertiary';
  const tTextMuted = dark ? 'text-slate-500' : 'text-content-tertiary';
  const tBorder = dark ? 'border-slate-700/50' : 'border-[rgba(0,0,0,0.06)]';
  const tBorderLight = dark ? 'border-slate-700/30' : 'border-[rgba(0,0,0,0.04)]';
  const tInputBg = dark ? 'bg-[#0f172a]/80' : 'bg-bg-subtle';
  const tInputFocus = dark ? 'focus:bg-[#0f172a]' : 'focus:bg-bg-surface';
  const tPillActive = dark
    ? 'bg-blue-900/30 border border-blue-500/50 text-blue-300'
    : 'bg-accent-subtle text-accent-DEFAULT border border-accent-DEFAULT/20';
  const tPillInactive = dark
    ? 'bg-[#0f172a]/80 border border-slate-700/50 text-slate-300'
    : 'bg-bg-surface border border-[rgba(0,0,0,0.08)] text-content-secondary';
  const tTagActive = dark
    ? 'bg-slate-100 text-slate-900 border border-slate-100 font-medium'
    : 'bg-content-primary text-white border border-content-primary font-medium';
  const tTagInactive = dark
    ? 'bg-[#0f172a]/80 border border-slate-700/50 text-slate-300'
    : 'bg-bg-surface border border-[rgba(0,0,0,0.08)] text-content-secondary';
  const tFavActive = dark
    ? 'bg-amber-900/30 border-amber-500/40 text-amber-300'
    : 'bg-amber-50 text-amber-600 border border-amber-100';
  const tFavInactive = dark
    ? 'bg-[#0f172a]/80 border border-slate-700/50 text-slate-300'
    : 'bg-bg-surface border border-[rgba(0,0,0,0.08)]';
  const tEditBtn = dark
    ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 border border-blue-700/50'
    : 'bg-accent-subtle text-accent-DEFAULT hover:bg-accent-muted';
  const tDeleteBtn = dark
    ? 'bg-rose-900/25 text-rose-300 hover:bg-rose-900/40 border border-rose-700/50'
    : 'bg-red-50 text-red-600 hover:bg-red-100';
  const tPrimaryBtn = dark
    ? 'bg-blue-600 hover:bg-blue-700'
    : 'bg-accent-DEFAULT hover:bg-accent-hover';
  const tShadow = dark
    ? 'hover:shadow-[0_10px_24px_rgba(2,6,23,0.35)] shadow-sm'
    : 'shadow-sm hover:shadow-md';

  return (
    <div className="-m-6">
      <div className="max-w-6xl mx-auto pt-8 px-6 pb-12">
        {/* ── Header ── */}
        <header className="mb-6">
          <h1 className={cn('text-2xl font-bold tracking-[-0.02em] mb-1', tTextPrimary)}>
            Ajustpedia
          </h1>
          <p className={cn('text-sm', tTextSecondary)}>Procedimentos técnicos compartilhados.</p>
        </header>

        {/* ── Search + New Tip ── */}
        <div className="mb-6">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 group">
              <Search
                className={cn(
                  'w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors',
                  tTextMuted,
                  'group-focus-within:text-content-secondary',
                )}
              />
              <input
                type="text"
                placeholder="Buscar em procedimentos, comandos ou tags..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm shadow-sm outline-none transition-all',
                  tInputBg,
                  tBorder,
                  tTextPrimary,
                  tInputFocus,
                  'focus:border-accent-DEFAULT focus:ring-2 focus:ring-accent-DEFAULT/20',
                  'placeholder:text-content-tertiary',
                )}
              />
            </div>
            {canManage && (
              <button
                onClick={() => onCreateTip?.()}
                className={cn(
                  'px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm whitespace-nowrap text-white transition-all active:scale-[0.98]',
                  tPrimaryBtn,
                )}
              >
                <Plus className="w-4 h-4" />
                Nova dica
              </button>
            )}
          </div>

          {/* ── Filter Pills ── */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <div
              className={cn(
                'flex items-center gap-2 mr-2 pr-4 border-r',
                dark ? 'border-slate-700/50' : 'border-[rgba(0,0,0,0.1)]',
              )}
            >
              <Filter className={cn('w-3.5 h-3.5', tTextMuted)} />
              <button
                onClick={() => onTagChange('Todos')}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all hover:scale-[1.02]',
                  tag === 'Todos' ? tPillActive : tPillInactive,
                )}
              >
                Todos
              </button>
              <button
                onClick={onOnlyFavToggle}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-all hover:scale-[1.02]',
                  onlyFav ? tFavActive : tFavInactive,
                )}
              >
                <Star className="w-3.5 h-3.5" fill={onlyFav ? 'currentColor' : 'none'} />
                Favoritos
              </button>
            </div>
            {visibleTags.map((currentTag) => (
              <button
                key={currentTag}
                onClick={() => onTagChange(currentTag)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all hover:scale-[1.02]',
                  tag === currentTag ? tTagActive : tTagInactive,
                )}
              >
                {currentTag}
              </button>
            ))}
          </div>
        </div>

        {/* ── Empty State ── */}
        {filteredEntries.length === 0 && (
          <div
            className={cn(
              'border border-dashed rounded-xl p-12 text-center flex flex-col items-center',
              tBgSurface,
              tBorderLight,
            )}
          >
            <div
              className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center mb-4',
                tBgSubtle,
              )}
            >
              <AlignLeft className={cn('w-7 h-7', tTextMuted)} />
            </div>
            <h3 className={cn('text-base font-semibold mb-1', tTextPrimary)}>
              Nenhum procedimento encontrado
            </h3>
            <p className={cn('text-sm mb-6', tTextSecondary)}>
              Tente usar outros termos de pesquisa ou remova os filtros ativos.
            </p>
            <button
              onClick={clearFilters}
              className={cn(
                'text-sm font-medium',
                dark ? 'text-blue-300 hover:text-blue-200' : 'text-accent-DEFAULT hover:underline',
              )}
            >
              Limpar todos os filtros
            </button>
          </div>
        )}

        {/* ── Entry Cards ── */}
        <div className="space-y-4">
          {filteredEntries.map((entry) => {
            const favorite = favorites.includes(entry.id);
            return (
              <div
                key={String(entry.id)}
                className={cn(
                  'border rounded-xl p-5 transition-all duration-200',
                  tBgSurface,
                  tBorder,
                  tShadow,
                )}
              >
                {/* Header row */}
                <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                  <div className="min-w-0 flex-1">
                    <h2 className={cn('text-base font-bold mb-2', tTextPrimary)}>{entry.title}</h2>
                    <div
                      className={cn('flex flex-wrap items-center gap-2 text-2xs', tTextSecondary)}
                    >
                      {entry.tags.map((currentTag, idx) => (
                        <span
                          key={`${entry.id}-${currentTag}-${idx}`}
                          className={cn(
                            'px-2 py-0.5 rounded-full font-medium border',
                            tBgSubtle,
                            tBorderLight,
                          )}
                        >
                          {currentTag}
                        </span>
                      ))}
                      <span className="ml-1">
                        · Por {entry.author} em {entry.date}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {canManage && (
                      <>
                        <button
                          onClick={() => onEditEntry?.(entry)}
                          className={cn(
                            'px-3 py-1.5 text-2xs font-medium rounded-md transition-colors flex items-center gap-1.5 active:scale-95',
                            tEditBtn,
                          )}
                        >
                          <Edit2 className="w-3 h-3" /> Editar
                        </button>
                        <button
                          onClick={() => onDeleteEntry?.(entry)}
                          disabled={deletingId === entry.id}
                          className={cn(
                            'px-3 py-1.5 text-2xs font-medium rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 active:scale-95',
                            tDeleteBtn,
                          )}
                        >
                          <Trash2 className="w-3 h-3" />{' '}
                          {deletingId === entry.id ? 'Apagando...' : 'Apagar'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onToggleFavorite(entry.id)}
                      className={cn(
                        'px-3 py-1.5 text-2xs font-medium rounded-md border transition-colors flex items-center gap-1.5 active:scale-95',
                        favorite ? tFavActive : `${tFavInactive} hover:bg-bg-hover`,
                      )}
                    >
                      <Star className="w-3 h-3" fill={favorite ? 'currentColor' : 'none'} />
                      {favorite ? 'Favorito' : 'Favoritar'}
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className={cn('text-sm mb-3 leading-relaxed', tTextSecondary)}>
                  {entry.description}
                </p>

                {/* Code Block */}
                <div className="relative rounded-lg overflow-hidden border border-[#09090b] ring-1 ring-[rgba(255,255,255,0.04)]">
                  <div className="bg-[#09090b] border-b border-[rgba(255,255,255,0.08)] px-4 py-2 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[rgba(255,255,255,0.15)]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[rgba(255,255,255,0.15)]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[rgba(255,255,255,0.15)]" />
                    </div>
                    <button
                      onClick={() => handleCopy(entry.id, entry.command)}
                      className="flex items-center gap-1.5 text-[rgba(255,255,255,0.5)] hover:text-white transition-colors text-xs font-medium"
                    >
                      {copiedId === entry.id ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" />{' '}
                          <span className="text-green-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copiar
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="bg-[#09090b] text-[rgba(255,255,255,0.85)] p-4 text-sm font-mono overflow-y-auto max-h-[300px] leading-relaxed">
                    <code className="block whitespace-pre-wrap">{entry.command}</code>
                  </pre>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
