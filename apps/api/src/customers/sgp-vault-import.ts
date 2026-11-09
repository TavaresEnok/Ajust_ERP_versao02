/**
 * Converte anotações de cliente do SGP em itens do cofre, no mesmo formato dos acessos
 * revisados da Meganet: nome tirado do título da anotação, categoria do cofre pelo
 * vocabulário do equipamento e itens duvidosos em "A CONFERIR". O texto original segue
 * criptografado em cada item, para conferência por revelação auditada.
 */
import { noteText, parseAccessNote } from './sgp-credential-parser';

export type SgpVaultEntry = {
  externalId: string;
  equipmentType: string;
  equipmentName: string;
  accessMethod: 'WEB' | 'SSH' | 'OUTROS' | 'SEM_ACESSO';
  host: string;
  username: string;
  secret: string;
  orientation: string;
  missing: string[];
  ambiguous: boolean;
  reviewRequired: boolean;
};

const CREDENTIAL_LINE =
  /(?:^|\s)(?:login|usu[aá]rio|user(?:name)?|senha|password|pass(?:wd)?|token|secret|chave|key)\b/i;

// Ordem importa: o primeiro padrão que casar define a categoria.
const CATEGORY_RULES: [RegExp, string][] = [
  [
    /\b(?:OLT|GPON|EPON|VSOL|MA5[68]\d{2}|X7|FIBERHOME|AN5516|ZTE\s*C[36]\d{2}|PARKS|ONU|ONT)\b/i,
    'OLT',
  ],
  [/\b(?:CGNAT|FIREWALL|PFSENSE|OPNSENSE|HILLSTONE|FORTI\w*|SOPHOS)\b/i, 'FIREWALL'],
  [/\b(?:SW\d*|SWITCH|CRS\d*|CSS\d*|DATACOM|DM\d{4}|S\d{4}-\w+|HUAWEI\s*S\d{4})\b/i, 'SW'],
  [
    /\b(?:CCR\s*\d*|RB\s*\d*|ROUTERBOARD|MIKROTIK|NE\s?(?:20|40|8000)\w*|BORDA|CONCENTRADOR|AUTENTICADOR|BRAS|BNG|JUNIPER|MX\d+|CISCO|ROTEADOR|ROUTER|GW-\w+|GATEWAY)\b/i,
    'ROUTER',
  ],
  [
    /\b(?:PTP|PTMP|UBNT|UBIQUITI|AIRMAX|AIRFIBER|LITEBEAM|POWERBEAM|R[AÁ]DIO|ENLACE|\bAP\b)\b/i,
    'ENLACE',
  ],
  [/\b(?:DNS|UNBOUND|BIND|RECURSIVO|AUTORITATIVO|PIHOLE)\b/i, 'DNS'],
  [
    /\b(?:VM|PROXMOX|VMWARE|ESXI|HYPER-?V|SERVIDOR|SERVER|IPMI|IDRAC|ILO|HOST\s+F[IÍ]SICO|FTP|LINUX|WINDOWS)\b/i,
    'SERVIDOR',
  ],
  [
    /\b(?:ANYDESK|TEAMVIEWER|VPN|WIREGUARD|OPENVPN|L2TP|PPTP|SSTP|WINBOX|RDP|ACESSO\s+REMOTO)\b/i,
    'ACESSO REMOTO',
  ],
  [
    /\b(?:ASN|AS\d{3,}|BLOCOS?|PREFIXOS?|IPV6|IPV4|ROTEADOS|PEERINGDB|REGISTRO\.?BR|LOOKING\s+GLASS)\b/i,
    'REDE',
  ],
  [/\b(?:OPERADORAS?|LINKS?|TR[AÂ]NSITO|IX\b|PTT|CIRCUITOS?|BANDA|UPSTREAM|CDN)\b/i, 'CIRCUITOS'],
  [
    /\b(?:SGP|IXC|MKAUTH|RADIUS\w*|ZABBIX|GRAFANA|PHPIPAM|GENIE\s*ACS|ACS|UNIFI|PABX|ISSABEL|ASTERISK|WEBCHAT|CHATWOOT|SPEEDTEST|PAINEL|PORTAL|SITE|E-?MAIL|GMAIL|WHATSAPP|SISTEMA|C[AÂ]MERAS?|NVR|DVR|THE\s+DUDE|NETBOX|OXIDIZED|LIBRENMS)\b/i,
    'SISTEMA',
  ],
];

export function categoryFor(text: string) {
  return CATEGORY_RULES.find(([re]) => re.test(text))?.[1] ?? 'OUTROS';
}
/** O título manda; o corpo da anotação só decide quando o título não diz o que é. */
export function categoryOf(title: string, body: string) {
  const byTitle = categoryFor(title);
  return byTitle !== 'OUTROS' ? byTitle : categoryFor(body);
}
const GENERIC_TITLE =
  /^(?:acessos?|equipamentos?|dados|informa[cç][oõ]es|login|credenciais?|segue|obs\.?|observa[cç][aã]o)$/i;

/** Primeira linha que descreve o acesso, sem usuário/senha, emoji ou prefixos vazios. */
export function titleFrom(lines: string[]) {
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || CREDENTIAL_LINE.test(line) || /[:=]\s*\S/.test(line) || line.includes('@'))
      continue;
    const title = line
      .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
      .replace(/^[=\-–—>#*•·\s]+|[=\-–—>#*•·:\s]+$/g, '')
      .replace(
        /^(?:segue\s+(?:o|os|a|as)\s+)?acessos?\s+(?:ao|à|a|aos|as|da|do|das|dos|de|para|via)?\s*/i,
        '',
      )
      .replace(/^credenci?ais\s+(?:para\s+)?(?:acessar\s+)?(?:a|o)?\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (title.length >= 2 && !GENERIC_TITLE.test(title) && !/^https?:\/\//i.test(title))
      return title.slice(0, 90);
  }
  return '';
}

function accessMethodFor(host: string, text: string, hasCredential: boolean) {
  if (!host && !hasCredential) return 'SEM_ACESSO' as const;
  if (/^https?:\/\//i.test(host)) return 'WEB' as const;
  if (/(?::22\b|\bssh\b)/i.test(`${host} ${text}`)) return 'SSH' as const;
  return 'OUTROS' as const;
}

export function buildSgpVaultEntries(
  html: string,
  ids: { customerId: number; noteId: number },
): SgpVaultEntry[] {
  const parts = parseAccessNote(html, ids.noteId);
  const noteLines = noteText(html)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const noteTitle = titleFrom(noteLines);
  return parts.map((part) => {
    const lines = part.sourceText.split('\n');
    const own = titleFrom(lines);
    const title = own || noteTitle;
    const hasCredential = Boolean(part.username || part.secret);
    const detected = categoryOf(title, part.sourceText);
    const informative = !part.host && !hasCredential && !part.ambiguous;
    // Vários pares de acesso na mesma anotação, ou acesso sem senha identificável, pedem revisão.
    const doubtful = part.ambiguous || (!informative && !part.secret);
    const equipmentType = informative
      ? ['REDE', 'CIRCUITOS'].includes(detected)
        ? detected
        : 'DOCUMENTO'
      : doubtful
        ? 'A CONFERIR'
        : detected;
    const fallback = `${detected === 'OUTROS' ? 'Acesso' : detected} · anotação SGP ${ids.noteId}`;
    return {
      externalId: `ajustconsulting.sgp.net.br:cliente:${ids.customerId}:anotacao:${ids.noteId}:parte:${part.part}`,
      equipmentType,
      equipmentName: title || fallback,
      accessMethod: accessMethodFor(part.host, part.sourceText, hasCredential),
      host: part.host,
      username: part.username,
      secret: part.secret,
      orientation: part.sourceText,
      missing: part.missing,
      ambiguous: part.ambiguous,
      reviewRequired: doubtful,
    };
  });
}

/** Nomes repetidos no mesmo provedor ganham numeração, para a lista não ficar ambígua. */
export function numberRepeatedNames<T extends { equipmentName: string }>(entries: T[]) {
  const seen = new Map<string, number>();
  return entries.map((entry) => {
    const key = entry.equipmentName.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? entry : { ...entry, equipmentName: `${entry.equipmentName} (${count})` };
  });
}
