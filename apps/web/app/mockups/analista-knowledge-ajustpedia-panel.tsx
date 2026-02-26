'use client';

import React from 'react';
import { ChevronDown, ChevronUp, Copy } from 'lucide-react';

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

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
  author: string;
  tag: string;
  onlyFav: boolean;
  canManage?: boolean;
  authors: string[];
  tags: string[];
  recent: Array<string | number>;
  entries: AdjustPediaEntry[];
  filteredEntries: AdjustPediaEntry[];
  expandedId: string | number | null;
  favorites: Array<string | number>;
  deletingId?: string | number | null;
  onAuthorChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onOnlyFavToggle: () => void;
  onExpand: (value: string | number | null) => void;
  onTouchRecent: (id: string | number) => void;
  onToggleFavorite: (id: string | number) => void;
  onCopyText: (value: string) => void;
  onEditEntry?: (entry: AdjustPediaEntry) => void;
  onDeleteEntry?: (entry: AdjustPediaEntry) => void;
};

export function AnalystKnowledgeAjustpediaPanel({
  dark,
  author,
  tag,
  onlyFav,
  canManage = false,
  authors,
  tags,
  recent,
  entries,
  filteredEntries,
  expandedId,
  favorites,
  deletingId = null,
  onAuthorChange,
  onTagChange,
  onOnlyFavToggle,
  onExpand,
  onTouchRecent,
  onToggleFavorite,
  onCopyText,
  onEditEntry,
  onDeleteEntry
}: AnalystKnowledgeAjustpediaPanelProps) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <select value={author} onChange={(e) => onAuthorChange(e.target.value)} className={cn('px-3 py-1.5 border rounded-lg text-xs', dark ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-300' : 'bg-white border-slate-300')}>
          {authors.map((item) => <option key={item}>{item}</option>)}
        </select>
        {tags.map((item) => (
          <button
            key={item}
            onClick={() => onTagChange(item)}
            className={cn(
              'px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
              tag === item
                ? (dark ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700')
                : (dark ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-400 hover:bg-white/5' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')
            )}
          >
            {item}
          </button>
        ))}
        <button
          onClick={onOnlyFavToggle}
          className={cn(
            'px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
            onlyFav
              ? (dark ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700')
              : (dark ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-400 hover:bg-white/5' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')
          )}
        >
          Favoritos
        </button>
      </div>

      {recent.length > 0 && (
        <div className={cn('border rounded-xl p-3', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200')}>
          <div className={cn('text-xs uppercase font-bold mb-2', dark ? 'text-slate-500' : 'text-slate-400')}>Recentes</div>
          <div className="flex flex-wrap gap-2">
            {recent.map((id) => {
              const entry = entries.find((item) => item.id === id);
              if (!entry) return null;
              return (
                <button key={String(id)} onClick={() => onExpand(id)} className={cn('px-2 py-1 text-xs border rounded hover:opacity-80', dark ? 'border-slate-700/50 bg-[#0f172a]/80 backdrop-blur-xl text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700')}>
                  {entry.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filteredEntries.map((entry) => {
          const expanded = expandedId === entry.id;
          const fav = favorites.includes(entry.id);
          return (
            <div key={String(entry.id)} className={cn('border rounded-xl shadow-sm overflow-hidden', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200')}>
              <div className="px-4 py-4 flex items-start justify-between gap-3">
                <button
                  onClick={() => {
                    onExpand(expanded ? null : entry.id);
                    onTouchRecent(entry.id);
                  }}
                  className="text-left flex-1"
                >
                  <h3 className={cn('font-bold', dark ? 'text-slate-200' : 'text-slate-800')}>{entry.title}</h3>
                  <div className={cn('mt-1 flex flex-wrap gap-2 text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
                    {entry.tags.map((tg) => (
                      <span key={tg} className={cn('px-2 py-0.5 rounded-full border', dark ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-400' : 'bg-slate-100 border-slate-200')}>
                        {tg}
                      </span>
                    ))}
                    <span>• Por {entry.author} em {entry.date}</span>
                  </div>
                </button>

                <div className="flex items-center gap-1">
                  {canManage && (
                    <>
                      <button
                        onClick={() => onEditEntry?.(entry)}
                        className={cn(
                          'px-2 py-1 text-xs border rounded transition-colors',
                          dark
                            ? 'border-indigo-700/50 bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/50'
                            : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        )}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => onDeleteEntry?.(entry)}
                        disabled={deletingId === entry.id}
                        className={cn(
                          'px-2 py-1 text-xs border rounded transition-colors disabled:opacity-50',
                          dark
                            ? 'border-rose-700/50 bg-rose-900/30 text-rose-300 hover:bg-rose-900/50'
                            : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        )}
                      >
                        {deletingId === entry.id ? 'Apagando...' : 'Apagar'}
                      </button>
                    </>
                  )}
                  <button onClick={() => onToggleFavorite(entry.id)} className={cn('px-2 py-1 text-xs border rounded transition-colors', dark ? 'border-slate-700/50 hover:bg-white/5 text-slate-400' : 'hover:bg-slate-50 text-slate-600')}>
                    {fav ? 'Desfavoritar' : 'Favoritar'}
                  </button>
                  <button onClick={() => onExpand(expanded ? null : entry.id)} className={cn('p-1 rounded transition-colors', dark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500')}>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {expanded && (
                <div className={cn('px-4 pb-4 border-t', dark ? 'border-slate-700/50' : 'border-slate-100')}>
                  <p className={cn('text-sm mt-3 mb-3', dark ? 'text-slate-400' : 'text-slate-600')}>{entry.description}</p>
                  <div className="relative">
                    <button onClick={() => onCopyText(entry.command)} className="absolute right-2 top-2 px-2 py-1 bg-slate-800 text-slate-100 rounded text-xs flex items-center gap-1">
                      <Copy size={11} />
                      Copiar
                    </button>
                    <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto border border-slate-800">
                      <code>{entry.command}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredEntries.length === 0 && (
          <div className={cn('border rounded-xl p-10 text-center text-sm', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50 text-slate-400' : 'bg-white border-slate-200 text-slate-400')}>
            Nenhum artigo encontrado.
          </div>
        )}
      </div>
    </>
  );
}
