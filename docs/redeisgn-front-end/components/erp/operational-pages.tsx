"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useErpQuery } from "@/lib/erp/gateway";
import { listRecords, useRouteBase, useVisualSource } from "@/lib/erp/visual-data";
import type { ErpRecord } from "@/lib/erp/contracts";
import { PageHeading, PanelHeading, StatusBadge, Avatar, ViewLink } from "./primitives";
import { RecordDialog } from "./record-dialog";
import { OperationControl } from "./operation-controls";
import { QueryState, ErpEmpty } from "./contract-form";
import { FlowReport } from "./reports-workspace";
import { cn } from "@/lib/utils";
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString("pt-BR") : "—";
const userName = (record?: ErpRecord | null) => record?.user && typeof record.user === "object" ? String((record.user as { name?: string }).name || record.userId || "—") : String(record?.userName || record?.userId || "—");
export function OnCallPage() {
  const query = useErpQuery<unknown>("/on-call");
  const current = useErpQuery<ErpRecord | null>("/on-call/current");
  const rows = listRecords(query.data);
  const active = current.data;
  const upcoming = [...rows].filter(row => new Date(String(row.startsAt)).getTime() > Date.now()).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)))[0];
  return <>
    <PageHeading title="Plantão NOC" description="Presença e cobertura para uma operação que não para."><RecordDialog title="Novo plantão" moduleKey="onCall" fields={[]} /></PageHeading>
    <QueryState loading={query.isLoading || current.isLoading} error={query.error || current.error} onRetry={() => { void query.mutate(); void current.mutate(); }} />
    <div className="mb-6 grid gap-5 md:grid-cols-2"><div className="rounded-xl border border-primary/15 bg-secondary/60 p-6"><p className="mini-label text-primary">Plantão atual</p><div className="mt-5 flex flex-wrap items-center gap-4"><Avatar name={userName(active)} className="size-12 bg-card text-sm text-primary" /><div><h2 className="text-lg font-semibold">{active ? userName(active) : "Nenhum plantonista informado"}</h2><p className="mt-1 text-xs text-muted-foreground">{active ? `${date(active.startsAt)} até ${date(active.endsAt)}` : "Aguardando cobertura retornada pelo ERP."}</p></div>{active && <StatusBadge status="Em plantão" />}</div></div><div className="panel p-6"><p className="mini-label">Próxima cobertura</p><div className="mt-5 flex items-center gap-4"><Avatar name={userName(upcoming)} className="size-12 text-sm" /><div><h2 className="text-lg font-semibold">{upcoming ? userName(upcoming) : "Sem escala futura consultada"}</h2><p className="mt-1 text-xs text-muted-foreground">{upcoming ? `${date(upcoming.startsAt)} até ${date(upcoming.endsAt)}` : "Cadastre o próximo período de cobertura."}</p></div></div></div></div>
    <section className="panel"><PanelHeading title="Escalas da equipe" description="Períodos e orientações retornados pelo ERP" /><div className="table-wrap"><table className="data-table"><thead><tr><th>Integrante</th><th>Início</th><th>Fim</th><th>Orientações</th><th>Ações</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><span className="flex items-center gap-3"><Avatar name={userName(row)} />{userName(row)}</span></td><td>{date(row.startsAt)}</td><td>{date(row.endsAt)}</td><td>{String(row.notes || "—")}</td><td><OperationControl title="Remover plantão" description="Remover este período de cobertura do ERP?" path={`/on-call/${encodeURIComponent(row.id)}`} method="DELETE" roles={["super_admin", "gerente"]} after={async () => { await query.mutate(); await current.mutate(); }} /></td></tr>)}</tbody></table></div>{!rows.length && !query.isLoading && !query.error && <ErpEmpty connected={query.connected} />}</section>
  </>;
}
export function OrderTrailPage() {
  const base = useRouteBase();
  const query = useVisualSource("orders");
  const [id, setId] = useState("");
  const selected = id ? query.rows.find(row => row.id === id) : undefined;
  const raw = id ? query.raw.find(row => row.id === id) : undefined;
  const events = Array.isArray(raw?.occurrences) ? raw.occurrences as Record<string, unknown>[] : [];
  return <>
    <PageHeading title="Trilha de ordens" description="Cada etapa visível. Do primeiro contato à entrega."><select className="native-select max-w-full" aria-label="Selecionar ordem" value={id} onChange={event => setId(event.target.value)}><option value="">Selecione uma ordem</option>{query.rows.map(row => <option value={row.id} key={row.id}>{String(row.protocol)} · {String(row.title)}</option>)}</select></PageHeading>
    <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.mutate()} />
    <section className="panel mb-6 p-6">{selected ? <><div className="mb-8 flex flex-wrap justify-between gap-3"><div><p className="text-xs text-muted-foreground">{String(selected.protocol)}</p><h2 className="mt-2 text-lg font-semibold">{String(selected.title)}</h2></div><StatusBadge status={String(selected.status)} /></div><div className="grid gap-4 md:grid-cols-4">{events.map((event, index) => <div key={String(event.id || index)} className={cn("rounded-xl border p-5", "border-primary/20 bg-secondary/50")}><div className="mb-5 flex items-center justify-between"><span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{index + 1}</span><ArrowRight className="size-4 text-muted-foreground" /></div><h3 className="text-xs font-semibold">{String(event.message || event.toStatus || "Atualização")}</h3><p className="mt-3 text-[10px] leading-6 text-muted-foreground">{date(event.createdAt)}</p></div>)}</div>{!events.length && <p className="text-xs text-muted-foreground">Nenhum evento retornado nesta consulta. Abra o histórico completo da ordem.</p>}<div className="mt-7 flex justify-end"><ViewLink href={`${base}/ordens/${encodeURIComponent(id)}/historico`}>Abrir detalhes do atendimento</ViewLink></div></> : <p className="text-xs text-muted-foreground">Selecione uma ordem para consultar seu histórico. Nenhuma outra ordem é escolhida em seu lugar.</p>}</section>
    <FlowReport />
  </>;
}
