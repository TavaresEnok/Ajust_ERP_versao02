'use client';
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pin,
  PinOff,
  Plus,
  Search,
  StickyNote,
  Trash2,
  Loader2,
  CheckCircle2,
  FileText,
} from 'lucide-react';

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

type NoteItem = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

type AnalystNotesViewProps = {
  dark: boolean;
  onToast: (message: string) => void;
};

const parseDateToTs = (ts?: string): number => {
  if (!ts) return Date.now();
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const formatDate = (ts: number): string =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));

const readApiErrorMessage = async (
  response: Response,
  fallbackMessage: string,
): Promise<string> => {
  try {
    const payload = await response.json();
    const message = payload?.message || payload?.error || payload?.details;
    if (!message) return fallbackMessage;
    if (Array.isArray(message)) return message.join(', ');
    return String(message);
  } catch {
    return fallbackMessage;
  }
};

const DEBOUNCE_MS = 1500;

export function AnalystNotesView({ dark, onToast }: AnalystNotesViewProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapApiNote = (note: Record<string, unknown>): NoteItem => ({
    id: String(note.id),
    title: String(note.title || 'Sem titulo'),
    content: String(note.content || ''),
    pinned: !!note.pinned,
    createdAt: parseDateToTs(typeof note.createdAt === 'string' ? note.createdAt : undefined),
    updatedAt: parseDateToTs(typeof note.updatedAt === 'string' ? note.updatedAt : undefined),
  });

  const loadNotes = async (options: { silent?: boolean } = {}) => {
    const silent = !!options.silent;
    if (!silent) {
      setSyncing(true);
      setSyncError('');
    }
    try {
      const response = await fetch('/api/knowledge/notes', { cache: 'no-store' });
      if (!response.ok)
        throw new Error(await readApiErrorMessage(response, 'Falha ao carregar notas.'));
      const payload = await response.json();
      const mapped = Array.isArray(payload) ? payload.map((item) => mapApiNote(item)) : [];
      setNotes(mapped);
      setSelectedId((prev) => {
        if (prev && mapped.some((n) => n.id === prev)) return prev;
        return mapped[0]?.id || null;
      });
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Falha ao carregar notas.');
      setNotes([]);
      setSelectedId(null);
    } finally {
      if (!silent) setSyncing(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const selected = notes.find((n) => n.id === selectedId) || null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const sorted = [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });
    return sorted.filter((n) => !q || `${n.title} ${n.content}`.toLowerCase().includes(q));
  }, [notes, search]);

  const persistNoteImmediate = useCallback(
    async (note: NoteItem) => {
      setSaveStatus('saving');
      try {
        const response = await fetch(`/api/knowledge/notes/${encodeURIComponent(note.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: note.title, content: note.content, pinned: note.pinned }),
        });
        if (!response.ok)
          throw new Error(await readApiErrorMessage(response, 'Falha ao salvar nota.'));
        const payload = await response.json();
        const updated = mapApiNote(payload);
        setNotes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
      } catch (error) {
        setSaveStatus('idle');
        onToast(error instanceof Error ? error.message : 'Falha ao salvar nota.');
      }
    },
    [onToast],
  );

  const updateSelected = (field: 'title' | 'content', value: string) => {
    if (!selected) return;
    const updated = { ...selected, [field]: value };
    setNotes((prev) => prev.map((n) => (n.id === selected.id ? updated : n)));
    setSaveStatus('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistNoteImmediate(updated), DEBOUNCE_MS);
  };

  const togglePin = (note: NoteItem) => {
    const updated = { ...note, pinned: !note.pinned };
    setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)));
    persistNoteImmediate(updated);
  };

  const addNote = async () => {
    try {
      const response = await fetch('/api/knowledge/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Nova Nota', content: '' }),
      });
      if (!response.ok)
        throw new Error(await readApiErrorMessage(response, 'Falha ao criar nota.'));
      const payload = await response.json();
      const created = mapApiNote(payload);
      setNotes((prev) => [created, ...prev]);
      setSelectedId(created.id);
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao criar nota.');
    }
  };

  const removeNote = async (id: string) => {
    try {
      const response = await fetch(`/api/knowledge/notes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!response.ok)
        throw new Error(await readApiErrorMessage(response, 'Falha ao remover nota.'));
      setNotes((prev) => {
        const remaining = prev.filter((n) => n.id !== id);
        if (selectedId === id) setSelectedId(remaining[0]?.id || null);
        return remaining;
      });
      onToast('Nota removida.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao remover nota.');
    }
  };

  // Flush debounced save on unmount
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return (
    <div
      className={cn(
        'flex h-[calc(100vh-7rem)] -m-6 rounded-xl border overflow-hidden',
        dark
          ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
          : 'bg-bg-surface border-[rgba(0,0,0,0.06)]',
      )}
    >
      {/* Sidebar */}
      <aside
        className={cn(
          'w-[320px] border-r hidden md:flex flex-col shrink-0',
          dark
            ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50'
            : 'bg-bg-subtle/40 border-[rgba(0,0,0,0.06)]',
        )}
      >
        <div className="p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h1
              className={cn(
                'text-sm font-semibold tracking-wide uppercase flex items-center gap-2',
                dark ? 'text-slate-300' : 'text-content-tertiary',
              )}
            >
              Minhas Notas
            </h1>
            <button
              onClick={addNote}
              disabled={syncing}
              className={cn(
                'p-1.5 rounded-md transition-all disabled:opacity-50',
                dark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  : 'text-content-tertiary hover:text-content-primary hover:bg-bg-hover',
              )}
              title="Nova nota"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="relative group">
            <Search
              size={14}
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 transition-colors',
                dark
                  ? 'text-slate-500 group-focus-within:text-slate-300'
                  : 'text-content-tertiary group-focus-within:text-content-secondary',
              )}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar notas..."
              className={cn(
                'w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none transition-all',
                dark
                  ? 'bg-[#1e293b]/60 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:bg-[#111827] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20'
                  : 'bg-bg-subtle border border-transparent text-content-primary placeholder:text-content-tertiary focus:bg-bg-surface focus:border-accent-DEFAULT focus:ring-4 focus:ring-accent-subtle',
              )}
            />
          </div>
          {syncing && (
            <div className={cn('text-xs', dark ? 'text-slate-500' : 'text-content-tertiary')}>
              Carregando...
            </div>
          )}
          {!syncing && syncError && <div className="text-xs text-amber-500">{syncError}</div>}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4 space-y-1">
          {filtered.length === 0 && !syncing && (
            <div
              className={cn(
                'pt-10 text-center text-sm flex flex-col items-center gap-3',
                dark ? 'text-slate-500' : 'text-content-tertiary',
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  dark ? 'bg-[#1e293b]' : 'bg-bg-subtle',
                )}
              >
                <Search
                  className={cn('w-4 h-4', dark ? 'text-slate-500' : 'text-content-tertiary')}
                />
              </div>
              <p>{search ? 'Nenhuma nota encontrada.' : 'Nenhuma nota encontrada.'}</p>
            </div>
          )}
          {filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => setSelectedId(n.id)}
              className={cn(
                'group relative p-3.5 rounded-xl cursor-pointer transition-all border',
                selectedId === n.id
                  ? dark
                    ? 'bg-[#111827] border-slate-600/70 shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                    : 'bg-bg-surface border-[rgba(0,0,0,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                  : dark
                    ? 'border-transparent hover:bg-white/5'
                    : 'border-transparent hover:bg-bg-hover/60',
              )}
            >
              <div className="flex justify-between items-start mb-1.5 gap-2">
                <h3
                  className={cn(
                    'text-sm font-medium truncate',
                    selectedId === n.id
                      ? dark
                        ? 'text-slate-100'
                        : 'text-content-primary'
                      : dark
                        ? 'text-slate-300'
                        : 'text-content-secondary',
                  )}
                >
                  {n.title || 'Nova Nota'}
                </h3>
                <div
                  className={cn(
                    'flex items-center gap-0.5 transition-opacity duration-200',
                    selectedId === n.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                  )}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(n);
                    }}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      n.pinned
                        ? dark
                          ? 'text-slate-100'
                          : 'text-content-primary'
                        : dark
                          ? 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                          : 'text-content-tertiary hover:text-content-primary hover:bg-bg-hover',
                    )}
                    title={n.pinned ? 'Desafixar' : 'Fixar'}
                  >
                    <Pin size={14} fill={n.pinned ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNote(n.id);
                    }}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      dark
                        ? 'text-slate-500 hover:text-rose-300 hover:bg-rose-500/10'
                        : 'text-content-tertiary hover:text-red-600 hover:bg-red-50',
                    )}
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {n.pinned && selectedId !== n.id && (
                  <Pin
                    className={cn(
                      'w-3 h-3 absolute top-4 right-4 group-hover:hidden',
                      dark ? 'text-slate-500' : 'text-content-tertiary',
                    )}
                    fill="currentColor"
                  />
                )}
              </div>
              <p
                className={cn(
                  'text-xs line-clamp-2 leading-relaxed mb-3',
                  dark ? 'text-slate-400' : 'text-content-tertiary',
                )}
              >
                {n.content || 'Sem conteudo adicional'}
              </p>
              <div
                className={cn(
                  'flex items-center text-[11px] font-medium',
                  dark ? 'text-slate-500' : 'text-content-tertiary',
                )}
              >
                {formatDate(n.updatedAt || n.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Editor */}
      <main
        className={cn(
          'flex-1 flex flex-col relative min-h-0 overflow-hidden',
          dark ? 'bg-[#111827]' : 'bg-bg-surface',
        )}
      >
        {selected ? (
          <>
            <header
              className={cn(
                'h-14 flex items-center justify-between px-8 shrink-0 w-full max-w-4xl mx-auto border-b',
                dark ? 'border-slate-700/40' : 'border-[rgba(0,0,0,0.04)]',
              )}
            >
              <div className="flex items-center text-xs font-medium">
                {saveStatus === 'saving' ? (
                  <div
                    className={cn(
                      'flex items-center',
                      dark ? 'text-slate-400' : 'text-content-tertiary',
                    )}
                  >
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Salvando alteracoes...
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex items-center transition-opacity duration-500',
                      dark ? 'text-slate-400' : 'text-content-tertiary',
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                    Salvo
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => togglePin(selected)}
                  className={cn(
                    'p-2 rounded-lg flex items-center gap-2 text-sm transition-colors',
                    selected.pinned
                      ? dark
                        ? 'text-slate-100 bg-white/10'
                        : 'text-content-primary bg-bg-hover'
                      : dark
                        ? 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                        : 'text-content-tertiary hover:bg-bg-hover hover:text-content-primary',
                  )}
                  title={selected.pinned ? 'Desafixar' : 'Fixar'}
                >
                  <Pin size={16} fill={selected.pinned ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => removeNote(selected.id)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    dark
                      ? 'text-slate-500 hover:bg-rose-500/10 hover:text-rose-300'
                      : 'text-content-tertiary hover:bg-red-50 hover:text-red-600',
                  )}
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto flex flex-col max-w-4xl mx-auto w-full px-8 pb-16 pt-6">
              <input
                value={selected.title}
                onChange={(e) => updateSelected('title', e.target.value)}
                className={cn(
                  'text-2xl font-semibold tracking-tight border-none outline-none bg-transparent mb-6 w-full',
                  dark
                    ? 'text-slate-100 placeholder-slate-500'
                    : 'text-content-primary placeholder:text-content-tertiary',
                )}
                placeholder="Título da nota"
              />
              <textarea
                value={selected.content}
                onChange={(e) => updateSelected('content', e.target.value)}
                className={cn(
                  'flex-1 w-full text-sm border-none outline-none bg-transparent resize-none leading-relaxed',
                  dark
                    ? 'text-slate-300 placeholder-slate-600'
                    : 'text-content-secondary placeholder:text-content-tertiary',
                )}
                placeholder="Comece a escrever..."
              />
            </div>
          </>
        ) : (
          <div
            className={cn(
              'flex-1 flex flex-col items-center justify-center',
              dark ? 'text-slate-500' : 'text-content-tertiary',
            )}
          >
            <div
              className={cn(
                'w-16 h-16 rounded-2xl border flex items-center justify-center mb-6 shadow-sm',
                dark ? 'bg-[#1e293b] border-slate-700' : 'bg-bg-subtle border-[rgba(0,0,0,0.04)]',
              )}
            >
              <FileText
                className={cn('w-8 h-8', dark ? 'text-slate-500' : 'text-content-tertiary')}
              />
            </div>
            <h2
              className={cn(
                'text-lg font-medium mb-2',
                dark ? 'text-slate-200' : 'text-content-primary',
              )}
            >
              Selecione uma nota
            </h2>
            <p
              className={cn(
                'text-sm max-w-[260px] text-center mb-8',
                dark ? 'text-slate-400' : 'text-content-secondary',
              )}
            >
              Escolha uma nota na barra lateral ou crie uma nova para começar a escrever.
            </p>
            <button
              onClick={addNote}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-all shadow-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Nova Nota
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
