"use client";
import { useErp } from "@/lib/erp/gateway";
import { PageHeading } from "./primitives";
import { ConnectionNotice } from "./contract-form";
import { DataReport } from "./data-report";
import { ResourcePage } from "./resource-page";
export function DashboardWorkspace({ base }: { base: string }) {
  const { scope, transport } = useErp();
  if (base === "/cliente" || scope?.role === "cliente" || scope?.role === "leitura") return <ResourcePage moduleKey="orders" base={base} />;
  const manager = !scope || ["super_admin", "gerente"].includes(scope.role);
  return <><PageHeading title="Visão geral da operação" description="Indicadores e próximos compromissos da empresa autenticada." />{!(scope && transport) && <ConnectionNotice />}<div className="flex flex-col gap-5">{manager && <DataReport title="Indicadores gerenciais" path="/reports/manager-kpi" roles={["super_admin", "gerente"]} metrics={[{ key: "overview.totalOpen", label: "Abertas" }, { key: "overview.totalClosed", label: "Resolvidas / fechadas" }, { key: "overview.slaBreaches", label: "Violações de SLA" }]} charts={[{ key: "performanceByAnalyst", title: "Desempenho da equipe", category: "name", series: [{ key: "open", label: "Abertas" }, { key: "closed", label: "Encerradas" }] }]} tables={[{ key: "performanceByAnalyst", columns: [{ key: "name", label: "Analista" }, { key: "open", label: "Abertas" }, { key: "closed", label: "Encerradas" }, { key: "tmrHours", label: "Resolução média (h)" }] }]} />}{manager ? <DataReport title="Próximos compromissos" path="/dashboards/agenda-overview" roles={["super_admin", "gerente"]} tables={[{ key: "items", columns: [{ key: "title", label: "Compromisso" }, { key: "start", label: "Início" }, { key: "source", label: "Origem" }] }]} /> : <DataReport title="Minha agenda" path="/calendar/events" tables={[{ columns: [{ key: "title", label: "Compromisso" }, { key: "startAt", label: "Início" }, { key: "endAt", label: "Fim" }] }]} />}{manager && <DataReport title="Estado do ambiente" path="/reports/health-summary" roles={["super_admin", "gerente"]} metrics={[{ key: "services.database.ok", label: "Banco disponível" }, { key: "services.redis.ok", label: "Redis disponível" }, { key: "stats.activeSessions", label: "Sessões ativas" }]} />}</div></>;
}
