import { ProcessDefinition, ProcessNode, validateDefinition } from './process-definition';

const operators = ['super_admin', 'gerente', 'analista'] as const;
function task(
  id: string,
  name: string,
  sector: string,
  routes: Record<string, string>,
  requiredFields: string[],
  extra: Partial<ProcessNode> = {},
): ProcessNode {
  return {
    id,
    name,
    sector,
    routes,
    requiredFields,
    kind: 'task',
    roles: [...operators],
    serviceType: 'INFRAESTRUTURA',
    slaMinutes: 30,
    ...extra,
  };
}
const end = task('fim', 'Atendimento concluído', 'GESTAO', {}, [], { kind: 'end' });
const audit = (target: string) =>
  task(
    'auditoria',
    'Auditoria da solução',
    'GESTAO',
    { Aprovado: 'comunicacao', Reprovado: target },
    ['Resultado da revisão'],
    { roles: ['super_admin', 'gerente'], serviceType: 'AUDITORIA' },
  );
const communicate = task(
  'comunicacao',
  'Comunicar resultado ao provedor',
  'ATENDIMENTO',
  { Comunicado: 'fim' },
  ['Resumo comunicado', 'Canal e destinatário'],
);

export const PILOT_DEFINITIONS: ProcessDefinition[] = [
  {
    code: 'MEGANET_ZABBIX',
    name: 'Meganet · Zabbix / Grafana',
    version: 1,
    description:
      'Diagnóstico, ajuste, validação e auditoria do monitoramento. Metas de demonstração, não SLA contratual.',
    sourceTypes: ['CONFIGURAÇÃO ZABBIX/GRAFANA'],
    start: 'triagem',
    slaMode: 'PILOT_PROPOSED',
    nodes: [
      task(
        'triagem',
        'Triagem e impacto',
        'MONITORAMENTO',
        { Qualificado: 'diagnostico' },
        ['Impacto', 'Ativo afetado', 'Resultado esperado'],
        { slaMinutes: 15 },
      ),
      task(
        'diagnostico',
        'Diagnóstico técnico',
        'MONITORAMENTO',
        {
          'Ajuste local': 'ajuste',
          'Depende do provedor': 'espera',
          'Sem alteração necessária': 'validacao',
        },
        ['Diagnóstico', 'Evidências'],
      ),
      task(
        'espera',
        'Aguardar informação do provedor',
        'ATENDIMENTO',
        { 'Informação recebida': 'diagnostico' },
        ['Resposta recebida'],
        { kind: 'wait', slaMinutes: 240 },
      ),
      task(
        'ajuste',
        'Ajustar monitoramento',
        'MONITORAMENTO',
        { Executado: 'validacao' },
        ['Alterações realizadas', 'Plano de reversão'],
        { slaMinutes: 60 },
      ),
      task(
        'validacao',
        'Validar alertas e estabilidade',
        'MONITORAMENTO',
        { Validado: 'auditoria', 'Falha na validação': 'diagnostico' },
        ['Testes e resultados', 'Período de observação'],
      ),
      audit('diagnostico'),
      communicate,
      end,
    ],
  },
  {
    code: 'MEGANET_BGP',
    name: 'Meganet · Alteração BGP',
    version: 1,
    description:
      'Mudança de roteamento com análise, aprovação, janela, execução, validação e rollback.',
    sourceTypes: ['CONFIGURAÇÃO BGP'],
    start: 'triagem',
    slaMode: 'PILOT_PROPOSED',
    nodes: [
      task(
        'triagem',
        'Qualificar demanda BGP',
        'NOC',
        { Qualificado: 'planejamento' },
        ['Impacto', 'Equipamentos envolvidos'],
        { serviceType: 'BGP', slaMinutes: 15 },
      ),
      task(
        'planejamento',
        'Planejar mudança e reversão',
        'NOC',
        { Planejado: 'aprovacao' },
        ['Plano de execução', 'Plano de reversão', 'Riscos'],
        { serviceType: 'BGP', slaMinutes: 60 },
      ),
      task(
        'aprovacao',
        'Aprovar mudança',
        'GESTAO',
        { Aprovado: 'janela', 'Revisão necessária': 'planejamento' },
        ['Decisão e justificativa'],
        { kind: 'decision', roles: ['super_admin', 'gerente'], serviceType: 'BGP' },
      ),
      task(
        'janela',
        'Confirmar janela com o provedor',
        'ATENDIMENTO',
        { 'Janela iniciada': 'execucao', Reagendado: 'janela' },
        ['Janela confirmada', 'Autorização do provedor'],
        { kind: 'wait', slaMinutes: 240, serviceType: 'BGP' },
      ),
      task(
        'execucao',
        'Executar alteração BGP',
        'NOC',
        { Executado: 'validacao', 'Falha de execução': 'rollback' },
        ['Comandos ou alteração aplicada', 'Evidências'],
        { serviceType: 'BGP', slaMinutes: 60 },
      ),
      task(
        'validacao',
        'Validar sessões e tráfego',
        'NOC',
        { Validado: 'auditoria', 'Necessita reversão': 'rollback' },
        ['Sessões, rotas e tráfego', 'Resultado dos testes'],
        { serviceType: 'BGP' },
      ),
      task(
        'rollback',
        'Reverter e estabilizar',
        'NOC',
        { 'Estabilizado para revisão': 'planejamento' },
        ['Reversão executada', 'Estabilidade recuperada'],
        { serviceType: 'BGP', slaMinutes: 30 },
      ),
      audit('planejamento'),
      communicate,
      end,
    ],
  },
  {
    code: 'MEGANET_MIGRACAO',
    name: 'Meganet · Migração de equipamento',
    version: 1,
    description:
      'Inventário, backup, autorização, migração, autenticação, validação e atualização documental.',
    sourceTypes: ['MIGRAÇÃO DE EQUIPAMENTO'],
    start: 'triagem',
    slaMode: 'PILOT_PROPOSED',
    nodes: [
      task('triagem', 'Levantar escopo da migração', 'NOC', { Qualificado: 'preparacao' }, [
        'Origem e destino',
        'Serviços afetados',
        'Critérios de sucesso',
      ]),
      task(
        'preparacao',
        'Backup e plano de migração',
        'NOC',
        { Preparado: 'autorizacao' },
        ['Backup verificado', 'Plano de execução', 'Plano de reversão'],
        { slaMinutes: 60 },
      ),
      task(
        'autorizacao',
        'Autorizar janela de migração',
        'GESTAO',
        { Autorizado: 'execucao', 'Revisão necessária': 'preparacao' },
        ['Janela e autorização do provedor'],
        { kind: 'decision', roles: ['super_admin', 'gerente'] },
      ),
      task(
        'execucao',
        'Executar migração',
        'NOC',
        { Executado: 'validacao', 'Falha de execução': 'rollback' },
        ['Alteração executada', 'Evidências'],
        { slaMinutes: 60 },
      ),
      task(
        'validacao',
        'Validar autenticação e serviços',
        'NOC',
        { Validado: 'documentacao', 'Necessita reversão': 'rollback' },
        ['Testes de autenticação', 'Testes de serviço'],
      ),
      task(
        'rollback',
        'Restaurar operação anterior',
        'NOC',
        { 'Operação restabelecida': 'preparacao' },
        ['Reversão executada', 'Serviços restabelecidos'],
      ),
      task('documentacao', 'Atualizar inventário e diagrama', 'NOC', { Documentado: 'auditoria' }, [
        'Inventário atualizado',
        'Diagrama ou registro atualizado',
      ]),
      audit('preparacao'),
      communicate,
      end,
    ],
  },
].map(validateDefinition);
