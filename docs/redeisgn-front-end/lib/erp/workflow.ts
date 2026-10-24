import type { WorkflowDefinition } from "./contracts";
export const workflowSubtypes = {
  trigger: { start_implantacao: "Implantação", start_os_criada: "OS criada", os_criada: "Criação de OS", os_fechada: "Fechamento de OS", os_atualizada: "Atualização de OS", sla_breach: "SLA violado", os_critica: "OS crítica" },
  condition: { condition: "Comparação de campo", cond_no_analyst: "Sem analista", gateway_parallel: "Divisão paralela", gateway_parallel_join: "Junção paralela" },
  action: { action_assign: "Atribuir analista", action_escalate: "Escalonar", action_notify_slack: "Notificar Slack", action_webhook: "Chamar webhook", action_csat: "Solicitar CSAT", task_service: "Criar tarefa de serviço", action_close_order: "Fechar ordem" },
};
export function workflowWarnings(definition: WorkflowDefinition) {
  const warnings: string[] = [];
  const reached = new Set<string>();
  const queue = definition.nodes.filter(node => node.type === "trigger").map(node => node.id);
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    if (reached.has(id)) continue;
    reached.add(id);
    queue.push(...definition.edges.filter(edge => edge.source === id).map(edge => edge.target).filter(target => !reached.has(target)));
  }
  const disconnected = definition.nodes.filter(node => !reached.has(node.id));
  if (disconnected.length) warnings.push(`${disconnected.length} nós não são alcançados a partir do gatilho.`);
  for (const node of definition.nodes) {
    if (!(node.subtype in workflowSubtypes[node.type])) warnings.push(`Subtipo ${node.subtype} não é reconhecido pelo contrato do motor consultado.`);
    if (node.type === "condition" && node.subtype !== "gateway_parallel" && definition.edges.some(edge => edge.source === node.id && !["true", "false"].includes(edge.label?.toLowerCase() || ""))) warnings.push(`O motor exige uma saída true/false na condição ${node.id}.`);
    if (node.type === "condition" && node.config.operator && !["eq", "neq", "contains"].includes(String(node.config.operator))) warnings.push(`O operador de ${node.id} não é implementado; o motor original retorna true por padrão.`);
  }
  if (definition.nodes.some(node => ["cond_no_analyst", "start_implantacao", "os_critica"].includes(node.subtype))) warnings.push("Subtipos legados não implementam todos os filtros sugeridos pelo nome no motor do ZIP. Revise a regra original antes de ativar.");
  return warnings;
}
export const actionConfigFields: Record<string, string[]> = { action_assign: ["analystId"], action_escalate: ["to"], action_notify_slack: ["webhookUrl", "message"], action_webhook: ["url", "method"], task_service: ["taskName", "team"] };
export function validateWorkflow(definition: WorkflowDefinition) {
  const { nodes, edges } = definition;
  if (nodes.filter(n => n.type === "trigger").length !== 1) throw new Error("O workflow deve conter exatamente um gatilho.");
  if (!nodes.some(n => n.type === "action")) throw new Error("Adicione pelo menos uma ação.");
  for (const node of nodes) {
    if (!node.config || typeof node.config !== "object" || Array.isArray(node.config)) throw new Error("A configuração de cada nó deve ser um objeto.");
    if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) throw new Error("Informe posições numéricas para todos os nós.");
  }
  if (new Set(edges.map(edge => edge.id)).size !== edges.length) throw new Error("As conexões devem ter identificadores únicos.");
  const ids = new Set(nodes.map(n => n.id));
  if (ids.size !== nodes.length) throw new Error("Os nós devem ter identificadores únicos.");
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error("Uma conexão referencia um nó inexistente.");
    if (edge.source === edge.target) throw new Error("Um nó não pode apontar para si mesmo.");
  }
  for (const node of nodes) {
    const incoming = edges.filter(e => e.target === node.id);
    const outgoing = edges.filter(e => e.source === node.id);
    if (node.type === "condition") {
      if (node.subtype === "gateway_parallel" && (incoming.length !== 1 || outgoing.length < 2)) throw new Error("Divisão paralela exige uma entrada e pelo menos duas saídas.");
      if (node.subtype === "gateway_parallel_join" && (incoming.length < 2 || outgoing.length !== 1)) throw new Error("Junção paralela exige pelo menos duas entradas e uma saída.");
      if (!["gateway_parallel", "gateway_parallel_join"].includes(node.subtype)) {
        if (outgoing.length > 2) throw new Error("Condições aceitam no máximo duas saídas.");
        if (outgoing.length === 2 && !["true", "false"].every(label => outgoing.some(e => e.label?.toLowerCase() === label))) throw new Error("Identifique as duas saídas da condição como true e false.");
      }
    } else if (outgoing.length > 1) throw new Error("Gatilhos e ações aceitam no máximo uma saída.");
    const fields = node.type === "condition" && !["cond_no_analyst", "gateway_parallel", "gateway_parallel_join"].includes(node.subtype) ? ["field", "operator", "value"] : actionConfigFields[node.subtype] || [];
    for (const field of fields) if (node.config[field] === undefined || node.config[field] === null || String(node.config[field]).trim() === "") throw new Error(`O nó ${node.id} exige ${field} na configuração.`);
  }
}
