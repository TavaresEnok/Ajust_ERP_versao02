import { BadRequestException } from '@nestjs/common';
import { ServiceOrderType } from '@prisma/client';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { normalizeType } from './sgp-sample-source';

export const OperationalDefinitionSchema = z
  .object({
    engineVersion: z.literal(2),
    code: z.string().regex(/^[A-Z0-9_]+$/),
    name: z.string().min(3).max(120),
    version: z.number().int().positive(),
    description: z.string().max(2000),
    sourceTypes: z.array(z.string()),
    start: z.string(),
    maxVisits: z.number().int().min(1).max(10).default(5),
    nodes: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9_]+$/),
            name: z.string().min(3),
            kind: z.enum(['task', 'fork', 'join', 'end']),
            orderKey: z.string().min(1).default('root'),
            sector: z.string().min(2),
            roles: z.array(z.enum(['super_admin', 'gerente', 'analista'])).min(1),
            serviceType: z.nativeEnum(ServiceOrderType),
            slaMinutes: z.number().int().min(1).max(43200),
            requiredFields: z.array(z.string().min(1)).max(20),
            routes: z.record(z.string().min(1), z.string().min(1)),
            closeOn: z.array(z.string()).default([]),
            waitFor: z.array(z.string()).default([]),
            assigneeUserId: z.string().uuid().optional(),
            position: z.object({ x: z.number().finite(), y: z.number().finite() }),
          })
          .strict(),
      )
      .min(2)
      .max(60),
  })
  .strict();
export type OperationalDefinition = z.infer<typeof OperationalDefinitionSchema>;
export type OperationalNode = OperationalDefinition['nodes'][number];

export function validateOperational(value: unknown) {
  const result = OperationalDefinitionSchema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; '),
    );
  const d = result.data;
  const ids = new Set(d.nodes.map((n) => n.id));
  if (ids.size !== d.nodes.length || !ids.has(d.start))
    throw new BadRequestException('IDs repetidos ou início inexistente.');
  for (const n of d.nodes) {
    if (Object.values(n.routes).some((t) => !ids.has(t)) || n.waitFor.some((t) => !ids.has(t)))
      throw new BadRequestException(`Destino inexistente em ${n.name}.`);
    if (n.kind === 'end' ? Object.keys(n.routes).length !== 0 : Object.keys(n.routes).length === 0)
      throw new BadRequestException(`Saídas inválidas em ${n.name}.`);
    if (n.kind === 'fork' && Object.keys(n.routes).length < 2)
      throw new BadRequestException('Paralelismo exige pelo menos dois ramos.');
    if (n.kind === 'join' && (n.waitFor.length < 2 || Object.keys(n.routes).length !== 1))
      throw new BadRequestException('Junção exige dois predecessores obrigatórios e uma saída.');
    if (
      n.kind === 'join' &&
      n.waitFor.some(
        (id) => !Object.values(d.nodes.find((x) => x.id === id)!.routes).includes(n.id),
      )
    )
      throw new BadRequestException('Predecessores da junção devem apontar diretamente para ela.');
    if (n.closeOn.some((outcome) => !(outcome in n.routes)))
      throw new BadRequestException(`Resultado de fechamento inexistente em ${n.name}.`);
    if (n.kind !== 'task' && n.closeOn.length)
      throw new BadRequestException('Somente tarefas podem concluir O.S. por resultado.');
    if (n.kind === 'task' && n.orderKey !== 'root' && !n.closeOn.length)
      throw new BadRequestException('O.S. derivada precisa declarar qual resultado a conclui.');
  }
  const reachable = new Set([d.start]);
  const finishable = new Set(d.nodes.filter((n) => n.kind === 'end').map((n) => n.id));
  for (let i = 0; i < d.nodes.length; i++)
    for (const n of d.nodes) {
      if (reachable.has(n.id)) Object.values(n.routes).forEach((id) => reachable.add(id));
      if (Object.values(n.routes).some((id) => finishable.has(id))) finishable.add(n.id);
    }
  if (reachable.size !== ids.size || finishable.size !== ids.size)
    throw new BadRequestException('Há blocos desconectados ou sem caminho até o fim.');
  // Joins are deliberately explicit AND gates in this pilot. Optional/exclusive predecessors are rejected.
  for (const join of d.nodes.filter((n) => n.kind === 'join')) {
    const incoming = d.nodes.filter((n) => Object.values(n.routes).includes(join.id));
    if (
      incoming.some((n) => !join.waitFor.includes(n.id)) ||
      incoming.length !== join.waitFor.length
    )
      throw new BadRequestException('Junção deve listar todos os ramos obrigatórios de entrada.');
    if (
      !d.nodes.some(
        (n) =>
          n.kind === 'fork' && join.waitFor.every((id) => Object.values(n.routes).includes(id)),
      )
    )
      throw new BadRequestException(
        'Neste piloto a junção reúne tarefas diretamente abertas pelo mesmo bloco paralelo.',
      );
  }
  return d;
}

const operators = ['super_admin', 'gerente', 'analista'] as const;
export function makeOperationalDefinition(sourceType: string): OperationalDefinition {
  const norm = normalizeType(sourceType);
  const code = `ATEND_${createHash('sha256').update(norm).digest('hex').slice(0, 10).toUpperCase()}`;
  const serviceType: ServiceOrderType = /BGP/.test(norm)
    ? 'BGP'
    : /DNS/.test(norm)
      ? 'DNS'
      : /INFORMA|SUPORTE|CLIENTE/.test(norm)
        ? 'CONSULTORIA_GERAL'
        : 'INFRAESTRUTURA';
  const nodes: OperationalNode[] = [];
  function node(
    id: string,
    name: string,
    routes: Record<string, string>,
    extra: Partial<OperationalNode> = {},
  ) {
    const index = nodes.length;
    nodes.push({
      id,
      name,
      routes,
      kind: 'task',
      orderKey: 'root',
      sector: /ZABBIX|GRAFANA|MONITOR/.test(norm) ? 'MONITORAMENTO' : 'NOC',
      roles: [...operators],
      serviceType,
      slaMinutes: 60,
      requiredFields: ['Registro técnico e evidências'],
      closeOn: [],
      waitFor: [],
      position: { x: (index % 5) * 280, y: Math.floor(index / 5) * 230 },
      ...extra,
    });
  }
  const parallel =
    /CONFIGURACAO OLT|MIGRACAO DE EQUIPAMENTO|MIGRACAO DE PON|TROCA DE EQUIPAMENTO/.test(norm);
  node(
    'triagem',
    'Qualificar solicitação e impacto',
    { Qualificado: 'diagnostico' },
    { requiredFields: ['Escopo e ativo afetado'], slaMinutes: 15 },
  );
  if (/INFORMA|ORIENTACAO|CONSULTA/.test(norm)) {
    node(
      'diagnostico',
      /ENERGIA/.test(norm)
        ? 'Analisar especificação e orientar sobre energia'
        : /ONU/.test(norm)
          ? 'Consultar ONUs pendentes de autorização'
          : 'Analisar solicitação de informação',
      { Respondido: 'fim', Encaminhar: 'encaminhamento' },
      {
        requiredFields: /ENERGIA/.test(norm)
          ? [
              'Modelo, capacidade e compatibilidade da retificadora',
              'Orientação comunicada e limitações',
            ]
          : /ONU/.test(norm)
            ? ['OLT e PON consultadas', 'Resultado da consulta e orientação ao provedor']
            : ['Resposta técnica e destinatário'],
        closeOn: ['Respondido'],
      },
    );
    node(
      'encaminhamento',
      'Encaminhar a mesma O.S.',
      { Encaminhado: 'diagnostico' },
      { requiredFields: ['Motivo e destinatário do encaminhamento'] },
    );
  } else {
    node(
      'diagnostico',
      /DNS/.test(norm) ? 'Diagnosticar resolução DNS' : 'Diagnosticar e planejar atendimento',
      {
        'Sem alteração necessária': 'validacao',
        'Executar correção': /BGP|MIGRACAO|OLT/.test(norm) ? 'aprovacao' : 'execucao',
        Encaminhar: 'encaminhamento',
      },
      { requiredFields: ['Diagnóstico e impacto', 'Testes realizados'] },
    );
    node(
      'encaminhamento',
      'Encaminhar a mesma O.S.',
      { Encaminhado: 'diagnostico' },
      { requiredFields: ['Motivo e destinatário do encaminhamento'] },
    );
    if (/BGP|MIGRACAO|OLT/.test(norm))
      node(
        'aprovacao',
        'Aprovar plano e reversão',
        { Aprovado: 'execucao', Revisar: 'diagnostico' },
        {
          roles: ['super_admin', 'gerente'],
          sector: 'GESTAO',
          requiredFields: ['Plano, janela e reversão aprovados'],
        },
      );
    node(
      'execucao',
      /DNS/.test(norm)
        ? 'Corrigir serviço DNS'
        : /ZABBIX|GRAFANA|MONITOR/.test(norm)
          ? 'Ajustar monitoramento e alertas'
          : /MIGRACAO/.test(norm)
            ? 'Executar migração com backup preventivo'
            : `Executar: ${sourceType}`.slice(0, 110),
      { Executado: 'validacao', 'Precisa de apoio': 'encaminhamento' },
      { requiredFields: ['Alterações executadas', 'Evidências e reversão'] },
    );
    node(
      'validacao',
      /DNS/.test(norm) ? 'Validar DNS e registrar resultado' : 'Validar serviço com o provedor',
      { Validado: parallel ? 'paralelo' : 'fim', 'Falha na validação': 'diagnostico' },
      { requiredFields: ['Resultado dos testes', 'Conclusão técnica'], closeOn: ['Validado'] },
    );
    if (parallel) {
      node(
        'paralelo',
        'Abrir trabalhos independentes',
        { Monitoramento: 'grafana', Documentação: 'diagrama', Backup: 'backup' },
        { kind: 'fork', requiredFields: [] },
      );
      node(
        'grafana',
        'Cadastrar e validar monitoramento',
        { Concluído: 'reunir' },
        {
          orderKey: 'grafana',
          sector: 'MONITORAMENTO',
          requiredFields: ['Monitoramento ativo e alertas testados'],
          closeOn: ['Concluído'],
          position: { x: 560, y: 500 },
        },
      );
      node(
        'diagrama',
        'Atualizar diagrama e inventário',
        { Concluído: 'reunir' },
        {
          orderKey: 'diagrama',
          sector: 'DOCUMENTACAO',
          requiredFields: ['Diagrama e inventário atualizados'],
          closeOn: ['Concluído'],
          position: { x: 850, y: 500 },
        },
      );
      node(
        'backup',
        'Configurar e validar Backup Center',
        { Concluído: 'reunir' },
        {
          orderKey: 'backup',
          sector: 'BACKUP',
          requiredFields: ['Backup coletado e restauração verificada'],
          closeOn: ['Concluído'],
          position: { x: 1140, y: 500 },
        },
      );
      node(
        'reunir',
        'Aguardar as três O.S. obrigatórias',
        { Completo: 'fim' },
        {
          kind: 'join',
          waitFor: ['grafana', 'diagrama', 'backup'],
          requiredFields: [],
          position: { x: 850, y: 740 },
        },
      );
    }
  }
  // Demand-specific evidence and task names; a source label alone does not determine the workflow.
  for (const n of nodes) {
    if (n.id === 'diagnostico' && /DNS/.test(norm))
      n.requiredFields = /AUTORITATIVO/.test(norm)
        ? ['Zona, registro e TTL afetados', 'Testes de resolução autoritativa e pública']
        : /SEGURANCA/.test(norm)
          ? [
              'Escopo do alerta CERT.br e exposição da recursão',
              'Teste autorizado de ACL e origens permitidas',
            ]
          : [
              'Resolvedor, domínio e escopo IPv4/IPv6',
              'Resultados de resolução, disponibilidade e latência',
            ];
    if (n.id === 'execucao' && /IMPLANTACAO DE DNS/.test(norm)) {
      n.name = 'Implantar DNS com controle de acesso';
      n.requiredFields = [
        'Serviço instalado, zonas/recursão e ACL',
        'Testes locais e externos autorizados',
      ];
    }
    if (n.id === 'execucao' && /PREPARACAO DE SCRIPT/.test(norm)) {
      n.name = 'Elaborar script e plano de reversão';
      n.requiredFields = [
        'Mapeamento origem/destino e comandos revisados',
        'Validação em ambiente controlado e plano de reversão',
      ];
    }
    if (n.id === 'validacao' && /PREPARACAO DE SCRIPT/.test(norm)) {
      n.name = 'Revisar e entregar script sem executar a migração';
      n.requiredFields = [
        'Revisão técnica e validação do script',
        'Entrega ao solicitante e instruções para futura execução',
      ];
    }
    if (n.id === 'triagem' && /MIGRACAO DE PON/.test(norm))
      n.requiredFields = [
        'OLT, slots e PONs de origem e destino',
        'Clientes afetados, lotes e janela acordada',
      ];
    if (n.id === 'diagnostico' && /AUTENTICACAO/.test(norm))
      n.requiredFields = [
        'Clientes afetados, sessão PPPoE e caminho até o concentrador',
        'VLANs, perfis e testes de autenticação',
      ];
    if (n.id === 'diagnostico' && /CAPACIDADE/.test(norm))
      n.requiredFields = [
        'Enlace, capacidade nominal e período de pico',
        'Utilização, erros, descartes e recomendação de capacidade',
      ];
    if (n.id === 'diagnostico' && /LENTIDAO/.test(norm))
      n.requiredFields = [
        'Destinos, horários e clientes afetados',
        'Latência, perda, utilização e comparação de rotas',
      ];
    if (n.id === 'diagnostico' && /BGP/.test(norm))
      n.requiredFields = [
        'ASN, peers, prefixos e impacto IPv4/IPv6',
        'Plano de mudança, validação e reversão',
      ];
    if (n.id === 'diagnostico' && /COLETA/.test(norm))
      n.requiredFields = [
        'Host, item e parâmetro do alerta',
        'Coleta observada, limiar e comportamento esperado',
      ];
    if (n.id === 'execucao' && /CADASTRO DE MONITORAMENTO/.test(norm)) {
      n.name = 'Cadastrar host, itens e alertas';
      n.requiredFields = [
        'Host, template e parâmetros de coleta',
        'Teste de alerta e visibilidade no painel',
      ];
    }
    if (n.id === 'diagnostico' && /SITE/.test(norm))
      n.requiredFields = [
        'URL e impacto no serviço do provedor',
        'Testes DNS, HTTP/TLS e conectividade',
      ];
  }
  node(
    'fim',
    'Atendimento concluído',
    {},
    {
      kind: 'end',
      requiredFields: [],
      position: { x: parallel ? 1140 : 1400, y: parallel ? 740 : 230 },
    },
  );
  return validateOperational({
    engineVersion: 2,
    code,
    version: 1,
    name: sourceType,
    description: parallel
      ? 'O.S. principal com validação; monitoramento, documentação e backup independentes em paralelo. Modelo piloto proposto para revisão operacional.'
      : 'Etapas internas na mesma O.S., decisões e encaminhamento sem gerar outra ordem. Modelo piloto proposto para revisão operacional.',
    sourceTypes: [sourceType],
    start: 'triagem',
    maxVisits: 5,
    nodes,
  });
}
