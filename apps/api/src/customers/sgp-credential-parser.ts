import { commentText } from '../service-processes/import-sgp-pilot';

// Entidades nomeadas comuns nas anotações do SGP (acentos do português e pontuação).
const NAMED_ENTITIES: Record<string, string> = {
  mdash: '—',
  ndash: '–',
  hellip: '…',
  bull: '•',
  middot: '·',
  deg: '°',
  ordm: 'º',
  ordf: 'ª',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  euro: '€',
  copy: '©',
  Aacute: 'Á',
  aacute: 'á',
  Agrave: 'À',
  agrave: 'à',
  Acirc: 'Â',
  acirc: 'â',
  Atilde: 'Ã',
  atilde: 'ã',
  Eacute: 'É',
  eacute: 'é',
  Ecirc: 'Ê',
  ecirc: 'ê',
  Iacute: 'Í',
  iacute: 'í',
  Oacute: 'Ó',
  oacute: 'ó',
  Ocirc: 'Ô',
  ocirc: 'ô',
  Otilde: 'Õ',
  otilde: 'õ',
  Uacute: 'Ú',
  uacute: 'ú',
  Uuml: 'Ü',
  uuml: 'ü',
  Ccedil: 'Ç',
  ccedil: 'ç',
};
export function noteText(html: string) {
  return commentText(html)
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
      const value = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
      return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
    })
    .replace(/&([A-Za-z]+);/g, (whole, name: string) => NAMED_ENTITIES[name] ?? whole);
}
const labels =
  /^(?:login|usu[aá]rio|user(?:name)?|senha|password|pass|ip|host|url|porta|port|endere[cç]o)\s*[:=]?\s*$/i;
const system =
  /^(?:\d+[.)]?\s*)?(GRAFANA|ZABBIX|PROXMOX|SGP|IXC|OLT|SWITCH|VPN|DNS|RB\b|BGP|NE20|MIKROTIK|BACKUP|VMWARE|IPMI|IDRAC)\b/i;
export function parseAccessNote(html: string, id: number) {
  const text = noteText(html);
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const cuts = lines.flatMap((line, i) =>
    system.test(line) &&
    line.length < 130 &&
    !/(?:senha|password|login|usuario|username)\s*[:=]/i.test(line) &&
    !(i > 0 && labels.test(lines[i - 1]))
      ? [i]
      : [],
  );
  // Split only explicit equipment headings, never infer associations between unrelated user/password pairs.
  const starts = cuts.length > 1 ? [...new Set([0, ...cuts])] : [0];
  return starts
    .map((start, index) => {
      const segment = lines.slice(start, starts[index + 1] ?? lines.length);
      function fields(label: string) {
        const re = new RegExp(`^(?:${label})\\s*(?:[:=]\\s*(.*)|$)`, 'i');
        return [
          ...new Set(
            segment.flatMap((line, i) => {
              const m = line.match(re);
              if (!m) return [];
              const value = (
                m[1] ||
                (!labels.test(segment[i + 1] || '') ? segment[i + 1] : '') ||
                ''
              ).trim();
              return value ? [value] : [];
            }),
          ),
        ];
      }
      const users = fields('login|usu[aá]rio|user(?:name)?'),
        secrets = fields('senha|password|pass');
      const explicitHosts = fields('ip|host|url|endere[cç]o(?:\\s+de\\s+acesso)?');
      const publicLines = segment.filter(
        (line, i) =>
          !/^(?:login|usu[aá]rio|user(?:name)?|senha|password|pass)\s*(?:[:=]|$)/i.test(line) &&
          !(
            i > 0 &&
            /^(?:login|usu[aá]rio|user(?:name)?|senha|password|pass)\s*[:=]?\s*$/i.test(
              segment[i - 1],
            )
          ),
      );
      const urls = publicLines.flatMap((l) => l.match(/https?:\/\/[^\s<>"']+/gi) || []);
      const ips = publicLines.flatMap(
        (l) => l.match(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g) || [],
      );
      const hostCandidates = [...new Set([...explicitHosts, ...urls, ...ips])];
      const rawHost =
        hostCandidates.find((h) => /^https?:\/\//i.test(h)) ||
        hostCandidates.find((h) => /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(h)) ||
        '';
      let host = rawHost;
      if (/^https?:\/\//i.test(rawHost)) {
        try {
          const u = new URL(rawHost);
          u.username = '';
          u.password = '';
          u.search = '';
          u.hash = '';
          host = u.toString();
        } catch {
          host = '';
        }
      }
      const heading = segment.find(
        (l, i) =>
          system.test(l) &&
          !(i > 0 && labels.test(segment[i - 1])) &&
          l.length < 130 &&
          !/\b(?:senha|password|login|usu[aá]rio|token|secret)\b/i.test(l),
      );
      const kind =
        heading?.match(system)?.[1]?.toUpperCase() ||
        segment
          .join(' ')
          .match(/\b(PROXMOX|GRAFANA|ZABBIX|SGP|IXC|OLT|SWITCH|VPN|DNS|MIKROTIK)\b/i)?.[1]
          ?.toUpperCase() ||
        'OUTROS';
      const equipmentType = /OLT/.test(kind)
        ? 'OLT'
        : /RB|BGP|NE20|MIKROTIK/.test(kind)
          ? 'ROUTER'
          : kind === 'SWITCH'
            ? 'SW'
            : kind === 'DNS'
              ? 'DNS'
              : /PROXMOX|VMWARE/.test(kind)
                ? 'VM'
                : /GRAFANA|ZABBIX|SGP|IXC|BACKUP/.test(kind)
                  ? 'SISTEMA'
                  : 'OUTROS';
      return {
        part: index,
        equipmentType,
        equipmentName: heading || `${kind} · anotação SGP ${id}`,
        host,
        username: users.length === 1 ? users[0] : '',
        secret: secrets.length === 1 ? secrets[0] : '',
        ambiguous: users.length > 1 || secrets.length > 1,
        missing: [
          ...(!host ? ['endereço'] : []),
          ...(users.length !== 1 ? ['usuário'] : []),
          ...(secrets.length !== 1 ? ['senha'] : []),
        ],
        sourceText: segment.join('\n'),
      };
    })
    .filter((p) => p.sourceText.trim());
}
