"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowDownToLine,
  Printer,
  Zap,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  LayoutGrid,
  List,
  Clock3,
  MessageSquare,
  Paperclip,
  Send,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import type { Order } from "@/lib/demo-data";
import { exportCsv, useOrders } from "@/lib/demo-store";
import { cn } from "@/lib/utils";
import {
  PageHeading,
  PanelHeading,
  Priority,
  StatusBadge,
  Avatar,
  SearchEmpty,
  Metric,
} from "./primitives";
import { OrderForm } from "./order-form";
import { useVisualSource, useRouteBase } from "@/lib/erp/visual-data";
import { useErp } from "@/lib/erp/gateway";
import { orderStatuses, orderTypes, priorities, queryPath } from "@/lib/erp/contracts";
const statuses = Object.values(orderStatuses);
import { RecordWorkspace } from "./record-workspace";
import { OperationControl } from "./operation-controls";
import { QueryState } from "./contract-form";
import { QuickDispatchDialog } from "./quick-dispatch-dialog";
import { OrderExportDialog } from "./order-export-dialog";
export function OrdersTable({
  orders,
  compact = false,
}: {
  orders: Order[];
  compact?: boolean;
}) {
  const pathname = usePathname();
  const orderBase = pathname.startsWith("/analista") ? "/analista" : pathname.startsWith("/cliente") || pathname.startsWith("/portal") ? "/cliente" : "/gerencia";
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {!compact && (
              <th>
                <span className="sr-only">Selecionar</span>
              </th>
            )}
            <th>Ordem de serviço</th>
            <th>Provedor</th>
            <th>Status</th>
            <th>Prioridade</th>
            {!compact && (
              <>
                <th>Responsável</th>
                <th>Prazo</th>
              </>
            )}
            <th>
              <span className="sr-only">Detalhes</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              {!compact && (
                <td>
                  <input type="checkbox" aria-label={"Selecionar " + o.id} />
                </td>
              )}
              <td>
                <Link href={orderBase + "/ordens/" + o.id} className="block">
                  <span className="mb-1 block text-[9px] text-muted-foreground">
                    #{o.protocol || o.id}
                  </span>
                  <span className="font-medium hover:text-primary">
                    {o.title}
                  </span>
                </Link>
              </td>
              <td>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-md text-[8px] font-medium",
                      o.initials === "CT"
                        ? "bg-secondary text-primary"
                        : o.initials === "NM"
                          ? "bg-warning/10 text-warning"
                          : "bg-info/10 text-info",
                    )}
                  >
                    {o.initials}
                  </span>
                  {o.provider}
                </span>
              </td>
              <td>
                <StatusBadge status={o.status} />
              </td>
              <td>
                <Priority value={o.priority} />
              </td>
              {!compact && (
                <>
                  <td>
                    <span className="flex items-center gap-2">
                      <Avatar name={o.analyst} />
                      {o.analyst}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{o.deadline}</td>
                </>
              )}
              <td>
                <Link
                  href={orderBase + "/ordens/" + o.id}
                  className="text-muted-foreground hover:text-primary"
                  aria-label={"Ver " + o.id}
                >
                  <ChevronRight className="size-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <SearchEmpty />}
    </div>
  );
}
export function OrdersPage({
  customer = false,
  analyst = false,
}: {
  customer?: boolean;
  analyst?: boolean;
}) {
  const orderBase = customer ? "/cliente" : analyst ? "/analista" : "/gerencia";
  const { scope } = useErp();
  const canQuickDispatch = !customer && (!scope || ["super_admin", "gerente", "analista", "tecnico"].includes(scope.role));
  const [quickDispatchOpen, setQuickDispatchOpen] = useState(false);
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(params.get("status") || "Todos");
  const [provider, setProvider] = useState("Todos");
  const [priority, setPriority] = useState("Todas");
  const [filters, setFilters] = useState(false);
  const [view, setView] = useState("list");
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const endpoint = queryPath("/service-orders", { q: search || undefined, status: Object.entries(orderStatuses).find(([, label]) => label === status)?.[0], priority: Object.entries(priorities).find(([, label]) => label === priority)?.[0], type: type || undefined, from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(to).toISOString() : undefined, page, limit: 8 });
  const { orders } = useOrders(endpoint);
  const source = useVisualSource("orders", endpoint);
  const providers = [...new Set(orders.map(order => order.provider))].map(name => ({ id: name, name }));
  const scoped = orders;
  const filtered = scoped.filter(
    (o) =>
      (o.title + " " + o.id + " " + String((o as unknown as { protocol?: string }).protocol || "") + " " + o.provider)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "Todos" || o.status === status) &&
      (provider === "Todos" || o.provider === provider) &&
      (priority === "Todas" || o.priority === priority),
  );
  const total = source.data && typeof source.data === "object" && "total" in source.data ? Number(source.data.total) : undefined;
  const pages = total !== undefined ? Math.max(1, Math.ceil(total / 8)) : page + (orders.length === 8 ? 1 : 0);
  const current = page;
  function download() {
    exportCsv(
      "ajust-ordens",
      [
        "Protocolo",
        "Título",
        "Provedor",
        "Status",
        "Prioridade",
        "Responsável",
      ],
      filtered.map((o) => [
        o.id,
        o.title,
        o.provider,
        o.status,
        o.priority,
        o.analyst,
      ]),
    );
    toast.success("Relatório CSV exportado");
  }
  return (
    <>
      <PageHeading
        title={
          customer
            ? "Meus chamados"
            : analyst
              ? "Minhas ordens"
              : "Ordens de serviço"
        }
        description={
          customer
            ? "Acompanhe suas solicitações e o andamento de cada atendimento."
            : "Cada atendimento no lugar certo. Sua operação em movimento."
        }
      >
        <Link href={`${orderBase}/relatorios`} className="text-link">Relatórios e exportações</Link>
        {canQuickDispatch && <Button variant="outline" onClick={() => setQuickDispatchOpen(true)}><Zap data-icon="inline-start" />Atendimento rápido</Button>}
        <Button variant="outline" onClick={download}>
          <ArrowDownToLine data-icon="inline-start" />
          Exportar
        </Button>
        <OrderForm />
      </PageHeading>
      <div className="mb-5 grid grid-cols-4 gap-4 metrics-grid">
        {[
          {
            label: "Ordens nesta página",
            value: scoped.length,
            icon: ClipboardList,
          },
          {
            label: "Em andamento",
            value: scoped.filter(
              (o) =>
                !["Concluída", "Resolvida", "Cancelada"].includes(o.status),
            ).length,
            icon: Clock3,
          },
          {
            label: "Concluídas",
            value: scoped.filter((o) =>
              ["Concluída", "Resolvida"].includes(o.status),
            ).length,
            icon: CheckCircle2,
          },
          {
            label: "Prioridade crítica",
            value: scoped.filter((o) => o.priority === "Crítica").length,
            icon: SlidersHorizontal,
          },
        ].map((m) => (
          <Metric
            key={m.label}
            label={m.label}
            value={String(m.value).padStart(2, "0")}
            icon={m.icon}
            change="Consulta atual"
            foot="registros retornados pelo ERP"
          />
        ))}
      </div>
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                className="w-44 bg-transparent text-[11px] outline-none"
                placeholder="Buscar ordem ou provedor..."
                aria-label="Buscar ordens"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              className="native-select"
              aria-label="Filtrar por status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="Todos">Todos os status</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <Button variant="outline" onClick={() => setFilters(!filters)}>
              <SlidersHorizontal data-icon="inline-start" />
              Filtros
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon"
              aria-label="Visualização em lista"
              onClick={() => setView("list")}
            >
              <List />
            </Button>
            <Button
              variant={view === "board" ? "secondary" : "ghost"}
              size="icon"
              aria-label="Visualização Kanban"
              onClick={() => setView("board")}
            >
              <LayoutGrid />
            </Button>
          </div>
        </div>
        {filters && (
          <div className="flex flex-wrap gap-3 border-b border-border bg-muted/40 px-5 py-3">
            <select
              className="native-select"
              aria-label="Filtrar provedor"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="Todos">Todos os provedores</option>
              {providers.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              className="native-select"
              aria-label="Filtrar prioridade"
              value={priority}
              onChange={(e) => { setPriority(e.target.value); setPage(1); }}
            >
              <option value="Todas">Todas as prioridades</option>
              {["Crítica", "Alta", "Normal", "Baixa"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select className="native-select" aria-label="Filtrar tipo de serviço" value={type} onChange={event => { setType(event.target.value); setPage(1); }}><option value="">Todos os tipos</option>{Object.entries(orderTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label className="flex items-center gap-2 text-xs">Criada de<input type="datetime-local" className="native-select" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} /></label><label className="flex items-center gap-2 text-xs">até<input type="datetime-local" className="native-select" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} /></label>
            <Button
              variant="ghost"
              onClick={() => {
                setPage(1); setType(""); setFrom(""); setTo("");
                setStatus("Todos");
                setProvider("Todos");
                setPriority("Todas");
                setSearch("");
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}
        <QueryState loading={source.isLoading} error={source.error} onRetry={() => void source.mutate()} />
        {view === "list" ? (
          <OrdersTable
            orders={filtered}
          />
        ) : (
          <div className="grid auto-cols-[240px] grid-flow-col gap-4 overflow-x-auto p-5">
            {statuses.map((s) => (
              <div key={s} className="rounded-lg bg-muted/60 p-3">
                <div className="mb-4 flex justify-between">
                  <StatusBadge status={s} />
                  <span className="text-xs text-muted-foreground">
                    {filtered.filter((o) => o.status === s).length}
                  </span>
                </div>
                {filtered
                  .filter((o) => o.status === s)
                  .map((o) => (
                    <Link
                      key={o.id}
                      href={orderBase + "/ordens/" + o.id}
                      className="mb-3 block rounded-lg border border-border bg-card p-4"
                    >
                      <p className="text-[9px] text-muted-foreground">{o.id}</p>
                      <p className="my-2 text-xs font-medium leading-relaxed">
                        {o.title}
                      </p>
                      <div className="flex items-center justify-between">
                        <Priority value={o.priority} />
                        <Avatar name={o.analyst} />
                      </div>
                    </Link>
                  ))}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-[10px] text-muted-foreground">
            {total !== undefined ? `${total} ordens · ${filtered.length} nesta página` : `${filtered.length} ordens nesta página`}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft />
            </Button>
            {current} de {pages}
            <Button
              variant="outline"
              size="icon-sm"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>
      {canQuickDispatch && <QuickDispatchDialog open={quickDispatchOpen} onOpenChange={setQuickDispatchOpen} />}
    </>
  );
}
export function OrderDetail({ id, initialTab = "Histórico" }: { id: string; initialTab?: string }) {
  const source = useVisualSource("orders");
  const { scope } = useErp();
  const base = useRouteBase();
  const [tab, setTab] = useState(initialTab);
  const [exportOpen, setExportOpen] = useState(false);
  const order = source.rows.find(row => row.id === id);
  const raw = source.raw.find(row => row.id === id);
  if (!order) return <><PageHeading title="Ordem indisponível" description={`Registro ${id}`} /><QueryState loading={source.isLoading} error={source.error} /><Link href={`${base}/ordens`} className="text-link">Voltar para ordens</Link></>;
  return <>
    <Link href={`${base}/ordens`} className="mb-4 inline-flex items-center gap-2 text-xs text-muted-foreground"><ArrowLeft className="size-3" />Todas as ordens</Link>
    <PageHeading title={String(order.title)} description={`#${order.protocol} · Criada em ${order.date}`}><StatusBadge status={String(order.status)} /><Button variant="outline" onClick={() => setExportOpen(true)}><Printer data-icon="inline-start" />PDF / Imprimir</Button><Button variant="outline" onClick={() => exportCsv(String(order.protocol), ["Protocolo", "Título", "Status", "Descrição"], [[String(order.protocol), String(order.title), String(order.status), String(order.description)]])}><ArrowDownToLine data-icon="inline-start" />Exportar</Button></PageHeading>
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]"><div className="flex min-w-0 flex-col gap-5"><section className="panel"><PanelHeading title="Sobre esta solicitação" /><div className="px-6 pb-6"><p className="whitespace-pre-wrap text-xs leading-7 text-muted-foreground">{String(order.description)}</p><div className="mt-5 flex gap-2"><span className="rounded-md bg-muted px-2 py-1 text-[10px]">{String(order.type)}</span><span className="rounded-md bg-secondary px-2 py-1 text-[10px] text-primary">Atendimento técnico</span></div></div></section><section className="panel"><div className="flex gap-5 overflow-x-auto border-b border-border px-6">{["Resumo", "Histórico", "Anotações", "Anexos", "Editar", "Transição", "Aprovações", "Trabalho", "SLA"].filter(t => !["cliente", "leitura"].includes(scope?.role || (base === "/cliente" ? "cliente" : "")) || ["Resumo", "Histórico", "Anotações", "Anexos"].includes(t)).map(t => <button key={t} onClick={() => setTab(t)} className={cn("whitespace-nowrap border-b-2 py-4 text-xs", tab === t ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground")}>{t}</button>)}</div><div className="p-6"><RecordWorkspace key={`${id}-${tab}`} kind="orders" id={id} base={base} embedded initialTab={tab} /></div></section></div>
    <aside className="panel h-fit"><PanelHeading title="Detalhes do atendimento" /><div className="flex flex-col gap-5 px-6 pb-6"><div><p className="mini-label mb-2">Status da ordem</p><StatusBadge status={String(order.status)} /></div><div><p className="mini-label mb-2">Prioridade</p><Priority value={String(order.priority)} /></div><OperationControl title="Alterar status" description="Informe o próximo status e a justificativa. O ERP valida a transição e a versão atual." path={`/service-orders/${encodeURIComponent(id)}/transition`} method="PATCH" body={{ expectedVersion: raw?.version }} fields={[{ name: "toStatus", label: "Próximo status", options: orderStatuses, required: true }, { name: "reason", label: "Justificativa", type: "textarea", required: true, min: 3 }]} roles={["super_admin", "gerente", "analista", "tecnico"]} after={async () => { await source.mutate(); }} /><div><p className="mini-label mb-2">Provedor</p><span className="text-xs">{String(order.provider)}</span></div><div><p className="mini-label mb-2">Responsável</p><span className="flex items-center gap-2 text-xs"><Avatar name={String(order.analyst)} />{String(order.analyst)}</span></div><div><p className="mini-label mb-2">Prazo SLA</p><p className="flex items-center gap-2 text-xs"><Clock3 className="size-3.5 text-warning" />{String(order.deadline)}</p></div><OperationControl title="Concluir atendimento" description="Confirme a resolução desta ordem. A transição será validada pelo ERP." path={`/service-orders/${encodeURIComponent(id)}/transition`} method="PATCH" body={{ toStatus: "RESOLVIDA", expectedVersion: raw?.version }} fields={[{ name: "reason", label: "Solução aplicada", type: "textarea", min: 3, required: true }]} roles={["super_admin", "gerente", "analista", "tecnico"]} after={async () => { await source.mutate(); }} /><OperationControl title="Emitir pesquisa CSAT" description="Emitir pesquisa para esta ordem." path="/csat/create-for-order" body={{ orderId: id }} roles={["super_admin", "gerente", "analista"]} /></div></aside></div>
    {raw && <OrderExportDialog order={raw} open={exportOpen} onOpenChange={setExportOpen} />}
  </>;
}
