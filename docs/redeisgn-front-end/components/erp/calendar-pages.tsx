"use client";
import { useRouteBase } from "@/lib/erp/visual-data";
import { RecordWorkspace } from "./record-workspace";
import { ScheduleWorkspace } from "./schedule-workspace";
import { OperationControl } from "./operation-controls";
import { useErp } from "@/lib/erp/gateway";
import { queryPath } from "@/lib/erp/contracts";
import { useVisualSource } from "@/lib/erp/visual-data";
import { QueryState } from "./contract-form";
import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Users,
  MapPin,
  ArrowLeft,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PageHeading,
  PanelHeading,
  StatusBadge,
  Avatar,
  Metric,
} from "./primitives";
import { RecordDialog } from "./record-dialog";
import { cn } from "@/lib/utils";
import { OrdersTable } from "./orders";
import { useOrders, useDemoCollection } from "@/lib/demo-store";
const initialEvents = [
  {
    id: 1,
    name: "Alinhamento da operação",
    date: "2026-10-16",
    time: "10:00",
    end: "10:30",
    type: "Reunião de equipe",
  },
  {
    id: 2,
    name: "Manutenção programada",
    date: "2026-10-16",
    time: "14:00",
    end: "15:00",
    type: "Conecta Telecom",
  },
  {
    id: 3,
    name: "Revisão de indicadores",
    date: "2026-10-16",
    time: "16:30",
    end: "17:00",
    type: "Gestão e performance",
  },
  {
    id: 4,
    name: "Instalação empresarial",
    date: "2026-10-19",
    time: "09:00",
    end: "11:00",
    type: "Veloz Fibra",
  },
  {
    id: 5,
    name: "Treinamento BGP",
    date: "2026-10-21",
    time: "14:00",
    end: "16:00",
    type: "Capacitação",
  },
  {
    id: 6,
    name: "Revisão dos SLAs",
    date: "2026-10-23",
    time: "10:00",
    end: "11:00",
    type: "Gestão",
  },
];
export function CalendarPage() {
  const portalBase = useRouteBase();
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [view, setView] = useState("Mês");
  const [selected, setSelected] = useState(() => new Date().getDate());
  const { scope } = useErp();
  const manager = !scope || ["super_admin", "gerente"].includes(scope.role);
  const endpoint = queryPath(view === "Equipe" && manager ? "/calendar/events/all" : "/calendar/events", { from: new Date(year, month, 1).toISOString(), to: new Date(year, month + 1, 1).toISOString() });
  const [events, setEvents] = useDemoCollection("events", initialEvents, endpoint);
  const source = useVisualSource("events", endpoint);
  const [detail, setDetail] = useState<(typeof initialEvents)[number] | null>(
    null,
  );
  const monthName = new Date(year, month).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const count = new Date(year, month + 1, 0).getDate();
  const start = new Date(year, month, 1).getDay();
  const dateKey = (day: number) =>
    year +
    "-" +
    String(month + 1).padStart(2, "0") +
    "-" +
    String(day).padStart(2, "0");
  const selectedEvents = events.filter((e) => e.date === dateKey(selected));
  function move(diff: number) {
    const d = new Date(year, month + diff, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
    setSelected(1);
  }
  return (
    <>
      <PageHeading
        title="Agenda"
        description="Clareza para o seu dia. Organização para toda a equipe."
      >
        <RecordDialog
          title="Novo compromisso"
          fields={[
            { name: "name", label: "Título do compromisso" },
            { name: "date", label: "Data", type: "date", value: "2026-10-16" },
            {
              name: "time",
              label: "Horário de início",
              type: "time",
              value: "09:00",
            },
            {
              name: "end",
              label: "Horário de término",
              type: "time",
              value: "10:00",
            },
            { name: "type", label: "Equipe ou provedor" },
          ]}
          onSave={(v) =>
            setEvents((e) => [
              ...e,
              {
                id: Date.now(),
                name: v.name,
                date: v.date,
                time: v.time,
                end: v.end,
                type: v.type,
              },
            ])
          }
        />
      </PageHeading>
      <div className="grid gap-5 xl:grid-cols-[1fr_260px]">
        <section className="panel min-w-0">
          <div className="panel-head">
            <div className="flex items-center gap-3">
              <h2 className="section-title capitalize">{monthName}</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Mês anterior"
                onClick={() => move(-1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Próximo mês"
                onClick={() => move(1)}
              >
                <ChevronRight />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const today = new Date();
                  setMonth(today.getMonth());
                  setYear(today.getFullYear());
                  setSelected(today.getDate());
                }}
              >
                Hoje
              </Button>
              <select
                className="native-select"
                aria-label="Visualização da agenda"
                value={view}
                onChange={(e) => setView(e.target.value)}
              >
                <option>Mês</option>
                <option>Lista</option>{manager && <option>Equipe</option>}<option>Conflitos</option>
              </select>
            </div>
          </div>
          <QueryState loading={source.isLoading} error={source.error} onRetry={() => void source.mutate()} />
          {view === "Conflitos" ? <ScheduleWorkspace initialTab="conflicts" /> : view === "Mês" ? (
            <div className="overflow-auto">
              <div className="calendar-grid border-t border-border">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                  <div
                    className="border-b border-border py-3 text-center text-[10px] text-muted-foreground"
                    key={d}
                  >
                    {d}
                  </div>
                ))}
                {Array.from(
                  { length: Math.ceil((count + start) / 7) * 7 },
                  (_, i) => {
                    const d = i - start + 1;
                    const valid = d > 0 && d <= count;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "calendar-cell",
                          !valid && "bg-muted/40",
                          valid && d === selected && "bg-secondary/35",
                        )}
                      >
                        <button
                          onClick={() => setSelected(d)}
                          disabled={!valid}
                          className={cn(
                            "flex size-6 items-center justify-center rounded-full text-[11px]",
                            d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground",
                          )}
                          aria-label={
                            valid ? "Selecionar dia " + d : "Fora do mês"
                          }
                        >
                          {valid ? d : ""}
                        </button>
                        {valid &&
                          events
                            .filter((e) => e.date === dateKey(d))
                            .map((e) => (
                              <button
                                key={e.id}
                                className="calendar-event block w-full text-left"
                                onClick={() => {
                                  setSelected(d);
                                  setDetail(e);
                                }}
                              >
                                <span className="block opacity-70">
                                  {e.time}
                                </span>
                                <span className="line-clamp-2">{e.name}</span>
                              </button>
                            ))}
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          ) : (
            <div className="px-6 pb-6">
              {events
                .filter((e) =>
                  e.date.startsWith(
                    year + "-" + String(month + 1).padStart(2, "0"),
                  ),
                )
                .sort(
                  (a, b) =>
                    a.date.localeCompare(b.date) ||
                    a.time.localeCompare(b.time),
                )
                .map((e) => (
                  <button
                    key={e.id}
                    className="flex w-full items-center gap-5 border-b border-border py-4 text-left"
                    onClick={() => setDetail(e)}
                  >
                    <CalendarDays className="size-4 text-primary" />
                    <span className="text-xs text-muted-foreground">
                      {e.date.split("-").reverse().join("/")} · {e.time}
                    </span>
                    <span className="text-xs font-medium">{e.name}</span>
                    <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                  </button>
                ))}
            </div>
          )}
        </section>
        <section className="panel h-fit">
          <PanelHeading
            title={"Dia " + selected}
            description="Compromissos programados"
          />
          <div className="flex flex-col gap-4 px-5 pb-5">
            {selectedEvents.length ? (
              selectedEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setDetail(e)}
                  className="rounded-lg border-l-2 border-primary bg-secondary/45 p-3 text-left"
                >
                  <p className="text-[10px] text-primary">
                    {e.time} – {e.end}
                  </p>
                  <h3 className="mt-2 text-xs font-medium">{e.name}</h3>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {e.type}
                  </p>

                </button>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Seu dia está livre de compromissos.
              </p>
            )}
          </div>
        </section>
      </div>
      {detail && (
        <RecordDialog
          title="Detalhes do compromisso"
          moduleKey="calendar"
          recordId={String(detail.id)}
          record={source.raw.find(row => row.id === String(detail.id))}
          footer={<OperationControl title="Remover compromisso" description="Confirme a remoção deste compromisso da agenda." path={`/calendar/events/${encodeURIComponent(String(detail.id))}`} method="DELETE" after={async () => { await source.mutate(); setDetail(null); }} />}
          open={!!detail}
          onOpenChange={(o) => !o && setDetail(null)}
          fields={[
            { name: "name", label: "Título", value: detail.name },
            { name: "date", label: "Data", type: "date", value: detail.date },
            { name: "time", label: "Início", type: "time", value: detail.time },
            { name: "end", label: "Término", type: "time", value: detail.end },
            { name: "type", label: "Equipe ou provedor", value: detail.type },
          ]}
          onSave={(v) =>
            setEvents((items) =>
              items.map((e) => (e.id === detail.id ? { ...e, ...v } : e)),
            )
          }
        />
      )}
    </>
  );
}
const initialIncidents = [
  {
    id: "INC-0018",
    title: "Rompimento de fibra na região norte",
    provider: "NetMais",
    priority: "Crítica",
    status: "Em análise",
    orders: 5,
    time: "Hoje, 08:55",
  },
  {
    id: "INC-0017",
    title: "Instabilidade no backbone principal",
    provider: "Conecta Telecom",
    priority: "Alta",
    status: "Aberta",
    orders: 3,
    time: "Hoje, 07:40",
  },
  {
    id: "INC-0016",
    title: "Manutenção emergencial no POP Centro",
    provider: "Veloz Fibra",
    priority: "Alta",
    status: "Aguardando campo",
    orders: 2,
    time: "Ontem, 16:20",
  },
  {
    id: "INC-0015",
    title: "Oscilação de energia no datacenter",
    provider: "Linknet",
    priority: "Normal",
    status: "Resolvida",
    orders: 4,
    time: "Ontem, 10:15",
  },
];
export function OccurrencesPage({ id, initialTab = "Resumo" }: { id?: string; initialTab?: string }) {
  const portalBase = useRouteBase();
  const [items, setItems] = useDemoCollection("incidents", initialIncidents);
  const [tab, setTab] = useState(initialTab);
  const { orders } = useOrders();
  const selected = items.find((i) => i.id === id);
  if (id && !selected) return <PageHeading title="Ocorrência indisponível" description={`Registro ${id} não encontrado na consulta atual.`} />;
  if (id && selected)
    return (
      <>
        <Link href={portalBase + "/ocorrencias"} className="mb-4 text-link">
          <ArrowLeft />
          Todas as ocorrências
        </Link>
        <PageHeading
          title={selected.title}
          description={selected.id + " · " + selected.provider}
        >
          <StatusBadge status={selected.status} />
        </PageHeading>
        <div className="mb-6 flex flex-wrap gap-3">{["Resumo", "Editar", "Ordens vinculadas", "Anotações", "Histórico"].map(name => <Button key={name} variant={tab === name ? "secondary" : "outline"} onClick={() => setTab(name)}>{name}</Button>)}</div><section className="panel p-6"><h2 className="section-title mb-5">Acompanhamento do incidente</h2><RecordWorkspace key={`${id}-${tab}`} kind="occurrences" id={id} base={portalBase} embedded initialTab={tab} /></section>
      </>
    );
  return (
    <>
      <PageHeading
        title="Ocorrências"
        description="Do primeiro sinal à resolução. Incidentes sob controle."
      >

        <RecordDialog
          title="Nova ocorrência"
          fields={[
            { name: "title", label: "Título do incidente" },
            {
              name: "provider",
              label: "Provedor",
              options: ["Conecta Telecom", "Veloz Fibra", "NetMais", "Linknet"],
            },
            {
              name: "priority",
              label: "Prioridade",
              options: ["Normal", "Alta", "Crítica"],
            },
            { name: "description", label: "Descrição", type: "textarea" },
          ]}
          onSave={(v) =>
            setItems((i) => [
              {
                id: "INC-" + Date.now(),
                title: v.title,
                provider: v.provider,
                priority: v.priority,
                status: "Aberta",
                orders: 0,
                time: "Agora",
              },
              ...i,
            ])
          }
        />
      </PageHeading>
      <div className="metrics-grid mb-6 grid grid-cols-3 gap-4">
        <Metric
          label="Ocorrências ativas"
          value={String(items.filter((i) => i.status !== "Encerrada").length)}
          icon={Activity}
          change={`${new Set(items.map(item => item.provider)).size} provedores`}
          foot="com incidentes ativos"
        />
        <Metric
          label="Prioridade crítica"
          value={String(items.filter(item => item.priority === "Crítica").length)}
          icon={AlertTriangle}
          change="Atenção"
          foot="requer acompanhamento"
          warning
        />
        <Metric
          label="Ordens impactadas"
          value={String(items.reduce((sum, item) => sum + Number(item.orders || 0), 0))}
          icon={Activity}
          change="Em atendimento"
          foot="pela equipe técnica"
        />
      </div>
      <section className="panel">
        <PanelHeading
          title="Central de incidentes"
          description="Acompanhe eventos que impactam a operação"
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ocorrência</th>
                <th>Provedor</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th>Ordens vinculadas</th>
                <th>Registro</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={(portalBase + "/ocorrencias/") + i.id}>
                      <span className="block text-[9px] text-muted-foreground">
                        {i.id}
                      </span>
                      <strong className="mt-1 block font-medium">
                        {i.title}
                      </strong>
                    </Link>
                  </td>
                  <td>{i.provider}</td>
                  <td>
                    <StatusBadge status={i.priority} />
                  </td>
                  <td>
                    <StatusBadge status={i.status} />
                  </td>
                  <td>{i.orders} ordens</td>
                  <td className="text-muted-foreground">{i.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function ClipboardIcon() {
  return <Activity />;
}
