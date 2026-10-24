"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useErp, useErpQuery } from "@/lib/erp/gateway";
import { queryPath } from "@/lib/erp/contracts";
import type { FieldSpec } from "@/lib/erp/fields";

const inferred: Record<string, NonNullable<FieldSpec["reference"]>["resource"]> = {
  ownerUserId: "users", assigneeUserId: "users", assigneeId: "users", analystId: "users", userId: "users",
  orderId: "orders", serviceOrderId: "orders", occurrenceId: "occurrences", changeRequestId: "changes",
  tenantId: "tenants", parentEventId: "events", excludeEventId: "events",
};
export function fieldReference(field: FieldSpec): FieldSpec["reference"] {
  if (field.options) return undefined;
  if (field.reference) return field.reference;
  if (field.type === "uuid" && inferred[field.name]) return { resource: inferred[field.name] };
  if (field.name === "sector") return { resource: "sectors", value: "name" };
  if (["ownerName", "analystName", "analystResponsible", "openedByName"].includes(field.name)) return { resource: "users", value: "name" };
  return undefined;
}
export function ReferenceField({ id, field, value }: { id: string; field: FieldSpec; value?: string }) {
  const { scope } = useErp();
  const reference = fieldReference(field)!;
  const [search, setSearch] = useState("");
  const [remoteSearch, setRemoteSearch] = useState("");
  const [selected, setSelected] = useState(value || "");
  useEffect(() => {
    const form = document.getElementById(id)?.closest("form");
    const reset = () => { setSelected(value || ""); setSearch(""); setRemoteSearch(""); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [id, value]);
  const paths = { users: "/calendar/users", orders: "/service-orders", occurrences: "/service-orders/occurrences", changes: "/change-management", tenants: "/iam/tenants", events: "/calendar/events", sectors: `/iam/tenants/${scope?.tenantId}/sectors` };
  const paginated = reference.resource === "orders" || reference.resource === "occurrences";
  const path = queryPath(paths[reference.resource], paginated ? { limit: 50, offset: 0, ...(remoteSearch ? { search: remoteSearch } : {}) } : {});
  const allowed = reference.resource !== "tenants" || !scope || ["super_admin", "gerente", "cliente"].includes(scope.role);
  const query = useErpQuery<unknown>(allowed ? path : null);
  const data = Array.isArray(query.data) ? query.data : query.data && typeof query.data === "object" && "items" in query.data && Array.isArray(query.data.items) ? query.data.items : [];
  const options = data.flatMap((row: unknown) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    if (typeof record.id !== "string") return [];
    const label = [record.protocol || record.number, record.title || record.tradeName || record.name, record.email].filter(value => typeof value === "string" || typeof value === "number").join(" · ") || record.id;
    const optionValue = reference.value === "name" ? record.name : record.id;
    return typeof optionValue === "string" ? [{ value: optionValue, label }] : [];
  });
  const filtered = options.filter(option => `${option.label} ${option.value}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  if (!query.connected || !allowed) return <div className="flex flex-col gap-2"><Input id={id} name={field.name} required={field.required} defaultValue={value} placeholder={field.type === "uuid" ? "UUID do registro no ERP" : undefined} /><p className="text-[10px] text-muted-foreground">{!query.connected ? "Busca por nome disponível após conectar o ERP. Não há opções fictícias." : "Seu perfil não pode consultar esta lista."}</p></div>;
  if (reference.value === "name") return <div className="flex flex-col gap-2"><Input id={id} name={field.name} required={field.required} minLength={field.min} maxLength={field.max} list={`${id}-suggestions`} value={selected} onChange={event => setSelected(event.target.value)} /><datalist id={`${id}-suggestions`}>{Array.from(new Set(options.map(option => option.value))).map(name => <option key={name} value={name} />)}</datalist><p className="text-[10px] text-muted-foreground">Sugestões da empresa ativa. Este contrato envia o nome textual; você pode informar outro valor.</p></div>;
  return <div className="flex flex-col gap-2">
    <div className="flex gap-2"><Input aria-label={`Buscar opções de ${field.label}`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Filtrar por nome ou protocolo" />{paginated && <Button type="button" variant="outline" size="sm" disabled={query.isLoading || (!!search && search.trim().length < 2)} onClick={() => { setRemoteSearch(search.trim()); setSearch(""); }}>Buscar no ERP</Button>}</div>
    <select id={id} name={field.name} className="native-select w-full" required={field.required} value={selected} onChange={event => setSelected(event.target.value)} aria-describedby={`${id}-state`}>
      <option value="">{query.isLoading ? "Carregando opções…" : "Selecione um registro"}</option>
      {selected && !filtered.some(option => option.value === selected) && <option value={selected}>{options.find(option => option.value === selected)?.label || `Vínculo atual · ${selected}`}</option>}
      {filtered.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <p id={`${id}-state`} className="text-[10px] text-muted-foreground" role="status">{query.error ? "Não foi possível buscar as opções. Tente novamente." : query.isLoading ? "Consultando registros autorizados." : `${filtered.length} opções${paginated ? " · até 50 por busca; refine por nome ou protocolo" : ""}. O formulário envia o identificador original.`}</p>
    {query.error && <Button type="button" variant="ghost" size="sm" onClick={() => void query.mutate()}>Recarregar opções</Button>}
  </div>;
}
