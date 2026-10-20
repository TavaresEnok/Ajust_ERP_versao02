'use client';
import { useState } from 'react';
import { Search, KeyRound, ShieldCheck, Eye, Star, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { queryPath, errorMessage, type ErpRecord } from '@/lib/erp/contracts';
import { listRecords } from '@/lib/erp/visual-data';
import { modules } from '@/lib/erp/modules';
import { PageHeading, PanelHeading } from './primitives';
import { RecordDialog } from './record-dialog';
import { OperationControl } from './operation-controls';
import { SecretReveal } from './secret-reveal';
import { ContractForm, QueryState, ErpEmpty } from './contract-form';
import { cn } from '@/lib/utils';
export { CredentialsPage } from './credentials-vault';
export function NotesPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ErpRecord | null>(null);
  const query = useErpQuery<unknown>(
    queryPath('/knowledge/notes', {
      search: search.trim().length >= 2 ? search.trim() : undefined,
    }),
  );
  const notes = listRecords(query.data);
  const action = useErpAction();
  return (
    <>
      <PageHeading
        title="Minhas notas"
        description="Tire as ideias da cabeça. Deixe tudo no lugar."
      >
        <RecordDialog title="Nova nota" moduleKey="notes" fields={[]} />
      </PageHeading>
      <div className="mb-5 flex max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          className="w-full bg-transparent text-xs outline-none"
          placeholder="Buscar nas minhas notas..."
          aria-label="Buscar notas"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[...notes]
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
          .map((note) => (
            <article className="note-paper flex flex-col" key={note.id}>
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded bg-warning/10 px-2 py-1 text-[9px] text-warning">
                  {note.pinned ? 'Fixada' : 'Pessoal'}
                </span>
                <button
                  aria-label={note.pinned ? 'Desafixar nota' : 'Fixar nota'}
                  disabled={!action.connected || action.pending}
                  onClick={async () => {
                    try {
                      await action.execute({
                        path: `/knowledge/notes/${encodeURIComponent(note.id)}`,
                        method: 'PATCH',
                        body: { pinned: !note.pinned },
                      });
                      await query.mutate();
                    } catch (error) {
                      toast.error(errorMessage(error));
                    }
                  }}
                >
                  <Star
                    className={cn(
                      'size-3.5',
                      note.pinned ? 'fill-warning text-warning' : 'text-muted-foreground',
                    )}
                  />
                </button>
              </div>
              <h2 className="text-sm font-semibold">
                <button onClick={() => setSelected(note)} className="text-left">
                  {String(note.title)}
                </button>
              </h2>
              <p className="my-4 whitespace-pre-line text-xs leading-7 text-muted-foreground">
                {String(note.content || '')}
              </p>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-warning/10 pt-3">
                <span className="text-[9px] text-muted-foreground">
                  {note.updatedAt
                    ? `Atualizada em ${new Date(String(note.updatedAt)).toLocaleDateString('pt-BR')}`
                    : 'Sem data de atualização'}
                </span>
                <div className="flex flex-wrap gap-3">
                  <RecordDialog
                    title="Editar nota"
                    moduleKey="notes"
                    recordId={note.id}
                    record={note}
                    trigger={<MoreHorizontal className="size-4 text-muted-foreground" />}
                    fields={[]}
                  />
                  <OperationControl
                    title="Excluir nota"
                    description={`Excluir a nota ${note.title}?`}
                    path={`/knowledge/notes/${encodeURIComponent(note.id)}`}
                    method="DELETE"
                    after={async () => {
                      await query.mutate();
                    }}
                  />
                </div>
              </div>
            </article>
          ))}
      </div>
      {!notes.length && !query.isLoading && !query.error && (
        <ErpEmpty connected={query.connected} />
      )}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{String(selected?.title || 'Nota')}</DialogTitle>
            <DialogDescription>Anotação pessoal da sessão autenticada.</DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm leading-7">{String(selected?.content || '')}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
