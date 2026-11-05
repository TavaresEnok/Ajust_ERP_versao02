'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useErp, useErpAction } from '@/lib/erp/gateway';
import { errorMessage, type ErpRecord } from '@/lib/erp/contracts';
const LIMIT = 20000;
export function OrderAnnotations({
  orderId,
  notes,
  refresh,
  resource = 'orders',
}: {
  orderId: string;
  notes: ErpRecord[];
  refresh: () => Promise<unknown>;
  resource?: 'orders' | 'occurrences';
}) {
  const { scope } = useErp(),
    action = useErpAction();
  const [text, setText] = useState(''),
    [edit, setEdit] = useState<ErpRecord | null>(null),
    [error, setError] = useState('');
  const editor = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [saving, setSaving] = useState(false);
  const visibleNotes =
    resource === 'occurrences' ? notes : notes.filter((note) => note.editable === true);
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      setError('');
      await action.execute({
        path: `/service-orders/${resource === 'occurrences' ? 'occurrences/' : ''}${orderId}/annotations${edit ? '/' + edit.id : ''}`,
        method: edit ? 'PATCH' : 'POST',
        body: { message: text, expectedVersion: edit?.version },
      });
      setText('');
      setEdit(null);
      try {
        await refresh();
      } catch {
        setError(
          'A anotação foi salva, mas a lista não pôde ser atualizada. Recarregue a página para consultá-la.',
        );
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  return (
    <section className="space-y-5">
      <h2 className="section-title">
        {edit
          ? 'Editar anotação'
          : resource === 'occurrences'
            ? 'Anotações da ocorrência'
            : 'Anotações do atendimento'}
      </h2>
      <textarea
        ref={editor}
        disabled={saving}
        aria-label="Anotação"
        maxLength={LIMIT}
        className="min-h-40 w-full rounded-lg border border-border bg-card p-3 text-sm leading-6"
        value={text}
        placeholder="Registre o andamento, as verificações realizadas ou orientações para a equipe."
        onChange={(e) => setText(e.target.value)}
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {text.length.toLocaleString('pt-BR')} / 20.000 caracteres
      </p>
      <p className="text-xs text-muted-foreground">
        Para backups e conteúdos extensos, utilize Anexos.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button disabled={saving || text.trim().length < 2} onClick={() => void save()}>
          {saving ? 'Salvando…' : edit ? 'Salvar alteração' : 'Adicionar anotação'}
        </Button>
        {edit && (
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setEdit(null);
              setText('');
              setError('');
            }}
          >
            Cancelar edição
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {!visibleNotes.length && (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhuma anotação registrada neste atendimento.
          </p>
        )}
        {visibleNotes.slice(0, visibleCount).map((n) => (
          <article key={String(n.id)} className="rounded-lg border border-border p-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{String(n.message)}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {(n.actorUser as { name?: string })?.name ||
                (n.sourceAuthorName as string) ||
                'Equipe'}{' '}
              ·{' '}
              {new Date(String(n.createdAt)).toLocaleString('pt-BR', {
                timeZone: 'America/Fortaleza',
              })}
              {n.editedAt ? ' · editada' : ''}
            </p>
            {resource === 'orders' && n.actorUserId === scope?.userId && (
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => {
                  if (text && !window.confirm('Descartar o texto não salvo?')) return;
                  setEdit(n);
                  setText(String(n.message));
                  setError('');
                  editor.current?.focus();
                  editor.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }}
              >
                Editar anotação
              </Button>
            )}
          </article>
        ))}
        {visibleNotes.length > visibleCount && (
          <Button variant="outline" onClick={() => setVisibleCount((count) => count + 20)}>
            Mostrar mais anotações ({visibleNotes.length - visibleCount})
          </Button>
        )}
      </div>
    </section>
  );
}
