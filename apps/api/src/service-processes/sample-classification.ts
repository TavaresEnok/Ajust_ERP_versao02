/** Reviewed against the content of the 30 selected source records, not only the SGP labels. */
const reviewed: Record<number, [string, string]> = {
  10873: [
    'CONFIGURAÇÃO OLT',
    'Preparação de OLT para instalação, com acesso local e configuração.',
  ],
  11537: [
    'VERIFICAÇÃO DE DNS',
    'Solicitação de análise do DNS local; não indica implantação de servidor.',
  ],
  11568: [
    'MUDANÇA BGP / TRÂNSITO',
    'Reativação de um trânsito e desativação de outro em janela acordada.',
  ],
  11926: [
    'CONFIGURAÇÃO ZABBIX/GRAFANA',
    'Configuração de monitoramento, mantendo o piloto anterior em execução.',
  ],
  11892: [
    'DIAGNÓSTICO DE AUTENTICAÇÃO / QUEDAS',
    'Migração já realizada pelo cliente; a demanda é recuperar autenticação de cinco clientes.',
  ],
  8911: [
    'ORIENTAÇÃO TÉCNICA — ENERGIA',
    'O conteúdo trata de dúvida sobre retificadora Huawei, apesar do tipo OLT no SGP.',
  ],
  8205: ['VERIFICAÇÃO DE DNS', 'Verificação do DNS IPv6, sem solicitação de nova implantação.'],
  11840: [
    'CORREÇÃO DE COLETA / ALERTAS',
    'OLTs deixaram de coletar no Grafana; correção de coleta existente.',
  ],
  4597: [
    'MIGRAÇÃO DE PON/ONU',
    'Movimentação planejada de clientes entre portas e equipamentos OLT.',
  ],
  11848: [
    'CONSULTA DE AUTORIZAÇÃO ONU/ONT',
    'Consulta de ONUs aguardando autorização; não é uma informação administrativa genérica.',
  ],
  10610: [
    'DIAGNÓSTICO DE AUTENTICAÇÃO / QUEDAS',
    'Após migração feita pelo cliente, alguns PPPoEs deixaram de autenticar.',
  ],
  740: ['IMPLANTAÇÃO DE DNS', 'Solicitação explícita para instalar um DNS.'],
  7237: [
    'MIGRAÇÃO DE ASN / BGP',
    'Troca de ASN e blocos IPv4/IPv6 no roteador; exige planejamento e reversão.',
  ],
  9539: ['CADASTRO DE MONITORAMENTO', 'Inclusão de um cliente PPPoE no monitoramento.'],
  7615: [
    'MIGRAÇÃO DE PON/ONU',
    'Migração de ONUs entre slots com dependência de atendimento do SGP.',
  ],
  11419: [
    'DIAGNÓSTICO DE AUTENTICAÇÃO / QUEDAS',
    'Investigação de quedas de clientes numa OLT; não descreve configuração inicial de equipamento.',
  ],
  11174: [
    'SEGURANÇA DO DNS RECURSIVO',
    'Tratamento de alerta CERT.br sobre uso de recursivo em ataques de amplificação.',
  ],
  11655: [
    'ANÁLISE DE CAPACIDADE DE ENLACE',
    'Verificação de porta do IX próxima do limite; não solicita mudança BGP direta.',
  ],
  11633: ['CADASTRO DE MONITORAMENTO', 'Inclusão de cliente/equipamento no monitoramento.'],
  10860: ['MIGRAÇÃO DE EQUIPAMENTO', 'Migração planejada de clientes de uma RB para um NE20.'],
  11885: [
    'MIGRAÇÃO DE PON/ONU',
    'Migração emergencial de PON entre Fiberhome e Huawei; origem e destino explícitos.',
  ],
  10521: [
    'CORREÇÃO DE DNS AUTORITATIVO',
    'Nome do Grafana não resolve corretamente, mas o acesso por IP funciona.',
  ],
  11405: [
    'MUDANÇA BGP / TRÂNSITO',
    'Movimentação de conexão entre IX e Equinix solicitada por operadora.',
  ],
  11858: [
    'CORREÇÃO DE COLETA / ALERTAS',
    'Investigar parâmetro e falsos alertas nas PONs, sem incluir novos equipamentos.',
  ],
  11931: [
    'PREPARAÇÃO DE SCRIPT DE MIGRAÇÃO',
    'Pedido de criação de script e mapeamento de PONs; a execução da migração não está implícita na entrega do script.',
  ],
  11549: [
    'CONFIGURAÇÃO OLT',
    'Configuração de uma OLT V-Solution reaproveitada em outra localidade.',
  ],
  10881: [
    'DIAGNÓSTICO DE LENTIDÃO / TRÁFEGO',
    'Investigação de lentidão nos serviços Google, apesar do rótulo BGP.',
  ],
  11854: ['CORREÇÃO DE COLETA / ALERTAS', 'Alertas existentes pararam de funcionar.'],
  10021: [
    'MIGRAÇÃO DE PON/ONU',
    'Migração em lotes diários de PONs; registrar planejamento e resultado de cada lote.',
  ],
  11834: [
    'DIAGNÓSTICO DE INDISPONIBILIDADE DE SITE',
    'Site do provedor indisponível, com impacto na liberação do Speedtest.',
  ],
};
export function classifySample(orderId: number, originalType: string) {
  const match = reviewed[orderId];
  return {
    name: match?.[0] || originalType,
    reason: match?.[1] || 'Tipo de origem, revisão de conteúdo pendente.',
    reviewed: !!match,
  };
}
