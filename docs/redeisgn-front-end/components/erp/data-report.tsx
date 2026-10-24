"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { useErp, useErpQuery } from "@/lib/erp/gateway";
import { queryPath, type RoleCode } from "@/lib/erp/contracts";
import { type FieldSpec, parseFields } from "@/lib/erp/fields";
import { ContractFields, ErpEmpty, QueryState } from "./contract-form";
import { PanelHeading } from "./primitives";
import { displayValue } from "./resource-page";
import { ReportChart, type ReportChartSpec } from "./report-chart";
const ReportFlowGraph = dynamic(() => import("./report-flow-graph").then(module => module.ReportFlowGraph), { ssr: false });
export type ReportColumn = { key: string; label: string };
export function atPath(data: unknown, path: string): unknown { return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, data); }
export function ReportTable({ data, columns }: { data: unknown[]; columns: ReportColumn[] }) { return <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{data.map((row, index) => <tr key={String(atPath(row, "id") || index)}>{columns.map(column => <td className="max-w-md whitespace-normal break-words" key={column.key}>{displayValue(atPath(row, column.key))}</td>)}</tr>)}</tbody></table></div>; }
export function DataReport({ title, path, fields = [], roles, tables = [], metrics = [], charts = [], flow = false }: { title: string; path: string; fields?: FieldSpec[]; roles?: RoleCode[]; tables?: { key?: string; title?: string; columns: ReportColumn[] }[]; metrics?: { key: string; label: string }[]; charts?: ReportChartSpec[]; flow?: boolean }) {
  const { scope } = useErp();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const allowed = !scope || !roles || roles.includes(scope.role);
  const query = useErpQuery<unknown>(allowed ? queryPath(path, filters) : null);
  if (!allowed) return <p className="text-xs text-muted-foreground">Consulta não disponível para seu perfil.</p>;
  return <section className="panel"><PanelHeading title={title} description="Consulta ao ERP original · sem valores demonstrativos" />{fields.length > 0 && <form className="flex flex-col gap-4 px-6 pb-5" onSubmit={event => { event.preventDefault(); setError(""); try { const values = parseFields(fields, new FormData(event.currentTarget)); setFilters(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]))); } catch (error) { setError((error as Error).message); } }}><ContractFields fields={fields} />{error && <p role="alert" className="text-xs text-danger">{error}</p>}<div className="flex flex-wrap gap-3"><Button type="submit" variant="outline">Aplicar período e filtros</Button><Button type="reset" variant="ghost" onClick={() => { setFilters({}); setError(""); }}>Limpar</Button></div></form>}<QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.mutate()} />{!query.isLoading && !query.error && (query.data === undefined || query.data === null ? <ErpEmpty connected={query.connected} /> : <>{metrics.length > 0 && <dl className="grid gap-4 px-6 pb-6 sm:grid-cols-3">{metrics.map(metric => <div key={metric.key} className="rounded-lg border border-border p-4"><dt className="mb-3 text-[10px] text-muted-foreground">{metric.label}</dt><dd className="text-2xl font-semibold tracking-tight">{displayValue(atPath(query.data, metric.key))}</dd></div>)}</dl>}{flow && <ReportFlowGraph data={query.data} />}{charts.map((spec, index) => <ReportChart key={index} spec={spec} data={spec.key ? atPath(query.data, spec.key) : query.data} />)}{tables.map((table, index) => { const rows = table.key ? atPath(query.data, table.key) : query.data; return <div key={index}>{table.title && <h3 className="section-title px-6 pb-4">{table.title}</h3>}{Array.isArray(rows) && rows.length ? <ReportTable data={rows} columns={table.columns} /> : <ErpEmpty connected={query.connected} />}</div>; })}</>)}<div className="flex justify-end border-t border-border p-4"><Button variant="ghost" size="sm" disabled={!query.connected || query.isLoading} onClick={() => void query.mutate()}>Atualizar consulta</Button></div></section>;
}
