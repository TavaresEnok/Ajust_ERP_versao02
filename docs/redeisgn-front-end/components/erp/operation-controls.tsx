"use client";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useErp, useErpAction } from "@/lib/erp/gateway";
import { errorMessage, type HttpMethod, type RoleCode } from "@/lib/erp/contracts";
import type { FieldSpec } from "@/lib/erp/fields";
import { ContractForm } from "./contract-form";
export function OperationControl({ title, description, path, method = "POST", fields = [], body, roles, after, children }: { title: string; description: string; path: string; method?: HttpMethod; fields?: FieldSpec[]; body?: Record<string, unknown>; roles?: RoleCode[]; after?: (response: unknown) => void | Promise<unknown>; children?: ReactNode }) {
  const { scope } = useErp();
  const action = useErpAction();
  const [open, setOpen] = useState(false);
  const allowed = !scope || !roles || roles.includes(scope.role);
  if (!allowed) return null;
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}>{title}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}<ContractForm fields={fields} connected={action.connected} pending={action.pending} label="Confirmar no ERP" onSubmit={async values => { try { const response = await action.execute({ path, method, body: fields.length || body ? { ...values, ...body } : undefined }); setOpen(false); await after?.(response); toast.success("Operação confirmada pelo ERP"); } catch (error) { throw new Error(errorMessage(error)); } }} /></DialogContent></Dialog></>;
}
