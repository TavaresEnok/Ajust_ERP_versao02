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
export function CredentialsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState<ErpRecord | null>(null);
  const { scope } = useErp();
  const allowed = !scope || ['super_admin', 'gerente', 'analista', 'tecnico'].includes(scope.role);
  const query = useErpQuery<unknown>(
    allowed
      ? queryPath('/knowledge/credentials', {
          ...filters,
          search: search.trim().length >= 2 ? search.trim() : undefined,
          offset: (page - 1) * 20,
          limit: 20,
        })
      : null,
  );
  const items = listRecords(query.data);
  const total =
    query.data && typeof query.data === 'object' && 'total' in query.data
      ? Number(query.data.total)
      : undefined;
  return (
    <>
      <PageHeading
        title="Cofre de credenciais"
        description="Seus acessos organizados. Segurança em primeiro lugar."
      >
        <RecordDialog title="Nova credencial" moduleKey="credentials" fields={[]} />
      </PageHeading>
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-primary/10 bg-secondary/50 p-4 text-xs text-primary">
        <ShieldCheck className="size-5 shrink-0" />
        <p>
          Revelações individuais exigem confirmação e autorização do ERP. Segredos não são
          armazenados no cache de consultas.
        </p>
      </div>
      <details className="panel mb-5 p-5">
        <summary className="cursor-pointer text-xs font-medium">Filtrar e ordenar acessos</summary>
        <div className="mt-5">
          <ContractForm
            fields={modules.credentials.filters || []}
            draft
            connected={false}
            label="Aplicar filtros"
            onSubmit={async (values) => {
              setFilters(values);
              setPage(1);
            }}
          />
        </div>
      </details>
      <section className="panel">
        <PanelHeading
          title="Credenciais de acesso"
          description="Organizadas por equipamento e provedor"
        >
          <div className="flex items-center gap-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              aria-label="Buscar credenciais"
              placeholder="Buscar acesso..."
              className="w-36 bg-transparent text-xs outline-none"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </PanelHeading>
        <QueryState
          loading={query.isLoading}
          error={query.error}
          onRetry={() => void query.mutate()}
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Identificação</th>
                <th>Provedor</th>
                <th>Tipo</th>
                <th>Usuário</th>
                <th>Acesso</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="flex items-center gap-2">
                      <KeyRound className="size-3.5 text-primary" />
                      <button className="font-medium" onClick={() => setSelected(item)}>
                        {String(item.equipmentName || item.host)}
                      </button>
                    </span>
                  </td>
                  <td>{String(item.provider)}</td>
                  <td>{String(item.equipmentType || '—')}</td>
                  <td className="text-muted-foreground">{String(item.username)}</td>
                  <td>
                    <Button variant="outline" size="sm" onClick={() => setSelected(item)}>
                      <Eye data-icon="inline-start" />
                      Detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && !query.isLoading && !query.error && (
          <ErpEmpty connected={query.connected} />
        )}
        <div className="flex items-center justify-between gap-3 border-t border-border p-5 text-xs">
          <span>
            Página {page}
            {total !== undefined ? ` · ${total} registros` : ''}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1 || query.isLoading}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={
                !query.connected ||
                query.isLoading ||
                (total !== undefined ? page * 20 >= total : items.length < 20)
              }
              onClick={() => setPage((value) => value + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </section>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {String(selected?.equipmentName || selected?.host || 'Credencial')}
            </DialogTitle>
            <DialogDescription>
              Metadados do acesso selecionado. O segredo só é consultado após confirmação.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 rounded-lg bg-muted p-4 text-xs">
            <p>Provedor: {String(selected?.provider || '—')}</p>
            <p>Ambiente: {String(selected?.environment || '—')}</p>
            <p>Endereço: {String(selected?.host || '—')}</p>
            <p>Usuário: {String(selected?.username || '—')}</p>
          </div>
          {selected && (
            <div className="flex flex-wrap gap-3">
              <SecretReveal
                key={selected.id}
                recordId={selected.id}
                title={String(selected.equipmentName || selected.host)}
                path={`/knowledge/credentials/${encodeURIComponent(selected.id)}/reveal`}
                field="secret"
              />
              <RecordDialog
                title="Editar credencial"
                moduleKey="credentials"
                recordId={selected.id}
                record={selected}
                fields={[]}
              />
              <OperationControl
                title="Remover credencial"
                description="Remover definitivamente esta credencial do cofre?"
                path={`/knowledge/credentials/${encodeURIComponent(selected.id)}`}
                method="DELETE"
                roles={['super_admin', 'gerente', 'analista']}
                after={async () => {
                  setSelected(null);
                  await query.mutate();
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
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
