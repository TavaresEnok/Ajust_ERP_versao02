'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pin, PinOff, Plus, Search, StickyNote } from 'lucide-react';

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
    updatedAt: parseDateToTs(typeof note.updatedAt === 'string' ? note.updatedAt : undefined)
  });

  const loadNotes = async (options: { silent?: boolean } = {}) => {
    const silent = !!options.silent;
    if (!silent) { setSyncing(true); setSyncError(''); }
    try {
      const response = await fetch('/api/knowledge/notes', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Falha ao carregar notas.'));
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

  useEffect(() => { loadNotes(); }, []);

  const selected = notes.find((n) => n.id === selectedId) || null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const sorted = [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });
    return sorted.filter((n) => !q || `${n.title} ${n.content}`.toLowerCase().includes(q));
  }, [notes, search]);

  const persistNoteImmediate = useCallback(async (note: NoteItem) => {
    setSaveStatus('saving');
    try {
      const response = await fetch(`/api/knowledge/notes/${encodeURIComponent(note.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: note.title, content: note.content, pinned: note.pinned })
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Falha ao salvar nota.'));
      const payload = await response.json();
      const updated = mapApiNote(payload);
      setNotes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (error) {
      setSaveStatus('idle');
      onToast(error instanceof Error ? error.message : 'Falha ao salvar nota.');
    }
  }, [onToast]); // eslint-disable-line react-hooks/exhaustive-deps

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
        body: JSON.stringify({ title: 'Nova Nota', content: '' })
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Falha ao criar nota.'));
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
      const response = await fetch(`/api/knowledge/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Falha ao remover nota.'));
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
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <div className={cn('h-[calc(100vh-10rem)] border rounded-xl overflow-hidden shadow-sm flex', dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200')}>
      {/* Sidebar */}
      <aside className={cn('w-72 border-r hidden md:flex flex-col shrink-0', dark ? 'bg-[#0f172a]/80 backdrop-blur-xl border-slate-700/50' : 'bg-slate-50 border-slate-200')}>
        <div className={cn('p-4 border-b', dark ? 'border-slate-700/50' : 'border-slate-200')}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={cn('font-bold flex items-center gap-2', dark ? 'text-slate-100' : 'text-slate-800')}>
              <StickyNote size={16} className="text-blue-500" />
              Notas
              <span className={cn('text-[10px] font-normal px-1.5 py-0.5 rounded-full border', dark ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400')}>{notes.length}</span>
            </h3>
            <button
              onClick={addNote}
              disabled={syncing}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              title="Nova nota"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nota..."
              className={cn('w-full pl-9 pr-3 py-2 border rounded-lg text-sm transition-colors outline-none focus:border-blue-500', dark ? 'bg-[#1e293b]/60 border-slate-700/50 text-slate-200 placeholder-slate-600' : 'bg-white border-slate-300 text-slate-900')}
            />
          </div>
          {syncing && <div className="text-xs text-slate-500 mt-2">Carregando...</div>}
          {!syncing && syncError && <div className="text-xs text-amber-500 mt-2">{syncError}</div>}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {filtered.length === 0 && !syncing && (
            <div className="text-xs text-slate-500 text-center py-8">
              {search ? 'Nenhuma nota encontrada.' : 'Crie sua primeira nota →'}
            </div>
          )}
          {filtered.map((n) => (
            <div
              key={n.id}
              className={cn(
                'p-3 rounded-lg border cursor-pointer group transition-all relative',
                selectedId === n.id
                  ? (dark ? 'bg-blue-900/30 border-blue-500/50' : 'bg-blue-50 border-blue-200')
                  : (dark ? 'border-transparent hover:bg-white/5' : 'border-transparent hover:bg-slate-100')
              )}
            >
              <div onClick={() => setSelectedId(n.id)}>
                <div className={cn('font-semibold text-sm truncate flex items-center gap-1.5', dark ? 'text-slate-200' : 'text-slate-800')}>
                  {n.pinned && <Pin size={10} className="text-amber-400 shrink-0" />}
                  {n.title || 'Sem título'}
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">{n.content || 'Sem conteúdo'}</div>
                <div className="text-[10px] text-slate-500 mt-1">{formatDate(n.updatedAt || n.createdAt)}</div>
              </div>
              <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); togglePin(n); }}
                  className={cn('p-1 rounded', dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500')}
                  title={n.pinned ? 'Desafixar' : 'Fixar'}
                >
                  {n.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeNote(n.id); }}
                  className="p-1 rounded text-rose-400 hover:bg-rose-500/10"
                  title="Remover nota"
                >
                  <span className="text-[11px]">✕</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Editor */}
      <div className="flex-1 flex flex-col p-6 min-h-0 overflow-hidden">
        {selected ? (
          <>
            <input
              value={selected.title}
              onChange={(e) => updateSelected('title', e.target.value)}
              className={cn('text-3xl font-bold border-none outline-none bg-transparent mb-1 w-full', dark ? 'text-slate-100 placeholder-slate-700' : 'text-slate-800 placeholder-slate-300')}
              placeholder="Título da nota"
            />
            <div className="flex items-center gap-2 mb-4 text-xs flex-wrap">
              {saveStatus === 'saving' && <span className="text-slate-400">Salvando...</span>}
              {saveStatus === 'saved' && <span className="text-emerald-500">✓ Salvo</span>}
              {saveStatus === 'idle' && <span className="text-slate-500">Salvo automaticamente</span>}
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">{formatDate(selected.updatedAt || selected.createdAt)}</span>
              <button
                onClick={() => togglePin(selected)}
                className={cn('flex items-center gap-1 px-2 py-0.5 rounded border transition-colors', selected.pinned
                  ? (dark ? 'border-amber-500/40 bg-amber-500/10 text-amber-400' : 'border-amber-300 bg-amber-50 text-amber-700')
                  : (dark ? 'border-slate-700 text-slate-500 hover:border-slate-600' : 'border-slate-200 text-slate-400 hover:border-slate-300')
                )}
              >
                {selected.pinned ? <><PinOff size={10} /> Desafixar</> : <><Pin size={10} /> Fixar</>}
              </button>
            </div>
            <textarea
              value={selected.content}
              onChange={(e) => updateSelected('content', e.target.value)}
              className={cn('flex-1 resize-none border rounded-xl p-4 text-sm outline-none focus:border-blue-500 transition-colors', dark ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-300 placeholder-slate-600' : 'bg-white border-slate-200 text-slate-700')}
              placeholder="Comece a escrever sua nota aqui..."
            />
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
            <StickyNote size={40} className="opacity-30" />
            <p className="text-sm">Selecione ou crie uma nota para começar.</p>
            <button onClick={addNote} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
              <Plus size={16} /> Nova Nota
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
