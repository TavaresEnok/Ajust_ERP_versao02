'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { errorMessage } from '@/lib/erp/contracts';
import { PageHeading } from './primitives';
import { QueryState } from './contract-form';
type Order = { id: string; protocol: string; title: string };
type Report = {
  id: string;
  authorUserId: string;
  authorName: string;
  shift: string;
  referenceDate: string;
  content: string;
  orderIds: string[];
  linkedOrders?: Order[];
  version: number;
  revisions: { version: number; content: string; referenceDate: string }[];
};
export function ShiftReportsPage() {
  const { scope } = useErp(),
    action = useErpAction();
  const [mine, setMine] = useState(false),
    [author, setAuthor] = useState(''),
    [shift, setShift] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Report | null>(null),
    [editing, setEditing] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState('');
  const [content, setContent] = useState(''),
    [date, setDate] = useState(''),
    [turn, setTurn] = useState('DAY'),
    [ids, setIds] = useState<string[]>([]),
    [search, setSearch] = useState(''),
    [lookup, setLookup] = useState('');
  const [known, setKnown] = useState<Record<string, Order>>({});
  const query = useErpQuery<Report[]>(
    `/shift-reports?mine=${mine}&offset=${page * 50}${author && !mine ? '&author=' + author : ''}${shift ? '&shift=' + shift : ''}${from ? '&from=' + from : ''}${to ? '&to=' + to : ''}`,
  );
  const authors =
    useErpQuery<{ authorUserId: string; authorName: string }[]>('/shift-reports/authors');
  const matches = useErpQuery<Order[]>(
    editing && lookup ? `/shift-reports/order-search?q=${encodeURIComponent(lookup)}` : null,
  );
  const leave = () => !dirty || window.confirm('Descartar alterações não salvas?');
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function open(id: string) {
    if (!leave()) return;
    try {
      const r = await action.execute<Report>({ path: '/shift-reports/' + id });
      setKnown((a) => ({
        ...a,
        ...Object.fromEntries((r.linkedOrders || []).map((o) => [o.id, o])),
      }));
      setSelected(r);
      setEditing(false);
      setDirty(false);
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function edit(r: Report | null) {
    if (!leave()) return;
    setSelected(r);
    setContent(r?.content || '');
    setDate(
      r?.referenceDate ||
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Fortaleza',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date()),
    );
    setTurn(r?.shift || 'DAY');
    setIds(r?.orderIds || []);
    setEditing(true);
    setDirty(false);
    setLookup('');
    setSearch('');
    setError('');
  }
  async function save() {
    try {
      setError('');
      const r = await action.execute<Report>({
        path: '/shift-reports' + (selected ? '/' + selected.id : ''),
        method: selected ? 'PATCH' : 'POST',
        body: {
          referenceDate: date,
          shift: turn,
          content,
          orderIds: ids,
          expectedVersion: selected?.version,
        },
      });
      setSelected(r);
      setDirty(false);
      setEditing(false);
      await query.mutate();
      await authors.mutate();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const base = scope?.role === 'analista' ? '/analista' : '/gerencia';
  return (
    <>
      <PageHeading
        title="Relatórios de turno"
        description="Todo relatório salvo fica disponível à equipe da Ajust. Para rascunhar, use Minhas notas."
      >
        <Button onClick={() => edit(null)}>Novo relatório</Button>
      </PageHeading>
      <div className="mb-5 flex flex-wrap gap-3">
        <Button
          variant={!mine ? 'default' : 'outline'}
          onClick={() => {
            setMine(false);
            setPage(0);
          }}
        >
          Relatórios da equipe
        </Button>
        <Button
          variant={mine ? 'default' : 'outline'}
          onClick={() => {
            setMine(true);
            setPage(0);
          }}
        >
          Meus relatórios
        </Button>
        <label className="text-xs">
          Analista{' '}
          <select
            className="native-select"
            aria-label="Filtrar analista"
            disabled={mine}
            value={author}
            onChange={(e) => {
              setAuthor(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todos</option>
            {authors.data?.map((a) => (
              <option key={a.authorUserId} value={a.authorUserId}>
                {a.authorName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Plantão{' '}
          <select
            className="native-select"
            aria-label="Filtrar plantão"
            value={shift}
            onChange={(e) => {
              setShift(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todos</option>
            <option value="DAY">Diurno</option>
            <option value="NIGHT">Noturno</option>
          </select>
        </label>
        <label className="text-xs">
          De{' '}
          <input
            type="date"
            className="native-select"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="text-xs">
          Até{' '}
          <input
            type="date"
            className="native-select"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(390px,1fr)_minmax(0,1.2fr)]">
        <section className="panel min-w-0 overflow-hidden" aria-label="Tabela de relatórios">
          <QueryState loading={query.isLoading} error={query.error} />
          <div className="table-wrap relative">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Analista</th>
                  <th>Plantão</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {query.data?.map((r) => (
                  <tr key={r.id} className={selected?.id === r.id ? 'bg-secondary' : ''}>
                    <td>{r.referenceDate.split('-').reverse().join('/')}</td>
                    <td>{r.authorName}</td>
                    <td>{r.shift === 'NIGHT' ? 'Noturno' : 'Diurno'}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => void open(r.id)}>
                        Abrir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.isLoading && !query.error && !query.data?.length && (
            <p className="p-5 text-sm text-muted-foreground">Nenhum relatório neste recorte.</p>
          )}
          <div className="flex items-center justify-between gap-2 p-4">
            <Button variant="outline" disabled={!page} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-xs">Página {page + 1} · até 50 por página</span>
            <Button
              variant="outline"
              disabled={query.data?.length !== 50}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </section>
        <section className="panel min-w-0 space-y-5 p-5">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error} Seu texto foi mantido.
            </p>
          )}
          {editing ? (
            <>
              <h2 className="section-title">{selected ? 'Editar relatório' : 'Novo relatório'}</h2>
              <div className="flex flex-wrap gap-4">
                <label className="text-xs">
                  Data{' '}
                  <input
                    aria-label="Data do relatório"
                    type="date"
                    className="native-select"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setDirty(true);
                    }}
                  />
                </label>
                <label className="text-xs">
                  Plantão{' '}
                  <select
                    aria-label="Plantão do relatório"
                    className="native-select"
                    value={turn}
                    onChange={(e) => {
                      setTurn(e.target.value);
                      setDirty(true);
                    }}
                  >
                    <option value="DAY">Diurno</option>
                    <option value="NIGHT">Noturno</option>
                  </select>
                </label>
              </div>
              <textarea
                aria-label="Texto do relatório"
                maxLength={50000}
                className="min-h-[350px] w-full rounded-lg border border-border bg-card p-4 text-sm leading-7"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
              />
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {content.length.toLocaleString('pt-BR')} / 50.000 caracteres · Descreva o expediente
                com pelo menos 20 caracteres.
              </p>
              <div>
                <label className="mb-2 block text-xs">Vincular O.S. pelo ID ou protocolo</label>
                <div className="flex gap-2">
                  <input
                    aria-label="ID da O.S."
                    className="native-select min-w-0 flex-1"
                    placeholder="Ex.: DEMO-20261023-DNS-001 ou protocolo da O.S."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Button variant="outline" onClick={() => setLookup(search.trim())}>
                    Buscar O.S.
                  </Button>
                </div>
                <QueryState loading={matches.isLoading} error={matches.error} />
                {matches.data?.map((o) => (
                  <button
                    key={o.id}
                    className="mt-2 block w-full rounded-lg border border-border p-3 text-left text-xs hover:bg-muted"
                    disabled={ids.includes(o.id)}
                    onClick={() => {
                      setIds((a) => [...a, o.id]);
                      setKnown((a) => ({ ...a, [o.id]: o }));
                      setDirty(true);
                      setLookup('');
                    }}
                  >
                    {o.protocol} · {o.title} + vincular
                  </button>
                ))}
                {lookup && matches.data?.length === 0 && (
                  <p className="text-xs py-3">Nenhuma O.S. encontrada.</p>
                )}
              </div>
              <div className="space-y-2">
                {ids.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-3 text-xs">
                    <Link className="text-link" href={`${base}/ordens/${id}`}>
                      {known[id]?.protocol || id}
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIds((a) => a.filter((v) => v !== id));
                        setDirty(true);
                      }}
                    >
                      Desvincular
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  disabled={action.pending || !date || content.trim().length < 20}
                  onClick={() => void save()}
                >
                  Salvar relatório
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (leave()) {
                      setEditing(false);
                      setDirty(false);
                    }
                  }}
                >
                  Cancelar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao salvar, toda a equipe pode consultar. Alterações preservam a revisão anterior.
              </p>
            </>
          ) : selected ? (
            <>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="section-title">{selected.authorName}</h2>
                  <p className="mt-2 text-xs">
                    {selected.referenceDate.split('-').reverse().join('/')} ·{' '}
                    {selected.shift === 'NIGHT' ? 'Noturno' : 'Diurno'} · v{selected.version}
                  </p>
                </div>
                {selected.authorUserId === scope?.userId && (
                  <Button variant="outline" onClick={() => edit(selected)}>
                    Editar
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7">{selected.content}</p>
              <div className="space-y-2">
                {selected.orderIds.map((id) => (
                  <Link key={id} className="text-link block" href={`${base}/ordens/${id}`}>
                    O.S. {known[id]?.protocol || id} →
                  </Link>
                ))}
              </div>
              <details>
                <summary className="cursor-pointer text-sm">
                  Revisões anteriores ({selected.revisions.length})
                </summary>
                {selected.revisions.map((r) => (
                  <article key={r.version} className="mt-4 border-t border-border pt-4">
                    <p className="text-xs">
                      Versão {r.version} · {r.referenceDate}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{r.content}</p>
                  </article>
                ))}
              </details>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Escolha um relatório na tabela ou crie um novo.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
