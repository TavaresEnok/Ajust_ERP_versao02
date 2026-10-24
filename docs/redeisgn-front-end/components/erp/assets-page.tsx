"use client";
import { useState } from "react";
import Link from "next/link";
import { Server, Search, ArrowLeft, Camera, HardDrive, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVisualSource, useRouteBase } from "@/lib/erp/visual-data";
import { PageHeading, PanelHeading, StatusBadge, Metric } from "./primitives";
import { RecordDialog } from "./record-dialog";
import { CmdbWorkspace } from "./cmdb-workspace";
import { QueryState, ErpEmpty } from "./contract-form";
export function AssetsPage({ id, initialTab = "Informações" }: { id?: string; initialTab?: string }) {
  const query = useVisualSource("assets");
  const assets = query.rows;
  const base = useRouteBase();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(initialTab);
  const selected = assets.find(a => a.id === id);
  const raw = query.raw.find(a => a.id === id);
  if (id && !selected) return <><PageHeading title={query.isLoading ? "Carregando ativo" : "Ativo indisponível"} description={`Registro ${id}`} /><QueryState loading={query.isLoading} error={query.error} /><Link href={`${base}/ativos`} className="text-link">Todos os ativos</Link></>;
  if (selected) return <>
    <Link href={`${base}/ativos`} className="mb-4 text-link"><ArrowLeft />Todos os ativos</Link>
    <PageHeading title={String(selected.name)} description={`${selected.provider} · ${selected.type}`}><StatusBadge status={String(selected.status)} /><RecordDialog title="Editar ativo" moduleKey="assets" recordId={id} record={raw} fields={[]} /><Button onClick={() => setTab("Novo snapshot")}><Camera data-icon="inline-start" />Registrar snapshot</Button></PageHeading>
    <div className="mb-6 flex flex-wrap gap-3">{["Informações", "Snapshots", "Comparar configurações", "Vincular ordem"].map(t => <Button key={t} variant={tab === t ? "secondary" : "outline"} onClick={() => setTab(t)}>{t}</Button>)}</div>
    {tab === "Informações" ? <section className="panel p-6"><h2 className="section-title">Dados do equipamento</h2><dl className="mt-6 grid gap-6 sm:grid-cols-2">{[["Modelo / fabricante", selected.model], ["Tipo", selected.type], ["Endereço IP", selected.address], ["Localização", raw?.location], ["Número de série", raw?.serialNumber], ["Status", selected.status], ["Contrato", raw?.contractEnd], ["Descrição", raw?.description]].map(([k,v]) => <div key={String(k)}><dt className="mini-label">{String(k)}</dt><dd className="mt-2 whitespace-pre-wrap text-sm">{String(v || "—")}</dd></div>)}</dl></section> : <CmdbWorkspace key={`${id}-${tab}`} initialAssetId={id} embedded initialTab={tab === "Comparar configurações" ? "Comparação" : tab} />}
  </>;
  return <>
    <PageHeading title="Ativos e configurações" description="Inventário organizado. Configurações com histórico."><RecordDialog title="Novo ativo" moduleKey="assets" fields={[]} /></PageHeading>
    <div className="metrics-grid mb-6 grid grid-cols-3 gap-4"><Metric label="Ativos cadastrados" value={String(assets.length)} icon={Server} change="Inventário" foot="registros consultados" /><Metric label="Configurações salvas" value="—" icon={HardDrive} change="Histórico" foot="consulte as versões do ativo" /><Metric label="Última verificação" value="—" icon={ShieldCheck} change="Por ativo" foot="consulte os snapshots" /></div>
    <section className="panel"><PanelHeading title="Inventário CMDB"><div className="flex items-center gap-2"><Search className="size-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar ativo" placeholder="Buscar ativo..." className="w-36 bg-transparent text-xs outline-none" /></div></PanelHeading><QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.mutate()} /><div className="table-wrap"><table className="data-table"><thead><tr><th>Equipamento</th><th>Tipo</th><th>Provedor</th><th>Endereço IP</th><th>Status</th><th>Snapshots</th></tr></thead><tbody>{assets.filter(a => `${a.name} ${a.provider}`.toLowerCase().includes(search.toLowerCase())).map(a => <tr key={a.id}><td><Link href={`${base}/ativos/${encodeURIComponent(a.id)}`} className="flex items-center gap-2 font-medium"><Server className="size-4 text-primary" />{String(a.name)}</Link></td><td>{String(a.type)}</td><td>{String(a.provider)}</td><td className="font-mono text-muted-foreground">{String(a.address)}</td><td><StatusBadge status={String(a.status)} /></td><td>{String(a.snapshots)} versões</td></tr>)}</tbody></table></div>{!assets.length && !query.isLoading && !query.error && <ErpEmpty connected={query.connected} />}</section>
  </>;
}
