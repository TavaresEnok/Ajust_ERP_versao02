"use client";

import { useState } from "react";
import { Check, Copy, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ErpRecord } from "@/lib/erp/contracts";
import { errorMessage } from "@/lib/erp/contracts";
import { useErp, useErpAction } from "@/lib/erp/gateway";

function text(value: unknown, fallback = "Não informado") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function date(value: unknown) {
  if (typeof value !== "string" || !value) return "Não informado";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Não informado" : parsed.toLocaleString("pt-BR");
}

export function OrderExportDialog({ order, open, onOpenChange }: { order: ErpRecord; open: boolean; onOpenChange: (open: boolean) => void }) {
  const action = useErpAction();
  const { scope } = useErp();
  const canDispatch = !!scope && ["super_admin", "gerente", "analista", "tecnico"].includes(scope.role);
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const protocol = text(order.protocol, order.id);
  const title = text(order.title, "Ordem de serviço");
  const description = text(order.description, "Sem descrição pública.");
  const tenant = order.tenant && typeof order.tenant === "object" ? order.tenant as Record<string, unknown> : undefined;
  const requester = text(order.requester || order.tenantName || tenant?.name);
  const status = text(order.status);
  const type = text(order.type);
  const priority = text(order.priority);
  const deadline = date(order.deadlineAt);
  const analyst = text(order.analystName || order.ownerName);

  function summary() {
    return [
      `Ordem de serviço #${protocol}`,
      `Título: ${title}`,
      `Solicitante: ${requester}`,
      `Tipo: ${type} · Prioridade: ${priority}`,
      `Status: ${status}`,
      `Prazo informado pelo ERP: ${deadline}`,
      `Responsável: ${analyst}`,
      `Descrição: ${description}`,
    ].join("\n");
  }

  async function copySummary() {
    setError("");
    try {
      await navigator.clipboard.writeText(summary());
      setCopied(true);
      toast.success("Resumo copiado para compartilhar");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Não foi possível acessar a área de transferência neste navegador.");
    }
  }

  async function requestDispatch() {
    setError("");
    setSent(false);
    try {
      await action.execute({
        path: "/notifications/whatsapp/dispatch-order",
        method: "POST",
        body: { orderId: order.id, ...(target.trim() ? { target: target.trim() } : {}) },
      });
      setSent(true);
      toast.success("Solicitação encaminhada ao ERP. A entrega depende do canal configurado.");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl print-order-dialog">
        <DialogHeader>
          <DialogTitle>Exportar e compartilhar ordem</DialogTitle>
          <DialogDescription>Imprima ou salve como PDF pelo navegador. O resumo compartilhável não inclui anotações internas.</DialogDescription>
        </DialogHeader>
        <article className="service-order-print rounded-lg border border-border bg-card p-6 text-foreground sm:p-9">
          <header className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
            <div>
              <p className="mini-label">Ajust ERP · Ordem de serviço</p>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Protocolo #{protocol}</p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className="rounded-md bg-secondary px-3 py-1 text-xs font-medium text-primary">{status}</span>
              <span className="text-xs text-muted-foreground">{date(order.createdAt)}</span>
            </div>
          </header>
          <section className="mt-6 grid gap-5 sm:grid-cols-2">
            {[
              ["Solicitante", requester],
              ["Tipo de serviço", type],
              ["Prioridade", priority],
              ["Responsável", analyst],
              ["Prazo retornado pelo ERP", deadline],
              ["Setor", text(order.sector)],
            ].map(([label, value]) => (
              <div key={label} className="border-b border-border pb-3">
                <p className="mini-label">{label}</p>
                <p className="mt-2 text-sm">{value}</p>
              </div>
            ))}
          </section>
          <section className="mt-7">
            <h2 className="section-title">Descrição</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{description}</p>
          </section>
          <footer className="mt-9 border-t border-border pt-4 text-[10px] text-muted-foreground">
            Documento gerado a partir dos dados retornados pelo Ajust ERP.
          </footer>
        </article>
        <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer data-icon="inline-start" />Imprimir / Salvar PDF
            </Button>
            <Button type="button" variant="outline" onClick={copySummary}>
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copied ? "Resumo copiado" : "Copiar resumo"}
            </Button>
          </div>
          <Field>
            <FieldLabel htmlFor="order-share-target">Destino do WhatsApp (opcional)</FieldLabel>
            <Input id="order-share-target" value={target} onChange={(event) => setTarget(event.target.value)} maxLength={255} placeholder="Número ou destino configurado" autoComplete="off" />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={requestDispatch} disabled={!action.connected || !canDispatch || action.pending}>
              <Send data-icon="inline-start" />
              {action.pending ? "Solicitando envio..." : "Solicitar envio pelo ERP"}
            </Button>
            <p className="text-[10px] text-muted-foreground">O ERP confirma apenas o recebimento da solicitação, não a entrega da mensagem.</p>
          </div>
          {!action.connected && <p className="text-xs text-muted-foreground">Conecte a sessão e o BFF para solicitar o envio. Nenhum dado será enviado nesta prévia.</p>}
          {action.connected && !canDispatch && <p className="text-xs text-muted-foreground">Seu perfil não pode solicitar o despacho desta mensagem.</p>}
          {sent && <p role="status" className="text-xs text-success">Solicitação recebida pelo ERP; consulte o canal para confirmar a entrega.</p>}
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        </section>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
