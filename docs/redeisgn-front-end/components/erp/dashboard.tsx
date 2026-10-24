"use client";
import { useRouteBase, useVisualSource, listRecords } from "@/lib/erp/visual-data";
import { useErp, useErpQuery } from "@/lib/erp/gateway";
import type { ErpRecord } from "@/lib/erp/contracts";
import { QueryState, ErpEmpty } from "./contract-form";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Clock3,
  CheckCircle2,
  Timer,
  MoreHorizontal,
  Plus,
  ArrowDownToLine,
  Sun,
  ShieldCheck,
  UserRound,
  BookOpen,
  CirclePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrders, exportCsv } from "@/lib/demo-store";
import {
  PageHeading,
  Metric,
  PanelHeading,
  ViewLink,
  Avatar,
} from "./primitives";
import {
  Sparkline,
  VolumeChart,
  StatusChart,
  useStatusData,
} from "./dashboard-charts";
import { OrdersTable } from "./orders";
import { OrderForm } from "./order-form";
import { cn } from "@/lib/utils";
export function Dashboard({ analyst = false }: { analyst?: boolean }) {
  const portalBase = useRouteBase();
  const [period, setPeriod] = useState("month");
  const [tab, setTab] = useState("recent");
  const { orders } = useOrders();
  const [orderOpen, setOrderOpen] = useState(false);
  const { scope } = useErp();
  const manager = !scope || ["super_admin", "gerente"].includes(scope.role);
  const daysBack = period === "week" ? 7 : period === "quarter" ? 90 : 30;
  const kpi = useErpQuery<{ overview?: Record<string, unknown> }>(manager ? `/reports/manager-kpi?daysBack=${daysBack}` : null);
  const me = useErpQuery<{ user?: { name?: string }; name?: string }>("/auth/me");
  const agenda = useErpQuery<unknown>(manager ? "/dashboards/agenda-overview" : "/calendar/events");
  const activity = useErpQuery<unknown>(manager ? "/audit/logs?page=1&limit=3" : null);
  const providerSource = useVisualSource("providers");
  const providers = providerSource.rows.map(row => ({ id: row.id, name: String(row.name), initials: String(row.initials), sla: row.sla === "—" ? null : Number(row.sla) }));
  const orderSource = useVisualSource("orders");
  const statusData = useStatusData();
  const overview = kpi.data?.overview;
  const activities = listRecords(activity.data).map(row => ({ subject: String(row.resourceId || row.id), name: String(row.actorUserId || "ERP"), action: String(row.action || ""), time: row.createdAt ? new Date(String(row.createdAt)).toLocaleString("pt-BR") : "—", path: row.resourceType === "service_order" ? `${portalBase}/ordens/${encodeURIComponent(String(row.resourceId))}` : `${portalBase}/auditoria` }));
  const events = listRecords(agenda.data).map(row => ({ hour: new Date(String(row.startAt || row.start)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), end: row.endAt ? new Date(String(row.endAt)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "", name: String(row.title), type: String(row.type || row.source || "Compromisso"), color: "bg-primary" }));
  return (
    <>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Sun className="size-3.5 text-warning" />
        {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
      <PageHeading
        title={me.data?.user?.name || me.data?.name ? `Seu dia começa por aqui, ${(me.data?.user?.name || me.data?.name)!.split(" ")[0]}.` : analyst ? "Seu dia começa por aqui." : "Visão geral da sua operação."}
        description="Tudo o que você precisa para manter sua operação no melhor ritmo."
      >
        <select
          className="native-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="Período do dashboard"
        >
          <option value="month">Últimos 30 dias</option>
          <option value="week">Últimos 7 dias</option>
          <option value="quarter">Últimos 3 meses</option>
        </select>
        <Button onClick={() => setOrderOpen(true)}>
          <Plus data-icon="inline-start" />
          Nova ordem de serviço
        </Button>
      </PageHeading>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/10 bg-secondary/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-3.5" />
          </span>
          <p className="text-[11px] text-primary">
            <strong className="font-semibold">
              Acompanhe a saúde da sua operação.
            </strong>
            <span className="ml-1 hidden sm:inline">
              Indicadores retornados pelo ERP e ordens consultadas.
            </span>
          </p>
        </div>
        <Link href={portalBase + "/saude"} className="text-link">
          Ver saúde operacional
          <ArrowRight />
        </Link>
      </div>
      <div className="metrics-grid mb-6 grid grid-cols-4 gap-4">
        <Metric
          label="Ordens em aberto"
          value={String(overview?.totalOpen ?? "—")}
          icon={ClipboardList}
          change="ERP"
          foot="no período consultado"
        >
          <Sparkline />
        </Metric>
        <Metric
          label="Concluídas no período"
          value={String(overview?.totalClosed ?? "—")}
          icon={CheckCircle2}
          change="ERP"
          foot="no período consultado"
        >
          <Sparkline variant={1} />
        </Metric>
        <Metric
          label="Tempo médio de resolução"
          value={overview?.tmrHours !== undefined ? `${overview.tmrHours} h` : "—"}
          icon={Clock3}
          change="ERP"
          foot="média retornada pelo servidor"
        >
          <Sparkline variant={2} />
        </Metric>
        <Metric
          label="Cumprimento de SLA"
          value={overview?.slaPercentage !== undefined ? `${overview.slaPercentage}%` : "—"}
          icon={Timer}
          change="ERP"
          foot="indicador retornado pelo servidor"
        >
          <Sparkline variant={3} />
        </Metric>
      </div>
      <div className="dashboard-mid mb-6 grid grid-cols-[minmax(0,1.9fr)_minmax(260px,1fr)] gap-5">
        <section className="panel">
          <PanelHeading
            title="Evolução dos atendimentos"
            description="Visibilidade para acompanhar o ritmo da sua operação."
          >
            <div className="hidden items-center gap-4 sm:flex">
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <i className="size-1.5 rounded-full bg-primary" />
                Abertas
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <i className="size-1.5 rounded-full bg-chart-2" />
                Concluídas
              </span>
            </div>
          </PanelHeading>
          <div className="px-5 pb-3">
            <VolumeChart period={period} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <span className="text-[10px] text-muted-foreground">
              Volume por criação e situação atual das ordens consultadas
            </span>
            <ViewLink href={portalBase + "/relatorios"}>
              Ver relatório completo
            </ViewLink>
          </div>
        </section>
        <section className="panel">
          <PanelHeading title="Ordens por status">
            <Link
              href={portalBase + "/ordens"}
              aria-label="Ver todas as ordens"
              className="text-muted-foreground"
            >
              <MoreHorizontal className="size-4" />
            </Link>
          </PanelHeading>
          <StatusChart />
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 px-6 pt-3 pb-6">
            {statusData.map((s) => (
              <Link
                key={s.name}
                href={
                  (portalBase + "/ordens?status=") +
                  encodeURIComponent(s.name)
                }
                className="flex items-center gap-2"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {s.name}
                </span>
                <strong className="ml-auto text-[11px] font-medium">
                  {s.value}
                </strong>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="dashboard-bottom mb-6 grid grid-cols-[minmax(0,1fr)_280px] gap-5">
        <section className="panel min-w-0">
          <PanelHeading
            title="Ordens de serviço"
            description="Os atendimentos que precisam do seu olhar."
          >
            <ViewLink href={portalBase + "/ordens"}>Ver todas</ViewLink>
          </PanelHeading>
          <div className="flex gap-5 px-5">
            {[
              { id: "recent", label: "Mais recentes" },
              { id: "critical", label: "Prioritárias", count: String(orders.filter(order => ["Alta", "Crítica"].includes(order.priority)).length) },
              { id: "mine", label: "Minhas ordens" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 pb-3 text-[10px]",
                  tab === t.id
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground",
                )}
              >
                {t.label}
                {t.count && (
                  <span className="rounded bg-warning/10 px-1.5 text-[9px] text-warning">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <OrdersTable
            compact
            orders={(tab === "critical"
              ? orders.filter((o) => ["Alta", "Crítica"].includes(o.priority))
              : tab === "mine"
                ? orders.filter(order => !!scope && orderSource.raw.some(raw => raw.id === order.id && (raw.assigneeUserId === scope.userId || raw.ownerUserId === scope.userId)))
                : orders
            ).slice(0, 4)}
          />
        </section>
        <section className="panel">
          <PanelHeading title="Sua agenda" description="Próximos compromissos retornados pelo ERP">
            <Link
              href={portalBase + "/agenda"}
              aria-label="Abrir agenda"
              className="text-muted-foreground"
            >
              <CalendarDays className="size-4" />
            </Link>
          </PanelHeading>
          <div className="flex flex-col gap-5 px-5 pb-4">
            <QueryState loading={agenda.isLoading} error={agenda.error} />{!events.length && !agenda.isLoading && !agenda.error && <ErpEmpty connected={agenda.connected} />}
            {events.slice(0, 5).map((e, i) => (
              <Link key={e.name} href={portalBase + "/agenda"} className="flex gap-3">
                <div className="w-9 shrink-0 text-[10px]">
                  <p className="font-medium">{e.hour}</p>
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    {e.end}
                  </p>
                </div>
                <div className={cn("w-[2px] shrink-0 rounded-full", e.color)} />
                <div>
                  <h3 className="text-[11px] font-medium leading-relaxed">
                    {e.name}
                  </h3>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {e.type}
                  </p>

                </div>
              </Link>
            ))}
          </div>
          <div className="mx-5 border-t border-border pt-3 pb-4">
            <ViewLink href={portalBase + "/agenda"}>Ver agenda completa</ViewLink>
          </div>
        </section>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="panel">
          <PanelHeading title="Atividade recente">
            <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <i className="size-1 rounded-full bg-success" />
              Na operação
            </span>
          </PanelHeading>
          <div className="flex flex-col gap-4 px-5 pb-5">
            <QueryState loading={activity.isLoading} error={activity.error} />{!activities.length && !activity.isLoading && !activity.error && <ErpEmpty connected={activity.connected} />}
            {activities.slice(0, 3).map((a, i) => {
              const Icon =
                i === 0 ? CheckCircle2 : i === 1 ? UserRound : CirclePlus;
              return (
                <div key={a.subject} className="flex items-center gap-3">
                  <span className="activity-dot">
                    <Icon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] leading-relaxed">
                      <strong className="font-medium">{a.name}</strong>
                      <span className="text-muted-foreground">
                        {" "}
                        {a.action}{" "}
                      </span>
                      <Link
                        href={a.path}
                        className="text-primary"
                      >
                        {a.subject}
                      </Link>
                    </p>
                  </div>
                  <span className="shrink-0 text-[9px] text-muted-foreground">
                    {a.time}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <PanelHeading title="Performance dos provedores">
            <ViewLink href={portalBase + "/provedores"}>Ver provedores</ViewLink>
          </PanelHeading>
          <div className="flex flex-col gap-4 px-5 pb-5">
            {providers.slice(0, 3).map((p) => (
              <Link
                href={(portalBase + "/provedores/") + p.id}
                key={p.id}
                className="flex items-center gap-3"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-[9px] font-medium text-primary">
                  {p.initials}
                </span>
                <span className="w-28 text-[10px]">{p.name}</span>
                <div className="progress-track flex-1">
                  <span style={{ width: `${p.sla ?? 0}%` }} />
                </div>
                <span className="w-9 text-right text-[10px] font-medium">
                  {p.sla === null ? "—" : `${p.sla.toLocaleString("pt-BR")}%`}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <OrderForm open={orderOpen} onOpenChange={setOrderOpen} />
    </>
  );
}
