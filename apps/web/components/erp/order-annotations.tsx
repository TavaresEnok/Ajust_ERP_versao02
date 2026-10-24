'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useErp, useErpAction } from '@/lib/erp/gateway';
import { errorMessage, type ErpRecord } from '@/lib/erp/contracts';
const LIMIT = 20000;
export function OrderAnnotations({
  orderId,
  notes,
  refresh,
}: {
  orderId: string;
  notes: ErpRecord[];
  refresh: () => Promise<unknown>;
}) {
  const { scope } = useErp(),
    action = useErpAction();
  const [text, setText] = useState(''),
    [edit, setEdit] = useState<ErpRecord | null>(null),
    [error, setError] = useState('');
  async function save() {
    try {
      setError('');
      await action.execute({
        path: `/service-orders/${orderId}/annotations${edit ? '/' + edit.id : ''}`,
        method: edit ? 'PATCH' : 'POST',
        body: { message: text, expectedVersion: edit?.version },
      });
      setText('');
      setEdit(null);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <section className="space-y-5">
      <h2 className="section-title">{edit ? 'Editar anotação' : 'Anotações do atendimento'}</h2>
      <textarea
        aria-label="Anotação"
        maxLength={LIMIT}
        className="min-h-40 w-full rounded-lg border border-border bg-card p-3 text-sm leading-6"
        value={text}
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
        <Button disabled={action.pending || text.trim().length < 2} onClick={() => void save()}>
          {edit ? 'Salvar alteração' : 'Adicionar anotação'}
        </Button>
        {edit && (
          <Button
            variant="ghost"
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
        {notes
          .filter((n) => n.editable === true)
          .map((n) => (
            <article key={String(n.id)} className="rounded-lg border border-border p-4">
              <p className="whitespace-pre-wrap text-sm leading-6">{String(n.message)}</p>
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
              {n.actorUserId === scope?.userId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (text && !window.confirm('Descartar o texto não salvo?')) return;
                    setEdit(n);
                    setText(String(n.message));
                    setError('');
                  }}
                >
                  Editar anotação
                </Button>
              )}
            </article>
          ))}
      </div>
    </section>
  );
}
