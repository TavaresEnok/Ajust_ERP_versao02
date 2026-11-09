'use client';
import { useSyncExternalStore, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Star,
  Copy,
  Pencil,
  ArrowLeft,
  BookOpen,
  Terminal,
  Layers,
  LayoutGrid,
  List,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useVisualSource, useRouteBase } from '@/lib/erp/visual-data';
import { useErp } from '@/lib/erp/gateway';
import { copyToClipboard } from '@/lib/erp/clipboard';
import { PageHeading } from './primitives';
import { RecordDialog } from './record-dialog';
import { OperationControl } from './operation-controls';
import { QueryState, ErpEmpty } from './contract-form';

/** Compatibility with description/command sections stored by the old ERP. */
export function parseArticleContent(raw: string) {
  const lines = raw.split(/\r?\n/);
  const normalize = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  const commandIndex = lines.findIndex((l) => normalize(l) === '## comando');
  const descriptionIndex = lines.findIndex((l) => normalize(l) === '## descricao');
  if (commandIndex >= 0)
    return {
      description: lines
        .slice(descriptionIndex >= 0 ? descriptionIndex + 1 : 0, commandIndex)
        .join('\n')
        .trim(),
      command: lines
        .slice(commandIndex + 1)
        .join('\n')
        .trim(),
    };
  const fenced = raw.match(/```[^\n]*\n([\s\S]*?)```/);
  if (fenced) return { description: raw.replace(fenced[0], '').trim(), command: fenced[1].trim() };
  return /^(?:display |show |ping |traceroute |\/interface|\/ip |\/routing|ssh |sudo |snmpwalk )/im.test(
    raw.trim(),
  )
    ? { description: '', command: raw.trim() }
    : { description: raw.trim(), command: '' };
}
function ArticleBody({ content }: { content: string }) {
  const { description, command } = parseArticleContent(content);
  return (
    <>
      {description && (
        <p className="my-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      )}
      {command && (
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#09090b] text-zinc-100">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-zinc-400">
            <div className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((n) => (
                <span key={n} className="size-2 rounded-full bg-zinc-700" />
              ))}
            </div>
            <button
              className="flex items-center gap-1.5 text-xs hover:text-white"
              aria-label="Copiar comando"
              onClick={async () => {
                if (await copyToClipboard(command)) toast.success('Comando copiado');
                else toast.error('Não foi possível copiar');
              }}
            >
              <Copy className="size-3.5" />
              Copiar
            </button>
          </div>
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-7">
            <code>{command}</code>
          </pre>
        </div>
      )}
    </>
  );
}
function subscribeFavorites(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('ajust-pedia-favorites', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('ajust-pedia-favorites', callback);
  };
}
export function KnowledgePage({ id, editing = false }: { id?: string; editing?: boolean }) {
  const query = useVisualSource('articles'),
    base = useRouteBase();
  const { scope } = useErp();
  const canManage = ['super_admin', 'gerente', 'analista'].includes(scope?.role || '');
  const [editOpen, setEditOpen] = useState(editing),
    [search, setSearch] = useState(''),
    [tag, setTag] = useState('Todos');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [mode, setMode] = useState<'cards' | 'list'>('cards');
  const favoriteKey = `ajust:pedia:favorites:v1:${scope?.tenantId || ''}:${scope?.userId || ''}`;
  const savedFavorites = useSyncExternalStore(
    subscribeFavorites,
    () => {
      try {
        return localStorage.getItem(favoriteKey) || '[]';
      } catch {
        return '[]';
      }
    },
    () => '[]',
  );
  let favorites: string[] = [];
  try {
    const saved = JSON.parse(savedFavorites);
    if (Array.isArray(saved)) favorites = saved.filter((value) => typeof value === 'string');
  } catch {}
  function toggleFavorite(articleId: string) {
    const next = favorites.includes(articleId)
      ? favorites.filter((value) => value !== articleId)
      : [...favorites, articleId];
    try {
      localStorage.setItem(favoriteKey, JSON.stringify(next));
      window.dispatchEvent(new Event('ajust-pedia-favorites'));
    } catch {
      toast.error('Não foi possível salvar o favorito neste navegador.');
    }
  }
  const articles = query.rows,
    selected = articles.find((a) => a.id === id);
  const tags = [...new Set(articles.flatMap((a) => a.tags as string[]))];
  const visible = articles.filter(
    (a) =>
      (!id || a.id === id) &&
      `${a.title} ${a.text} ${(a.tags as string[]).join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (tag === 'Todos' || (a.tags as string[]).includes(tag)) &&
      (!onlyFavorites || favorites.includes(a.id)),
  );
  if (id && !selected)
    return (
      <>
        <PageHeading
          title="Artigo indisponível"
          description="O artigo não foi localizado neste workspace."
        />
        <QueryState loading={query.isLoading} error={query.error} />
        <Link className="text-link" href={`${base}/ajustpedia`}>
          Voltar para a Ajustpedia
        </Link>
      </>
    );
  const totalCommands = articles.filter(
    (article) => parseArticleContent(String(article.text)).command,
  ).length;
  const toggleButton = (articleId: string) => (
    <Button
      size="sm"
      variant="ghost"
      aria-label={favorites.includes(articleId) ? 'Remover favorito' : 'Favoritar artigo'}
      aria-pressed={favorites.includes(articleId)}
      onClick={() => toggleFavorite(articleId)}
    >
      <Star
        className={
          favorites.includes(articleId)
            ? 'size-4 fill-warning text-warning'
            : 'size-4 text-muted-foreground'
        }
      />
    </Button>
  );
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="tone-surface tone-info relative overflow-hidden rounded-2xl border p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-info">
              <BookOpen className="size-4" />
              Base de conhecimento · Ajust
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Ajustpedia</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Procedimentos, comandos e conhecimento técnico compartilhado pela equipe.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="bg-card"
              onClick={() => setOnlyFavorites((v) => !v)}
              aria-pressed={onlyFavorites}
            >
              <Star className="size-4 text-warning" />
              Favoritos
            </Button>
            {canManage && !id && (
              <RecordDialog title="Novo artigo" moduleKey="articles" fields={[]} />
            )}
          </div>
        </div>
        <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
          {[
            { label: 'Artigos disponíveis', value: articles.length, icon: FileText },
            { label: 'Artigos com comandos', value: totalCommands, icon: Terminal },
            { label: 'Categorias e tags', value: tags.length, icon: Layers },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3">
              <span className="rounded-xl border border-border bg-card p-2.5">
                <stat.icon className="size-4 text-info" />
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1 font-semibold">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </header>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-4">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              aria-label="Buscar procedimentos"
              className="w-full bg-transparent text-xs outline-none"
              placeholder="Título, tag ou comando..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <nav
            aria-label="Categorias da Ajustpedia"
            className="rounded-2xl border border-border bg-card p-3"
          >
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Categorias técnicas
            </p>
            {['Todos', ...tags].map((category) => (
              <button
                key={category}
                className={
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs ' +
                  (tag === category
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'text-muted-foreground hover:bg-muted')
                }
                aria-pressed={tag === category}
                onClick={() => {
                  setTag(category);
                }}
              >
                <BookOpen className="size-3.5" />
                <span className="flex-1">
                  {category === 'Todos' ? 'Todos os artigos' : category}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                  {category === 'Todos'
                    ? articles.length
                    : articles.filter((article) => (article.tags as string[]).includes(category))
                        .length}
                </span>
              </button>
            ))}
          </nav>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tags da equipe
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <button
                  key={t}
                  className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground hover:text-primary"
                  onClick={() => setTag(t)}
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>
        </aside>
        <section aria-label="Artigos da Ajustpedia" className="min-w-0 space-y-4">
          {selected ? (
            <>
              <Link
                className="inline-flex items-center gap-2 text-xs font-medium text-primary"
                href={base + '/ajustpedia'}
              >
                <ArrowLeft className="size-4" />
                Voltar aos artigos
              </Link>
              <article className="overflow-hidden rounded-2xl border border-border bg-card">
                <header className="border-b border-border p-6 sm:p-8">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {(selected.tags as string[]).map((t) => (
                      <span key={t} className="rounded bg-primary/5 px-2 py-1 text-xs text-primary">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-2xl font-semibold leading-tight">{String(selected.title)}</h2>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{String(selected.author)}</p>
                      <p className="mt-1">
                        {String(selected.date)} ·{' '}
                        {Math.max(1, Math.ceil(String(selected.text).split(/\s+/).length / 200))}{' '}
                        min de leitura
                      </p>
                    </div>
                    {toggleButton(selected.id)}
                  </div>
                </header>
                <div className="p-6 sm:p-8">
                  <ArticleBody content={String(selected.text)} />
                </div>
                {canManage && (
                  <footer className="flex gap-2 border-t border-border p-4">
                    <Button variant="outline" onClick={() => setEditOpen(true)}>
                      <Pencil className="size-3.5" />
                      Editar artigo
                    </Button>
                    <OperationControl
                      title="Excluir artigo"
                      description="Deseja excluir este artigo da Ajustpedia?"
                      path={'/knowledge/articles/' + selected.id}
                      method="DELETE"
                      roles={['super_admin', 'gerente', 'analista']}
                      after={async () => {
                        await query.mutate();
                      }}
                    />
                  </footer>
                )}
              </article>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <p className="text-xs font-semibold">
                  {tag === 'Todos' ? 'Todos os artigos' : tag}
                  <span className="ml-2 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                    {visible.length} artigos
                  </span>
                  {onlyFavorites && <span className="ml-2 text-warning">Favoritos</span>}
                </p>
                <div className="flex rounded-lg border border-border bg-muted/30 p-1">
                  {(
                    [
                      { key: 'cards', label: 'Cartões', icon: LayoutGrid },
                      { key: 'list', label: 'Compacto', icon: List },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.key}
                      aria-pressed={mode === option.key}
                      onClick={() => setMode(option.key)}
                      className={
                        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ' +
                        (mode === option.key
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground')
                      }
                    >
                      <option.icon className="size-3.5" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={mode === 'cards' ? 'grid gap-4 xl:grid-cols-2' : 'space-y-3'}>
                {visible.map((article) => {
                  const parsed = parseArticleContent(String(article.text));
                  return (
                    <article
                      key={article.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="flex-1 p-5">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1">
                            {(article.tags as string[]).slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="rounded-md bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                          {toggleButton(article.id)}
                        </div>
                        <Link
                          className="text-base font-semibold leading-6 group-hover:text-primary"
                          href={base + '/ajustpedia/' + encodeURIComponent(article.id)}
                        >
                          {String(article.title)}
                        </Link>
                        <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">
                          {parsed.description ||
                            'Procedimento técnico com comandos para consulta e execução pela equipe.'}
                        </p>
                        {parsed.command && mode === 'cards' && (
                          <div className="relative mt-4 rounded-xl border border-white/10 bg-slate-950 p-3">
                            <div className="mb-2 flex items-center justify-between text-[10px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Terminal className="size-3" />
                                COMANDO
                              </span>
                              <button
                                aria-label="Copiar comando do artigo"
                                onClick={async () => {
                                  if (await copyToClipboard(parsed.command))
                                    toast.success('Comando copiado.');
                                }}
                              >
                                <Copy className="size-3.5" />
                              </button>
                            </div>
                            <pre className="max-h-20 overflow-hidden whitespace-pre-wrap break-all font-mono text-xs leading-5 text-success">
                              {parsed.command}
                            </pre>
                          </div>
                        )}
                      </div>
                      <footer className="flex items-center justify-between gap-2 border-t border-border bg-muted/10 px-5 py-3 text-[10px] text-muted-foreground">
                        <span className="truncate">
                          {String(article.author)} · {String(article.date)}
                        </span>
                        <Link
                          href={base + '/ajustpedia/' + encodeURIComponent(article.id)}
                          className="flex shrink-0 items-center gap-1 font-semibold text-primary"
                        >
                          Ler artigo
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      </footer>
                    </article>
                  );
                })}
              </div>
              {!visible.length && !query.isLoading && !query.error && (
                <ErpEmpty connected={query.connected} />
              )}
            </>
          )}
        </section>
      </div>
      {!!id && canManage && (
        <RecordDialog
          title="Editar artigo"
          moduleKey="articles"
          recordId={id}
          record={query.raw.find((article) => article.id === id)}
          fields={[]}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  );
}
