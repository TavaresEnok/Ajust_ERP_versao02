"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  ChevronRight,
  ChevronsUp,
  Minus,
  SignalHigh,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      ajust
      <span className="ml-0.5 mt-3 text-[9px] font-medium tracking-[1.5px] text-muted-foreground">
        ERP
      </span>
    </div>
  );
}
export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span className={cn("avatar", className)}>
      {name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")}
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const tone = [
    "Concluída",
    "Resolvida",
    "Ativo",
    "Disponível",
    "Saudável",
    "Dentro do prazo",
    "Publicado",
    "Ativa",
  ].includes(status)
    ? "success"
    : [
          "Aguardando campo",
          "Em atendimento",
          "Atenção",
          "Em campo",
          "Aguardando terceiros",
        ].includes(status)
      ? "warning"
      : ["Crítica", "Atrasada", "Crítico", "Revogada"].includes(status)
        ? "danger"
        : ["Em análise", "Aberta", "Agendado"].includes(status)
          ? "info"
          : "neutral";
  return (
    <Badge variant="secondary" className={cn("status-badge", `status-${tone}`)}>
      {status}
    </Badge>
  );
}
export function Priority({ value }: { value: string }) {
  const Icon =
    value === "Crítica"
      ? ChevronsUp
      : value === "Alta"
        ? SignalHigh
        : value === "Baixa"
          ? ArrowDown
          : Minus;
  return (
    <span
      className={cn(
        "priority",
        value === "Crítica"
          ? "text-danger"
          : value === "Alta"
            ? "text-warning"
            : "text-muted-foreground",
      )}
    >
      <Icon />
      {value}
    </span>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions flex flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  );
}
export function PanelHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <div>
        <h2 className="section-title">{title}</h2>
        {description && <p className="section-subtitle">{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Metric({
  label,
  value,
  change,
  foot,
  icon: Icon,
  warning = false,
  children,
}: {
  label: string;
  value: string;
  change: string;
  foot: string;
  icon: LucideIcon;
  warning?: boolean;
  children?: ReactNode;
}) {
  return (
    <article className="panel metric-card">
      <div className="flex items-center justify-between gap-2">
        <p className="metric-label">{label}</p>
        <span className="metric-icon">
          <Icon />
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <strong className="metric-value">{value}</strong>
        {children}
      </div>
      <div className="metric-foot">
        <span
          className={cn(
            "inline-flex items-center gap-0.5",
            warning ? "text-warning" : "text-success",
          )}
        >
          <ArrowUpRight className="size-3" />
          {change}
        </span>
        <span>{foot}</span>
      </div>
    </article>
  );
}
export function ViewLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="text-link">
      {children}
      <ChevronRight />
    </Link>
  );
}
export function SearchEmpty({
  text = "Nenhum resultado encontrado.",
}: {
  text?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-14 text-center text-muted-foreground">
      <span className="section-title text-foreground">{text}</span>
      <p className="text-xs">Tente ajustar a busca ou os filtros.</p>
    </div>
  );
}
