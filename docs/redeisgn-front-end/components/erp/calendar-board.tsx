"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useErp, useErpAction, useErpQuery } from "@/lib/erp/gateway";
import { queryPath, type ErpRecord } from "@/lib/erp/contracts";
import { modules } from "@/lib/erp/modules";
import { cn } from "@/lib/utils";
import { ContractForm, QueryState, ConnectionNotice } from "./contract-form";
import { PanelHeading } from "./primitives";
import { OperationControl } from "./operation-controls";

function localDay(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function dateOf(value: unknown) { const date = new Date(String(value)); return Number.isFinite(date.getTime()) ? date : null; }
export function CalendarBoard() {
  const { scope } = useErp();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [team, setTeam] = useState(false);
  const [selected, setSelected] = useState<ErpRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const manager = !scope || ["super_admin", "gerente"].includes(scope.role);
  const first = new Date(month.getFullYear(), month.getMonth(), 1 - (month.getDay() + 6) % 7);
  const last = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 42);
  const endpoint = team && manager ? "/calendar/events/all" : "/calendar/events";
  const query = useErpQuery<ErpRecord[]>(queryPath(endpoint, { from: first.toISOString(), to: last.toISOString() }));
  const action = useErpAction();
  const rows = Array.isArray(query.data) ? query.data : [];
  const fields = modules.calendar.fields.filter(field => field.name !== "isGlobal" || manager);
  const days = Array.from({ length: 42 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + index));
  function create(date = localDay(new Date())) { setSelected(null); setDay(date); setOpen(true); }
  return <>
    {!query.connected && <ConnectionNotice />}
    <section className="panel min-w-0">
      <PanelHeading title="Calendário operacional" description="Horários no fuso do seu navegador. Recorrências são exibidas como retornadas pelo ERP.">
        <Button onClick={() => create()}><Plus data-icon="inline-start" />Compromisso</Button>
      </PanelHeading>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button>
          <h3 aria-live="polite" className="min-w-36 text-center text-xs font-medium capitalize">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3>
          <Button variant="outline" size="icon-sm" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</Button>
        </div>
        {manager && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={team} onChange={event => setTeam(event.target.checked)} />Agenda da equipe</label>}
      </div>
      <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.mutate()} />
      <div className="overflow-x-auto" tabIndex={0} aria-label="Calendário mensal">
        <div className="grid min-w-[700px] grid-cols-7 border-t border-border">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(label => <div key={label} className="border-b border-border p-3 text-[10px] text-muted-foreground">{label}</div>)}
          {days.map(date => {
            const key = localDay(date);
            const events = rows.filter(event => {
              const start = dateOf(event.startAt); const end = dateOf(event.endAt) || start;
              return start && end && localDay(start) <= key && (localDay(start) === key || end.getTime() > date.getTime());
            });
            return <section key={key} className={cn("flex min-h-28 min-w-0 flex-col gap-1 border-r border-b border-border p-2", date.getMonth() !== month.getMonth() && "bg-muted/40")} aria-label={date.toLocaleDateString("pt-BR")}>
              <button type="button" onClick={() => create(key)} className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-[10px] focus-visible:outline focus-visible:outline-primary", key === localDay(new Date()) && "bg-primary text-primary-foreground")} aria-label={`Agendar em ${date.toLocaleDateString("pt-BR")}`}>{date.getDate()}</button>
              {events.map(event => <button key={event.id} type="button" className="truncate rounded border border-border bg-secondary px-2 py-1 text-left text-[10px] text-secondary-foreground" onClick={() => { setSelected(event); setOpen(true); }} title={String(event.title)}>{event.allDay ? "Dia inteiro" : dateOf(event.startAt)?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {String(event.title)}</button>)}
            </section>;
          })}
        </div>
      </div>
      <p className="p-5 text-[10px] text-muted-foreground">{query.connected ? `${rows.length} compromissos no intervalo consultado.` : "Calendário sem compromissos: backend não conectado."} Clique no dia para cadastrar ou no compromisso para editar. O servidor verifica autoria e conflitos.</p>
    </section>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{selected ? String(selected.title) : "Novo compromisso"}</DialogTitle><DialogDescription>Datas, vínculos e recorrência seguem o contrato original. Nenhuma alteração é aplicada antes da confirmação do ERP.</DialogDescription></DialogHeader>
      <ContractForm key={selected?.id || day} fields={fields} values={selected || { startAt: `${day}T09:00:00`, endAt: `${day}T10:00:00` }} connected={action.connected} pending={action.pending} onSubmit={async values => { await action.execute({ path: `/calendar/events${selected ? `/${encodeURIComponent(selected.id)}` : ""}`, method: selected ? "PATCH" : "POST", body: values }); await query.mutate(); setOpen(false); toast.success("Compromisso confirmado pelo ERP"); }} />
      {selected && <OperationControl title="Remover compromisso" description="Confirme a remoção do compromisso no ERP. Eventos recorrentes seguem as regras do servidor; não exclui uma série silenciosamente." path={`/calendar/events/${encodeURIComponent(selected.id)}`} method="DELETE" after={async () => { await query.mutate(); setOpen(false); }} />}
    </DialogContent></Dialog>
  </>;
}
