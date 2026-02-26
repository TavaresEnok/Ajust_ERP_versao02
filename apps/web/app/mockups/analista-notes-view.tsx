'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, StickyNote } from 'lucide-react';

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

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
  new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const readApiErrorMessage = async (response: Response, fallbackMessage: string): Promise<string> => {
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

export function AnalystNotesView({ dark, onToast }: AnalystNotesViewProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const mapApiNote = (note: Record<string, unknown>): NoteItem => ({
    id: String(note.id),
    title: String(note.title || 'Sem titulo'),
    content: String(note.content || ''),
    pinned: !!note.pinned,
    createdAt: parseDateToTs(typeof note.createdAt === 'string' ? note.createdAt : undefined),
    updatedAt: parseDateToTs(typeof note.updatedAt === 'string' ? note.updatedAt : undefined)
  });

  const loadNotes = async (options: { silent?: boolean } = {}) => {
    const silent = !!options.silent;
    if (!silent) {
      setSyncing(true);
      setSyncError('');
    }
    try {
      const response = await fetch('/api/knowledge/notes', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Falha ao carregar notas.'));
      }
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
    return notes.filter((n) => !q || `${n.title} ${n.content}`.toLowerCase().includes(q));
  }, [notes, search]);

  const addNote = () => {
    (async () => {
      try {
        const response = await fetch('/api/knowledge/notes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'Sem titulo', content: '' })
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao criar nota.'));
        }
        const payload = await response.json();
        const created = mapApiNote(payload);
        setNotes((prev) => [created, ...prev]);
        setSelectedId(created.id);
      } catch (error) {
        onToast(error instanceof Error ? error.message : 'Falha ao criar nota.');
      }
    })();
  };

  const removeNote = (id: string) => {
    (async () => {
      try {
        const response = await fetch(`/api/knowledge/notes/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Falha ao remover nota.'));
        }
        setNotes((prev) => {
          const remaining = prev.filter((n) => n.id !== id);
          if (selectedId === id) {
            setSelectedId(remaining[0]?.id || null);
          }
          return remaining;
        });
        onToast('Nota removida.');
      } catch (error) {
        onToast(error instanceof Error ? error.message : 'Falha ao remover nota.');
      }
    })();
  };

  const persistNote = async (note: NoteItem | null) => {
    if (!note) return;
    setSavingNoteId(note.id);
    try {
      const response = await fetch(`/api/knowledge/notes/${encodeURIComponent(note.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: note.content,
          pinned: note.pinned
        })
      });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Falha ao salvar nota.'));
      }
      const payload = await response.json();
      const updated = mapApiNote(payload);
      setNotes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Falha ao salvar nota.');
    } finally {
      setSavingNoteId((prev) => (prev === note.id ? null : prev));
    }
  };

  const updateSelected = (field: 'title' | 'content', value: string) => {
    if (!selected) return;
    setNotes((prev) => prev.map((n) => (n.id === selected.id ? { ...n, [field]: value } : n)));
  };

  return (
    <div className={cn('h-[calc(100vh-10rem)] border rounded-xl overflow-hidden shadow-sm flex', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200')}>
      <aside className={cn('w-80 border-r hidden md:flex flex-col', dark ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50' : 'bg-slate-50 border-slate-200')}>
        <div className={cn('p-4 border-b', dark ? 'border-slate-700/50' : 'border-slate-200')}>
          <div className="flex items-center justify-between">
            <h3 className={cn('font-bold flex items-center gap-2', dark ? 'text-slate-100' : 'text-slate-800')}>
              <StickyNote size={16} className="text-blue-600" />
              Notas
            </h3>
            <button onClick={addNote} disabled={syncing} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Plus size={14} />
            </button>
          </div>

          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nota..." className={cn('w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors outline-none focus:border-blue-500', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50 text-slate-200' : 'bg-white border-slate-300 text-slate-900')} />
          </div>
          {syncing && <div className="text-xs text-slate-500 mt-2">Sincronizando notas...</div>}
          {!syncing && syncError && <div className="text-xs text-amber-700 mt-2">{syncError}</div>}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {filtered.map((n) => (
            <div key={n.id} className={cn('p-3 rounded-lg border cursor-pointer group transition-colors', selectedId === n.id ? (dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-blue-500/50 shadow-sm' : 'bg-white border-blue-200 shadow-sm') : (dark ? 'bg-[#1e293b]/60 backdrop-blur-md/50 border-slate-700/50 hover:bg-[#1e293b]/60 backdrop-blur-md' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'))}>
              <div onClick={() => setSelectedId(n.id)}>
                <div className={cn('font-semibold text-sm truncate', dark ? 'text-slate-200' : 'text-slate-800')}>{n.title}</div>
                <div className="text-xs text-slate-500 truncate mt-1">{n.content || 'Sem conteudo'}</div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">{formatDate(n.updatedAt || n.createdAt)}</span>
                <button onClick={() => removeNote(n.id)} className="text-[10px] text-rose-600 opacity-0 group-hover:opacity-100">
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 p-6">
        {selected ? (
          <div className="h-full flex flex-col">
            <input
              value={selected.title}
              onChange={(e) => updateSelected('title', e.target.value)}
              onBlur={() => persistNote(selected)}
              className={cn('text-3xl font-bold border-none outline-none bg-transparent', dark ? 'text-slate-100 placeholder-slate-700' : 'text-slate-800 placeholder-slate-300')}
            />
            <div className="text-xs text-slate-400 mt-1">
              {savingNoteId === selected.id ? 'Salvando...' : 'Salvamento no backend ao sair do campo.'}
            </div>
            <textarea
              value={selected.content}
              onChange={(e) => updateSelected('content', e.target.value)}
              onBlur={() => persistNote(selected)}
              className={cn('mt-4 flex-1 resize-none border rounded-lg p-4 text-sm outline-none focus:border-blue-500 transition-colors', dark ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50 text-slate-300' : 'bg-white border-slate-200 text-slate-700')}
              placeholder="Digite sua nota..."
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">Selecione ou crie uma nota.</div>
        )}
      </div>
    </div>
  );
}
