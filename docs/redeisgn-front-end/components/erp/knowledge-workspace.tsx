"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ResourcePage, displayValue } from "./resource-page";
import { SecretReveal } from "./secret-reveal";
import type { ErpRecord } from "@/lib/erp/contracts";
export function KnowledgeWorkspace({ kind, base }: { kind: "articles" | "credentials" | "notes"; base: string }) {
  const [selected, setSelected] = useState<ErpRecord | null>(null);
  return <>
    <ResourcePage moduleKey={kind} base={base} rowActions={row => kind === "credentials" ? <SecretReveal recordId={row.id} title={String(row.provider)} path={`/knowledge/credentials/${encodeURIComponent(row.id)}/reveal`} field="secret" /> : <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>Ler conteúdo</Button>} />
    <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{String(selected?.title || "Conteúdo")}</DialogTitle><DialogDescription>{kind === "articles" ? "Artigo da base de conhecimento do ERP." : "Nota pessoal do usuário autenticado."}</DialogDescription></DialogHeader><article className="whitespace-pre-wrap break-words text-sm leading-7">{displayValue(selected?.content)}</article><p className="text-xs text-muted-foreground">{displayValue(selected?.tags)} · {displayValue(selected?.updatedAt)}</p></DialogContent></Dialog>
  </>;
}
