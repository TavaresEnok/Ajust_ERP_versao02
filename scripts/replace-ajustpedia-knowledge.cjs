#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'artigo';
}

function article(title, tags, goal, commands, notes) {
  const lines = [`Objetivo: ${goal}`, '', ...commands];
  if (notes) {
    lines.push('', 'Observacao:', notes);
  }
  return { title, tags, content: lines.join('\n') };
}

const ARTICLES = [
  article(
    'Huawei - Verificar portas UP/DOWN e descricao',
    ['huawei', 'interfaces', 'troubleshooting'],
    'verificar status das portas e descricao das interfaces',
    ['display interface description']
  ),
  article(
    'Huawei - Ver detalhes de uma interface',
    ['huawei', 'interfaces'],
    'consultar detalhes operacionais de uma interface especifica',
    ['display interface <INTERFACE>']
  ),
  article(
    'Huawei - Ver trafego de interface',
    ['huawei', 'interfaces', 'trafego'],
    'consultar contadores de entrada e saida da interface',
    ['display interface <INTERFACE> | include input|output']
  ),
  article(
    'Huawei - Ver configuracao de interface',
    ['huawei', 'interfaces', 'configuracao'],
    'mostrar configuracao aplicada em uma interface',
    ['display current-configuration interface <INTERFACE>']
  ),
  article(
    'Huawei - Ver sinal do transceiver',
    ['huawei', 'interfaces', 'optico'],
    'validar potencia optica e diagnostico do modulo',
    ['display transceiver diagnosis interface <INTERFACE>']
  ),
  article(
    'Huawei - Zerar contadores da interface',
    ['huawei', 'interfaces', 'troubleshooting'],
    'limpar contadores de erro para nova medicao',
    ['reset counters interface <INTERFACE>']
  ),
  article(
    'Huawei - Alterar nome do equipamento',
    ['huawei', 'sistema'],
    'definir novo nome de host no equipamento',
    ['sysname <NOME_DO_EQUIPAMENTO>']
  ),
  article(
    'Huawei - Ajustar data e hora',
    ['huawei', 'sistema'],
    'corrigir data e hora do equipamento',
    ['clock datetime HH:MM:SS YYYY-MM-DD']
  ),
  article(
    'Huawei - Acessar virtual-system',
    ['huawei', 'sistema', 'virtual-system'],
    'entrar em um contexto virtual especifico',
    ['switch virtual-system <NOME_VS>']
  ),
  article(
    'Huawei - Criar VLAN',
    ['huawei', 'vlan', 'l2'],
    'criar uma nova VLAN',
    ['vlan <ID_VLAN>']
  ),
  article(
    'Huawei - Configurar porta access',
    ['huawei', 'vlan', 'l2', 'access'],
    'configurar interface em modo access com VLAN padrao',
    ['interface <INTERFACE>', ' port link-type access', ' port default vlan <ID_VLAN>']
  ),
  article(
    'Huawei - Configurar porta trunk',
    ['huawei', 'vlan', 'l2', 'trunk'],
    'configurar interface em modo trunk com lista de VLANs',
    ['interface <INTERFACE>', ' port link-type trunk', ' port trunk allow-pass vlan <LISTA_DE_VLANS>']
  ),
  article(
    'Huawei - Configurar interface VLANIF com IP',
    ['huawei', 'vlanif', 'l3'],
    'atribuir endereco IP a uma interface VLANIF',
    ['interface vlanif <ID_VLAN>', ' ip address <IP> <MASCARA>']
  ),
  article(
    'Huawei - Descobrir IP de loopback',
    ['huawei', 'loopback', 'troubleshooting'],
    'consultar loopback para testes de conectividade',
    ['display current-configuration interface LoopBack']
  ),
  article(
    'Huawei - Ver resumo de interfaces IP',
    ['huawei', 'l3', 'interfaces'],
    'listar status e enderecamento IP das interfaces',
    ['display ip interface brief']
  ),
  article(
    'Huawei QoS - Remover limite de trafego por ACL',
    ['huawei', 'qos', 'acl'],
    'retirar limites de banda inbound e outbound em ACL',
    ['undo traffic-limit outbound acl <ACL_ID>', 'undo traffic-limit inbound acl <ACL_ID>']
  ),
  article(
    'Huawei QoS - Aplicar limite de trafego por ACL',
    ['huawei', 'qos', 'acl'],
    'aplicar limites de banda inbound e outbound em ACL',
    [
      'traffic-limit outbound acl <ACL_ID> cir <CIR> pir <PIR> cbs <CBS> pbs <PBS>',
      'traffic-limit inbound acl <ACL_ID> cir <CIR> pir <PIR> cbs <CBS> pbs <PBS>'
    ]
  ),
  article(
    'Huawei AAA - Ver usuario online por username',
    ['huawei', 'aaa', 'usuarios'],
    'consultar sessao online por usuario',
    ['display access-user authen-method radius username <USUARIO>']
  ),
  article(
    'Huawei AAA - Desconectar usuario por username',
    ['huawei', 'aaa', 'usuarios'],
    'encerrar sessao online por usuario',
    ['cut access-user authen-method radius username <USUARIO> all']
  ),
  article(
    'Huawei AAA - Desconectar usuario por IP',
    ['huawei', 'aaa', 'usuarios'],
    'encerrar sessao online por endereco IP',
    ['cut access-user ip-address <IP_USUARIO>']
  ),
  article(
    'Huawei AAA - Desconectar usuario por MAC',
    ['huawei', 'aaa', 'usuarios'],
    'encerrar sessao online por endereco MAC',
    ['cut access-user mac-address <MAC_USUARIO>']
  ),
  article(
    'Huawei AAA - Ver falhas de autenticacao',
    ['huawei', 'aaa', 'troubleshooting'],
    'listar registros de falha em autenticacao',
    ['display aaa online-fail-record']
  ),
  article(
    'Huawei AAA - Ver usuarios por VLAN',
    ['huawei', 'aaa', 'usuarios', 'vlan'],
    'listar usuarios de acesso por VLAN',
    ['display access-user pervaln <VLAN_ID>']
  ),
  article(
    'Huawei AAA - Ver usuarios por dominio',
    ['huawei', 'aaa', 'usuarios', 'dominio'],
    'listar usuarios de acesso por dominio',
    ['display access-user domain']
  ),
  article(
    'Huawei BGP - Resumo das sessoes',
    ['huawei', 'bgp', 'routing'],
    'visualizar panorama geral de sessoes BGP',
    ['display bgp all summary']
  ),
  article(
    'Huawei BGP - Ver detalhes de peer',
    ['huawei', 'bgp', 'routing'],
    'mostrar estado e parametros dos peers BGP',
    ['display bgp peer']
  ),
  article(
    'Huawei BGP - Ver rotas recebidas do peer',
    ['huawei', 'bgp', 'routing'],
    'listar prefixos recebidos de um peer especifico',
    ['display bgp routing-table peer <PEER_IP> received-routes']
  ),
  article(
    'Huawei BGP - Ver rotas anunciadas ao peer',
    ['huawei', 'bgp', 'routing'],
    'listar prefixos anunciados para um peer especifico',
    ['display bgp routing-table peer <PEER_IP> advertised-routes']
  ),
  article(
    'Huawei BGP - Ver route-policy',
    ['huawei', 'bgp', 'route-policy'],
    'consultar definicao de route-policy',
    ['display route-policy <NOME_POLICY>']
  ),
  article(
    'Huawei BGP - Troubleshooting',
    ['huawei', 'bgp', 'troubleshooting'],
    'consultar eventos e diagnostico do processo BGP',
    ['display bgp troubleshooting']
  ),
  article(
    'Huawei Roteamento - Ver rota para IP',
    ['huawei', 'routing', 'troubleshooting'],
    'consultar rota efetiva para um endereco IP',
    ['display ip routing-table <IP_DESTINO>']
  ),
  article(
    'Huawei Roteamento - Ver longest-match',
    ['huawei', 'routing', 'troubleshooting'],
    'consultar rota mais especifica para uma rede',
    ['display ip routing-table <PREFIXO> <MASCARA> longer-match']
  ),
  article(
    'Huawei Roteamento - Ver rotas ativas por protocolo BGP',
    ['huawei', 'routing', 'bgp'],
    'listar rotas da tabela IP filtradas por protocolo BGP',
    ['display ip routing-table protocol bgp']
  ),
  article(
    'Huawei MPLS - Ver L2VC por IP',
    ['huawei', 'mpls', 'l2vc'],
    'consultar L2VC filtrando por IP',
    ['display mpls l2vc ip']
  ),
  article(
    'Huawei MPLS - Ver L2VC por VLAN',
    ['huawei', 'mpls', 'l2vc'],
    'consultar L2VC filtrando por VLAN',
    ['display mpls l2vc vlan']
  ),
  article(
    'Huawei MPLS - Ver peers LDP',
    ['huawei', 'mpls', 'ldp'],
    'listar vizinhos LDP ativos',
    ['display mpls ldp peer']
  ),
  article(
    'Huawei SNMP - Habilitar SNMP v2c (template seguro)',
    ['huawei', 'snmp', 'monitoramento'],
    'habilitar SNMP com placeholders sem expor segredo real',
    ['snmp-agent sys-info version v2c', 'snmp-agent community read cipher <COMMUNITY_SEGURA>'],
    '- Nunca salvar community real na base compartilhada.'
  ),
  article(
    'Datacom Switch - Ver link aggregation',
    ['datacom', 'switch', 'interfaces'],
    'consultar estado de agregacao de links',
    ['show link-aggregation interface']
  ),
  article(
    'Datacom Switch - Ver descricao de interfaces',
    ['datacom', 'switch', 'interfaces'],
    'listar interfaces com descricao configurada',
    ['show interface description']
  ),
  article(
    'Datacom Switch - Ver transceiver 100G',
    ['datacom', 'switch', 'optico'],
    'consultar informacoes opticas da interface 100G',
    ['show interface transceivers hundred-gigabit-ethernet <SLOT/PORTA>']
  ),
  article(
    'Datacom Switch - Ver VPWS group MPLS',
    ['datacom', 'switch', 'mpls', 'vpws'],
    'consultar estado de VPWS por grupo',
    ['show mpls l2vpn vpws-group <NOME_GRUPO>']
  ),
  article(
    'OLT Huawei - Ver service-port da ONT',
    ['olt', 'huawei', 'gpon', 'ont'],
    'consultar service-port associado a uma ONT',
    ['display service-port port <FRAME/SLOT/PORT> ont <ONT_ID>']
  ),
  article(
    'OLT Huawei - Remover service-port',
    ['olt', 'huawei', 'gpon', 'ont'],
    'remover um service-port especifico',
    ['undo service-port <SERVICE_PORT_ID>']
  ),
  article(
    'OLT Huawei - Deletar ONT',
    ['olt', 'huawei', 'gpon', 'ont'],
    'remover ONT registrada da PON',
    ['ont delete <PON_ID> <ONT_ID>']
  ),
  article(
    'OLT Huawei - Listar ONTs da PON',
    ['olt', 'huawei', 'gpon', 'ont'],
    'listar ONTs de uma PON especifica',
    ['display ont info <FRAME> <SLOT> <PON> all']
  ),
  article(
    'OLT Huawei - Buscar ONTs para autorizacao',
    ['olt', 'huawei', 'gpon', 'autofind'],
    'listar ONTs detectadas e ainda nao autorizadas',
    ['display ont autofind all']
  ),
  article(
    'OLT Huawei - Consultar ONT por serial',
    ['olt', 'huawei', 'gpon', 'ont'],
    'consultar informacoes da ONT via serial',
    ['display ont info by-sn <SN_ONT>']
  ),
  article(
    'OLT Huawei - Ver sinal uplink (DDM)',
    ['olt', 'huawei', 'gpon', 'optico'],
    'consultar potencia optica na uplink da OLT',
    ['interface mpu <FRAME/SLOT>', 'display port ddm-info <PORTA_UPLINK>']
  ),
  article(
    'OLT Huawei - Ver sinal optico da ONT',
    ['olt', 'huawei', 'gpon', 'optico'],
    'consultar potencia optica da ONT na PON',
    ['display ont optical-info <PON_ID> <ONT_ID>']
  ),
  article(
    'OLT Fiberhome - Reboot de ONU',
    ['olt', 'fiberhome', 'gpon', 'onu'],
    'reiniciar ONU em slot e PON especificos',
    ['cd maintenance', 'reboot slot <SLOT> pon <PON> onu <ONU_ID>']
  ),
  article(
    'OLT Intelbras - Listar ONUs GPON',
    ['olt', 'intelbras', 'gpon', 'onu'],
    'listar ONUs em interfaces GPON',
    ['show ont brief interface gpon all']
  ),
  article(
    'OLT Intelbras - Remover ONT/ONU',
    ['olt', 'intelbras', 'gpon', 'onu'],
    'remover registro de ONT/ONU',
    ['delete aim <FRAME/SLOT/ONT_ID>']
  ),
  article(
    'OLT Digistar - Listar ONUs descobertas',
    ['olt', 'digistar', 'gpon', 'onu'],
    'listar ONUs descobertas na OLT',
    ['onu show discovered']
  ),
  article(
    'OLT Digistar - Listar ONUs da PON',
    ['olt', 'digistar', 'gpon', 'onu'],
    'listar ONUs de um link/PON especifico',
    ['onu showall <PON_LINK>']
  ),
  article(
    'OLT Digistar - Provisionar bridge da ONU',
    ['olt', 'digistar', 'gpon', 'onu'],
    'criar bridge para ONU com GEM/GTP/VLAN',
    ['bridge add gpon-1 onu <ONU_ID> gem <GEM_ID> gtp <GTP_ID> vlan <VLAN_ID>']
  ),
  article(
    'VSOL EPON - Autorizar ONU por MAC',
    ['olt', 'vsol', 'epon', 'onu'],
    'autorizar ONU por MAC em interface EPON',
    ['enable', 'configure terminal', 'interface epon <FRAME/PORT>', 'onu mac-auth add <MAC_ONU>']
  ),
  article(
    'OLT Datacom - Criar usuario administrador',
    ['olt', 'datacom', 'usuarios'],
    'criar usuario com privilegio administrativo',
    ['aaa user <USUARIO>', 'password <SENHA_FORTE>', 'group admin', 'commit']
  ),
  article(
    'OLT Datacom - Desautorizar ONU',
    ['olt', 'datacom', 'onu'],
    'remover service-port e ONU registrada em uma PON',
    [
      'show running-config service-port gpon <FRAME/SLOT/PORTA> | context-match onu',
      'no service-port <SERVICE_PORT_ID>',
      'interface gpon <FRAME/SLOT/PORTA>',
      'no onu <ONU_ID>',
      'commit'
    ]
  ),
  article(
    'OLT ZTE GPON - Listar ONU nao configurada',
    ['olt', 'zte', 'gpon', 'onu'],
    'listar ONUs nao configuradas na OLT',
    ['show gpon onu uncfg']
  ),
  article(
    'OLT ZTE GPON - Ver estado de ONU por porta',
    ['olt', 'zte', 'gpon', 'onu'],
    'consultar status das ONUs por porta GPON',
    ['show gpon onu state gpon-olt_<FRAME/SLOT/PORT>']
  ),
  article(
    'OLT ZTE GPON - Remover ONU registrada',
    ['olt', 'zte', 'gpon', 'onu'],
    'remover ONU especifica da porta GPON',
    ['con t', 'interface gpon-olt_<FRAME/SLOT/PORT>', 'no onu <ONU_ID>']
  ),
  article(
    'OLT ZTE GPON - Ver configuracao de ONU',
    ['olt', 'zte', 'gpon', 'onu'],
    'consultar configuracao de uma ONU especifica',
    ['show running-config interface gpon-onu_<FRAME/SLOT/PORT>:<ONU_ID>']
  ),
  article(
    'OLT ZTE GPON - Ver MAC address',
    ['olt', 'zte', 'gpon', 'mac'],
    'consultar tabela MAC da OLT',
    ['show mac']
  )
];

async function ensureUniqueSlug(tenantId, title) {
  const base = slugify(title);
  let candidate = base;
  let index = 2;
  while (true) {
    const existing = await prisma.knowledgeArticle.findFirst({
      where: { tenantId, slug: candidate },
      select: { id: true }
    });
    if (!existing) return candidate;
    candidate = `${base}-${index++}`;
  }
}

async function main() {
  const tenantSlug = process.env.TENANT_SLUG || 'ajust-demo';
  const authorEmail = process.env.AUTHOR_EMAIL || 'analista@ajust.local';

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true }
  });
  if (!tenant) {
    throw new Error(`Tenant not found for slug: ${tenantSlug}`);
  }

  const author = await prisma.user.findUnique({
    where: { email: authorEmail },
    select: { id: true, email: true }
  });

  const deleted = await prisma.knowledgeArticle.deleteMany({
    where: { tenantId: tenant.id }
  });

  let createdCount = 0;
  for (const item of ARTICLES) {
    const slug = await ensureUniqueSlug(tenant.id, item.title);
    await prisma.knowledgeArticle.create({
      data: {
        tenantId: tenant.id,
        authorUserId: author?.id || null,
        title: item.title,
        slug,
        content: item.content,
        isPublished: true,
        tags: {
          create: item.tags.map((tagName) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName }
              }
            }
          }))
        }
      }
    });
    createdCount += 1;
  }

  // Optional cleanup: remove tags that are no longer used by any article.
  await prisma.knowledgeTag.deleteMany({
    where: {
      articles: {
        none: {}
      }
    }
  });

  console.log(
    JSON.stringify(
      {
        tenant: tenant.slug,
        author: author?.email || null,
        deletedArticles: deleted.count,
        createdArticles: createdCount
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
