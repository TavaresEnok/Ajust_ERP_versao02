'use client';
import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Search, ArrowUpRight, ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVisualSource, useRouteBase } from '@/lib/erp/visual-data';
import { PageHeading, Avatar, StatusBadge } from './primitives';
import { RecordDialog } from './record-dialog';
import { OperationControl } from './operation-controls';
import { QueryState, ErpEmpty } from './contract-form';
export function KnowledgePage({ id, editing = false }: { id?: string; editing?: boolean }) {
  const query = useVisualSource('articles');
  const articles = query.rows;
  const base = useRouteBase();
  const [editOpen, setEditOpen] = useState(editing);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos os artigos');
  const selected = articles.find((a) => a.id === id);
  const categories = ['Todos os artigos', ...new Set(articles.map((a) => String(a.category)))];
  if (id && !selected)
    return (
      <>
        <PageHeading title="Artigo indisponível" description={`Registro ${id}`} />
        <QueryState loading={query.isLoading} error={query.error} />
        <Link className="text-link" href={`${base}/ajustpedia`}>
          Voltar para a Ajustpedia
        </Link>
      </>
    );
  if (selected)
    return (
      <>
        <Link href={`${base}/ajustpedia`} className="mb-4 text-link">
          <ArrowLeft />
          Voltar para a Ajustpedia
        </Link>
        <PageHeading
          title={String(selected.title)}
          description={`${selected.category} · Atualizado em ${selected.date}`}
        >
          <StatusBadge status={String(selected.status)} />
          <Button onClick={() => setEditOpen(true)}>Editar artigo</Button>
          <RecordDialog
            title="Editar artigo"
            moduleKey="articles"
            recordId={id}
            record={query.raw.find((row) => row.id === id)}
            fields={[]}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
          <OperationControl
            title={selected.isPublished ? 'Despublicar artigo' : 'Publicar artigo'}
            description="A publicação será alterada na base de conhecimento do ERP."
            path={`/knowledge/articles/${encodeURIComponent(id!)}`}
            method="PATCH"
            body={{ isPublished: !selected.isPublished }}
            roles={['super_admin', 'gerente', 'analista']}
            after={async () => {
              await query.mutate();
            }}
          />
          <OperationControl
            title="Remover artigo"
            description="Confirme a remoção deste artigo da Ajustpedia."
            path={`/knowledge/articles/${encodeURIComponent(id!)}`}
            method="DELETE"
            roles={['super_admin', 'gerente', 'analista']}
            after={async () => {
              await query.mutate();
            }}
          />
        </PageHeading>
        <article className="panel mx-auto max-w-4xl p-7 sm:p-10">
          <div className="mb-8 flex items-center gap-3 border-b border-border pb-6">
            <Avatar name={String(selected.author)} />
            <span className="text-xs">{String(selected.author)}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {Math.max(1, Math.ceil(String(selected.text).split(/\s+/).length / 200))} min de
              leitura
            </span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">{String(selected.title)}</h2>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-8 text-muted-foreground">
            {String(selected.text)}
          </div>
          <div className="my-7 flex flex-wrap gap-2">
            {(selected.tags as string[]).map((tag) => (
              <span key={tag} className="rounded bg-muted px-2 py-1 text-xs">
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <p className="text-xs text-muted-foreground">
              Este artigo foi útil? A coleta de feedback aguarda contrato específico.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled>
                Sim, ajudou
              </Button>
              <Button variant="outline" disabled>
                Pode melhorar
              </Button>
            </div>
          </div>
        </article>
      </>
    );
  return (
    <>
      <PageHeading
        title="Ajustpedia"
        description="Conhecimento compartilhado. Soluções que vão mais longe."
      >
        <RecordDialog title="Novo artigo" moduleKey="articles" fields={[]} />
      </PageHeading>
      <div className="mb-6 rounded-xl border border-primary/10 bg-secondary/55 p-7">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Uma boa resposta começa aqui.</h2>
        </div>
        <p className="mb-5 text-xs text-muted-foreground">
          Guias, procedimentos e soluções documentadas pela sua equipe.
        </p>
        <div className="flex max-w-xl items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            className="w-full bg-transparent text-xs outline-none"
            placeholder="Qual conhecimento você procura?"
            aria-label="Buscar artigos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-[10px] text-muted-foreground">{articles.length} artigos</span>
        </div>
      </div>
      <div className="mb-5 flex gap-2 overflow-auto">
        {categories.map((c) => (
          <Button
            key={c}
            variant={category === c ? 'secondary' : 'outline'}
            onClick={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {articles
          .filter(
            (a) =>
              `${a.title} ${a.text}`.toLowerCase().includes(search.toLowerCase()) &&
              (category === 'Todos os artigos' || a.category === category),
          )
          .map((a) => (
            <article className="panel flex flex-col p-6" key={a.id}>
              <div className="mb-5 flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                  <FileText className="size-4" />
                </span>
                <span className="text-[9px] text-muted-foreground">{String(a.category)}</span>
              </div>
              <Link
                href={`${base}/ajustpedia/${encodeURIComponent(a.id)}`}
                className="text-[15px] font-semibold tracking-tight hover:text-primary"
              >
                {String(a.title)}
              </Link>
              <p className="mt-3 line-clamp-3 text-xs leading-6 text-muted-foreground">
                {String(a.text)}
              </p>
              <div className="my-5 flex flex-wrap gap-1.5">
                {(a.tags as string[]).map((t) => (
                  <span
                    key={t}
                    className="rounded bg-muted px-2 py-1 text-[9px] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                <span className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  <Avatar name={String(a.author)} className="size-5 text-[7px]" />
                  {String(a.author)}
                </span>
                <Link
                  href={`${base}/ajustpedia/${encodeURIComponent(a.id)}`}
                  aria-label={`Ler ${a.title}`}
                >
                  <ArrowUpRight className="size-4 text-primary" />
                </Link>
              </div>
            </article>
          ))}
      </div>
      {!articles.length && !query.isLoading && !query.error && (
        <ErpEmpty connected={query.connected} />
      )}
    </>
  );
}
