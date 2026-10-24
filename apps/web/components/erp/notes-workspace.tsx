'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCheck,
  FileText,
  Loader2,
  Pin,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { errorMessage } from '@/lib/erp/contracts';
import { cn } from '@/lib/utils';
import { PageHeading } from './primitives';
import { QueryState } from './contract-form';

type Note = { id: string; title: string; content: string; pinned: boolean; updatedAt: string };
type Draft = { title: string; content: string; revision: number };
const date = (value?: string) =>
  value
    ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Agora';

export function NotesPage() {
  const { transport } = useErp();
  const query = useErpQuery<Note[]>('/knowledge/notes');
  const mutate = query.mutate;
  const action = useErpAction();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const draftRef = useRef<Record<string, Draft>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const queues = useRef<Record<string, Promise<void>>>({});
  const sequence = useRef(0);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteNote, setDeleteNote] = useState<Note | null>(null);
  const [onlyPinned, setOnlyPinned] = useState(false);

  const save = useCallback(
    async (id: string) => {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
      const snapshot = draftRef.current[id];
      if (!snapshot || !transport) return;
      const previous = queues.current[id] || Promise.resolve();
      const job = previous.then(async () => {
        setSaving((state) => ({ ...state, [id]: true }));
        try {
          const saved = await transport.request<Note>({
            path: `/knowledge/notes/${encodeURIComponent(id)}`,
            method: 'PATCH',
            body: { title: snapshot.title.trim() || 'Sem título', content: snapshot.content },
          });
          await mutate(
            (current) => (current || []).map((note) => (note.id === id ? saved : note)),
            { revalidate: false },
          );
          if (draftRef.current[id]?.revision === snapshot.revision) {
            const next = { ...draftRef.current };
            delete next[id];
            draftRef.current = next;
            setDrafts(next);
          }
          setErrors((state) => ({ ...state, [id]: '' }));
        } catch (error) {
          setErrors((state) => ({ ...state, [id]: errorMessage(error) }));
        } finally {
          setSaving((state) => ({ ...state, [id]: false }));
        }
      });
      queues.current[id] = job;
      await job;
      if (queues.current[id] === job) delete queues.current[id];
    },
    [mutate, transport],
  );
  useEffect(() => {
    const scheduled = timers.current;
    const warn = (event: BeforeUnloadEvent) => {
      if (Object.keys(draftRef.current).length) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      for (const id of Object.keys(scheduled)) {
        clearTimeout(scheduled[id]);
        void save(id);
      }
    };
  }, [save]);
  const notes = useMemo(
    () =>
      (query.data || [])
        .map((note) => ({ ...note, ...(drafts[note.id] || {}) }))
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        ),
    [query.data, drafts],
  );
  const filtered = notes.filter(
    (note) =>
      (!onlyPinned || note.pinned) &&
      `${note.title} ${note.content}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.trim().toLocaleLowerCase('pt-BR')),
  );
  const selected =
    notes.find((note) => note.id === selectedId) || (!selectedId ? filtered[0] : undefined);
  function edit(field: 'title' | 'content', value: string) {
    if (!selected) return;
    const current = draftRef.current[selected.id] || {
      title: selected.title,
      content: selected.content,
      revision: 0,
    };
    const draft = {
      ...current,
      [field]: value,
      revision: ++sequence.current,
    };
    draftRef.current = { ...draftRef.current, [selected.id]: draft };
    setDrafts(draftRef.current);
    clearTimeout(timers.current[selected.id]);
    const id = selected.id;
    timers.current[id] = setTimeout(() => void save(id), 1000);
  }
  async function create() {
    try {
      const created = await action.execute<Note>({
        path: '/knowledge/notes',
        method: 'POST',
        body: { title: 'Nova nota', content: '' },
      });
      await mutate((current) => [created, ...(current || [])], { revalidate: false });
      setSearch('');
      setOnlyPinned(false);
      setSelectedId(created.id);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  async function togglePin(note: Note) {
    try {
      const saved = await action.execute<Note>({
        path: `/knowledge/notes/${encodeURIComponent(note.id)}`,
        method: 'PATCH',
        body: { pinned: !note.pinned },
      });
      await mutate(
        (current) => (current || []).map((item) => (item.id === note.id ? saved : item)),
        { revalidate: false },
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  async function remove() {
    if (!deleteNote) return;
    const id = deleteNote.id;
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    await queues.current[id];
    try {
      await action.execute({
        path: `/knowledge/notes/${encodeURIComponent(id)}`,
        method: 'DELETE',
      });
      const next = { ...draftRef.current };
      delete next[id];
      draftRef.current = next;
      setDrafts(next);
      await mutate((current) => (current || []).filter((note) => note.id !== id), {
        revalidate: false,
      });
      if (selected?.id === id) setSelectedId(null);
      setDeleteNote(null);
      toast.success('Nota excluída.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  const pending = selected && !!drafts[selected.id];
  const failed = selected && errors[selected.id];
  return (
    <>
      <PageHeading
        title="Minhas notas"
        description="Seu espaço pessoal para organizar ideias, procedimentos e lembretes."
      >
        <Button onClick={() => void create()} disabled={!action.connected || action.pending}>
          <Plus data-icon="inline-start" />
          Nova nota
        </Button>
      </PageHeading>
      <QueryState loading={query.isLoading} error={query.error} onRetry={() => void mutate()} />
      <section
        className="grid min-h-[620px] overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:h-[calc(100dvh-240px)] lg:min-h-[540px] lg:grid-cols-[300px_minmax(0,1fr)]"
        aria-label="Caderno de notas pessoais"
      >
        <aside
          className="flex max-h-[280px] min-h-0 flex-col border-b border-border bg-secondary/25 lg:max-h-none lg:border-r lg:border-b-0"
          aria-label="Lista de notas"
        >
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Seu caderno
              </span>
              <span className="rounded-md border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground">
                {notes.length} notas
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                aria-label="Buscar notas"
                placeholder="Buscar nas suas notas..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOnlyPinned(false)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[11px]',
                  !onlyPinned ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground',
                )}
              >
                Todas
              </button>
              <button
                onClick={() => setOnlyPinned(true)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px]',
                  onlyPinned ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground',
                )}
              >
                <Pin className="size-3" />
                Fixadas
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
            {filtered.map((note) => (
              <button
                key={note.id}
                onClick={() => setSelectedId(note.id)}
                aria-pressed={selected?.id === note.id}
                className={cn(
                  'w-full rounded-lg border p-4 text-left transition-colors',
                  selected?.id === note.id
                    ? 'border-primary/20 bg-card shadow-sm'
                    : 'border-transparent hover:bg-card/70',
                )}
              >
                <span className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">
                    {note.title || 'Sem título'}
                  </span>
                  {note.pinned && <Pin className="size-3 shrink-0 text-primary" />}
                </span>
                <span className="mb-3 line-clamp-2 block text-[11px] leading-5 text-muted-foreground">
                  {note.content || 'Comece a escrever nesta nota.'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {date(note.updatedAt)}
                  {drafts[note.id] ? ' · Não salva' : ''}
                </span>
              </button>
            ))}
            {!filtered.length && !query.isLoading && (
              <p className="p-5 text-center text-xs text-muted-foreground">
                {search || onlyPinned
                  ? 'Nenhuma nota neste filtro.'
                  : 'Seu caderno está pronto para a primeira ideia.'}
              </p>
            )}
          </div>
          <p className="hidden items-center gap-2 border-t border-border px-5 py-4 text-[10px] text-muted-foreground lg:flex">
            <ShieldCheck className="size-3.5" />
            Notas pessoais da sua conta
          </p>
        </aside>
        {selected ? (
          <div className="flex min-h-[440px] min-w-0 flex-col">
            <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 lg:px-8">
              <span
                role="status"
                className={cn(
                  'flex items-center gap-2 text-[11px]',
                  failed ? 'text-danger' : 'text-muted-foreground',
                )}
              >
                {saving[selected.id] ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="size-3.5" />
                )}
                {failed
                  ? 'Falha ao salvar — sua edição foi mantida'
                  : saving[selected.id]
                    ? 'Salvando...'
                    : pending
                      ? 'Alterações não salvas'
                      : 'Todas as alterações salvas'}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={selected.pinned ? 'Desafixar nota' : 'Fixar nota'}
                  disabled={action.pending}
                  onClick={() => void togglePin(selected)}
                >
                  <Pin className={cn('size-4', selected.pinned && 'fill-primary text-primary')} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Excluir nota"
                  disabled={action.pending}
                  onClick={() => setDeleteNote(selected)}
                >
                  <Trash2 className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void save(selected.id)}
                  disabled={!pending || !!saving[selected.id]}
                >
                  <Save className="size-3.5" />
                  Salvar
                </Button>
              </div>
            </header>
            {failed && (
              <p role="alert" className="px-8 pt-4 text-xs text-danger">
                {failed} Use Salvar para tentar novamente.
              </p>
            )}
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-6 pt-8 pb-6 lg:px-10">
              <input
                aria-label="Título da nota"
                value={selected.title}
                onChange={(event) => edit('title', event.target.value)}
                placeholder="Título da nota"
                className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-[10px] text-muted-foreground">
                Última atualização: {date(selected.updatedAt)}
              </span>
              <textarea
                aria-label="Conteúdo da nota"
                value={selected.content}
                onChange={(event) => edit('content', event.target.value)}
                placeholder="Comece a escrever..."
                className="min-h-64 w-full flex-1 resize-none bg-transparent text-sm leading-8 outline-none placeholder:text-muted-foreground/60"
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                    event.preventDefault();
                    void save(selected.id);
                  }
                }}
              />
              <div className="flex justify-between border-t border-border pt-4 text-[10px] text-muted-foreground">
                <span>Salvamento automático após a edição</span>
                <span>{selected.content.length.toLocaleString('pt-BR')} caracteres</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[440px] flex-col items-center justify-center px-6 text-center">
            <span className="mb-5 rounded-2xl border border-border bg-secondary/50 p-5">
              <FileText className="size-8 text-primary" />
            </span>
            <h2 className="text-lg font-semibold">Espaço para suas próximas ideias</h2>
            <p className="mt-2 mb-6 max-w-sm text-xs leading-6 text-muted-foreground">
              Selecione uma nota na lista ou crie uma nova. O conteúdo existente continua
              preservado.
            </p>
            <Button
              variant="outline"
              onClick={() => void create()}
              disabled={!action.connected || action.pending}
            >
              <Plus className="size-4" />
              Criar uma nota
            </Button>
          </div>
        )}
      </section>
      <Dialog open={!!deleteNote} onOpenChange={(open) => !open && setDeleteNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir nota?</DialogTitle>
            <DialogDescription>
              A nota “{deleteNote?.title || 'Sem título'}” será excluída permanentemente. Essa ação
              não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" disabled={action.pending} onClick={() => setDeleteNote(null)}>
              Cancelar
            </Button>
            <Button disabled={action.pending} onClick={() => void remove()}>
              Confirmar exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
