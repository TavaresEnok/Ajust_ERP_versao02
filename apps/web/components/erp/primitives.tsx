'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUpRight,
  ChevronRight,
  ChevronsUp,
  Minus,
  SignalHigh,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('avatar', className)}>
      {name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')}
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const tone = [
    'Concluída',
    'Resolvida',
    'Ativo',
    'Disponível',
    'Saudável',
    'Dentro do prazo',
    'Publicado',
    'Ativa',
  ].includes(status)
    ? 'success'
    : [
          'Aguardando campo',
          'Em atendimento',
          'Atenção',
          'Em campo',
          'Aguardando terceiros',
        ].includes(status)
      ? 'warning'
      : ['Crítica', 'Atrasada', 'Crítico', 'Revogada'].includes(status)
        ? 'danger'
        : ['Em análise', 'Aberta', 'Agendado'].includes(status)
          ? 'info'
          : 'neutral';
  return (
    <Badge variant="secondary" className={cn('status-badge', `status-${tone}`)}>
      {status}
    </Badge>
  );
}
export function Priority({ value }: { value: string }) {
  const Icon =
    value === 'Crítica'
      ? ChevronsUp
      : value === 'Alta'
        ? SignalHigh
        : value === 'Baixa'
          ? ArrowDown
          : Minus;
  return (
    <span
      className={cn(
        'priority',
        value === 'Crítica'
          ? 'text-danger'
          : value === 'Alta'
            ? 'text-warning'
            : 'text-muted-foreground',
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
      <div className="heading-actions flex flex-wrap items-center gap-2">{children}</div>
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
export type MetricTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
/** Tom pelo significado do indicador, para que o mesmo assunto tenha a mesma cor em todas as telas. */
export function metricTone(label: string): MetricTone {
  const text = label.toLowerCase();
  if (/banco|cache|redis|sessões|verificação|configuraç/.test(text)) return 'neutral';
  if (/atrasad|violaç|crític|falha/.test(text)) return 'danger';
  if (/pendente|em aberto|abertas|ativas|vencem|próximas do prazo|pausad|impactad/.test(text))
    return 'warning';
  if (/entrega|concluíd|cumprimento|satisfação|resolvid/.test(text)) return 'success';
  return 'info';
}
export function Metric({
  label,
  value,
  change,
  foot,
  icon: Icon,
  warning = false,
  tone,
  children,
}: {
  label: string;
  value: string;
  /** Variação no período; omitida quando o indicador não tem comparação (C-001). */
  change?: string;
  foot: string;
  icon: LucideIcon;
  warning?: boolean;
  /** Sobrescreve o tom deduzido do rótulo. */
  tone?: MetricTone;
  children?: ReactNode;
}) {
  return (
    <article className={cn('panel metric-card tone-surface', `tone-${tone ?? metricTone(label)}`)}>
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
        {change ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5',
              warning ? 'text-warning' : 'text-success',
            )}
          >
            <ArrowUpRight className="size-3" />
            {change}
          </span>
        ) : null}
        <span>{foot}</span>
      </div>
    </article>
  );
}
export function ViewLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-link">
      {children}
      <ChevronRight />
    </Link>
  );
}
export function SearchEmpty({ text = 'Nenhum resultado encontrado.' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-14 text-center text-muted-foreground">
      <span className="section-title text-foreground">{text}</span>
      <p className="text-xs">Tente ajustar a busca ou os filtros.</p>
    </div>
  );
}
