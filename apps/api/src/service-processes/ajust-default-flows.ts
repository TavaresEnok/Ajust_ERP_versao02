import {
  OperationalDefinition,
  OperationalNode,
  validateOperational,
} from './operational-definition';

/** Templates describe deliveries, not a mandatory approval bureaucracy. */
export function ajustFlow(code: string): OperationalDefinition {
  const node = (
    id: string,
    name: string,
    extra: Partial<OperationalNode> = {},
  ): OperationalNode => ({
    id,
    name,
    kind: 'task',
    orderKey: 'root',
    sector: 'NOC',
    roles: ['super_admin', 'gerente', 'analista'],
    serviceType: 'CONSULTORIA_GERAL',
    slaMinutes: 2880,
    requiredFields: ['Resultado técnico'],
    routes: { Concluído: 'fim' },
    closeOn: ['Concluído'],
    waitFor: [],
    position: { x: 60, y: 100 },
    ...extra,
  });
  const end = node('fim', 'Atendimento concluído', {
    kind: 'end',
    routes: {},
    requiredFields: [],
    closeOn: [],
    position: { x: 950, y: 100 },
  });
  const root = node('executar', 'Executar e registrar o resultado');
  let nodes = [root, end];
  let name = 'Atendimento simples';
  if (code === 'AJUST_MUDANCA') {
    name = 'Preparação e execução agendada';
    nodes = [
      node('preparar', 'Preparar e registrar passagem de atendimento', {
        routes: { 'Preparação concluída': 'executar' },
        closeOn: [],
        requiredFields: ['Preparação, impacto e plano de reversão'],
      }),
      node('executar', 'Executar na janela e validar o serviço', { position: { x: 470, y: 100 } }),
      end,
    ];
  }
  if (code === 'AJUST_EQUIPAMENTO' || code === 'AJUST_TOPOLOGIA') {
    const equipment = code === 'AJUST_EQUIPAMENTO';
    name = equipment ? 'Configuração e integração de equipamento' : 'Alteração de topologia';
    const children = [
      node('monitoramento', 'Atualizar e validar monitoramento', {
        orderKey: 'monitoramento',
        sector: 'Monitoramento',
        position: { x: 550, y: 0 },
        routes: { Concluído: 'reunir' },
      }),
      node('diagrama', 'Atualizar diagrama de rede', {
        orderKey: 'diagrama',
        position: { x: 550, y: 200 },
        routes: { Concluído: 'reunir' },
      }),
      ...(equipment
        ? [
            node('backup', 'Configurar e validar Backup Center', {
              orderKey: 'backup',
              position: { x: 550, y: 400 },
              routes: { Concluído: 'reunir' },
            }),
          ]
        : []),
    ];
    nodes = [
      node(
        'executar',
        equipment
          ? 'Configurar, ativar e validar equipamento'
          : 'Executar e validar alteração de topologia',
        { routes: { Concluído: 'distribuir' } },
      ),
      node('distribuir', 'Abrir entregas complementares', {
        kind: 'fork',
        routes: Object.fromEntries(children.map((n) => [n.id, n.id])),
        requiredFields: [],
        closeOn: [],
        position: { x: 300, y: 100 },
      }),
      ...children,
      node('reunir', 'Todas as entregas concluídas', {
        kind: 'join',
        waitFor: children.map((n) => n.id),
        requiredFields: [],
        closeOn: [],
        position: { x: 800, y: 100 },
      }),
      end,
    ];
  }
  return validateOperational({
    engineVersion: 2,
    code,
    name,
    version: 1,
    description:
      'Fluxo operacional da Ajust. Prazos por tipo de serviço; agendamento disponível 24h todos os dias.',
    sourceTypes: [],
    start: nodes[0].id,
    maxVisits: 5,
    nodes,
  });
}
