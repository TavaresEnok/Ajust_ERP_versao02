"use client";
import { useState, type ComponentProps } from "react";
import { useErp, useErpQuery } from "@/lib/erp/gateway";
import { orderTypes, priorities } from "@/lib/erp/contracts";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ContractForm, QueryState } from "./contract-form";

export function OrderContractForm(props: ComponentProps<typeof ContractForm>) {
  const { scope } = useErp();
  const allowed = !scope || ["super_admin", "gerente", "analista", "cliente", "leitura"].includes(scope.role);
  const catalog = useErpQuery<unknown>(allowed ? "/service-catalog?activeOnly=true" : null);
  const [selected, setSelected] = useState("");
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const services = Array.isArray(catalog.data) ? catalog.data.filter((row): row is Record<string, unknown> & { id: string; name: string } => !!row && typeof row === "object" && typeof row.id === "string" && typeof row.name === "string") : [];
  const service = services.find(row => row.id === selected);
  const values = { ...props.values, ...(service ? { title: service.name, description: typeof service.description === "string" ? service.description : undefined, ...(typeof service.category === "string" && service.category in orderTypes ? { type: service.category } : {}), ...(typeof service.defaultPriority === "string" && service.defaultPriority in priorities ? { priority: service.defaultPriority } : {}) } : {}) };
  return <div className="flex flex-col gap-5">
    {allowed && <Field><FieldLabel htmlFor="order-catalog">Começar pelo catálogo de serviços</FieldLabel><select id="order-catalog" className="native-select w-full" value={selected} disabled={!catalog.connected || catalog.isLoading} onChange={event => { if (selected !== event.target.value) setPendingSelection(event.target.value); }}><option value="">Preenchimento manual</option>{services.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select><FieldDescription>{catalog.connected ? "Preenche título, descrição, tipo e prioridade; você pode ajustar antes de enviar. O contrato de OS não recebe serviceCatalogId." : "Os serviços da empresa aparecerão após conectar o ERP. O preenchimento manual permanece disponível."}</FieldDescription></Field>}
    <QueryState loading={catalog.isLoading} error={catalog.error} onRetry={() => void catalog.mutate()} />
    {service && <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Estimativa do catálogo: {typeof service.estimatedMinutes === "number" ? `${service.estimatedMinutes} min` : "não informada"}</p>{Array.isArray(service.checklist) && <><h3 className="section-title mt-3 mb-2">Checklist de referência</h3><ul className="flex flex-col gap-1 text-xs">{service.checklist.filter((item): item is string => typeof item === "string").map((item, index) => <li key={index}>{item}</li>)}</ul></>}</div>}
    <ContractForm {...props} key={selected || "manual"} values={values} />
    <Dialog open={pendingSelection !== null} onOpenChange={open => !open && setPendingSelection(null)}><DialogContent><DialogHeader><DialogTitle>Aplicar serviço ao rascunho?</DialogTitle><DialogDescription>Trocar o serviço reinicia os campos deste rascunho com os valores do catálogo. Nada será enviado ao ERP nesta etapa.</DialogDescription></DialogHeader><div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setPendingSelection(null)}>Manter preenchimento</Button><Button type="button" onClick={() => { setSelected(pendingSelection || ""); setPendingSelection(null); }}>Reiniciar com este serviço</Button></div></DialogContent></Dialog>
  </div>;
}
