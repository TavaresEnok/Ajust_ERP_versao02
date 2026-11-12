/**
 * Segunda passada no cofre (12/11/2026): itens que ainda estavam em "A conferir" ou com
 * usuários grudados ("a / b"). Lê a anotação como uma pessoa leria: blocos ("ACESSO WEB",
 * "LINUX", "Banco de dados", "-----"), rótulos com qualificador ("Usuário VPN", "Senha WEB",
 * "Senha do banco"), usuário dentro do rótulo ("User root: X", "Senha root: X"), rótulo numa
 * linha e valor na seguinte, listas "a / b" e senhas alternativas.
 *
 *   docker exec -i ajust_erp-api-1 node - < scripts/curar-cofre-sgp-2.js            (simulação)
 *   docker exec -i -e APPLY=1 ajust_erp-api-1 node - < scripts/curar-cofre-sgp-2.js (grava)
 *
 * Trava: todo usuário e senha gravado precisa existir, igual, na anotação original; a
 * anotação nunca é alterada; a saída nunca mostra segredo (só formato mascarado).
 */
const { PrismaClient } = require('/app/apps/api/node_modules/@prisma/client');
const { decryptVaultSecret, encryptVaultSecret, vaultSourceNoteText } = require('/app/apps/api/dist/common/vault.crypto.js');
const { unpackVaultContent, packVaultContent, VaultAccessSchema } = require('/app/apps/api/dist/common/vault-content.js');
const { categoryFor } = require('/app/apps/api/dist/customers/sgp-vault-import.js');
const { decodeHTML } = require('/app/node_modules/.pnpm/entities@6.0.1/node_modules/entities');

const APPLY = process.env.APPLY === '1';
const VERSION = 'auto-2026-11-12-b';
const prisma = new PrismaClient();
const mask = (s) => String(s ?? '').replace(/[A-Za-zÀ-ÿ]/g, 'a').replace(/\d/g, '9');
const clean = (s) =>
  decodeHTML(String(s || '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>|<\/td>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/ /g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[ \t]+/g, ' ')
    // "Usuário: admin / Senha: x" ou "Usuário: root Senha: root" na mesma linha: duas linhas.
    .split('\n')
    .map((l) =>
      /^\s*(login|usu[aá]rio|usuario|user)\b/i.test(l) && /\S\s*(?:[\/;|]\s*)?\b(senha|password)\s*:/i.test(l)
        ? l.replace(/\s*(?:[\/;|]\s*)?\b(senha|password)(\s*:)/i, '\n$1$2')
        : l,
    )
    .join('\n');
const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const METHOD_WORDS = [
  [/\b(web|http|https|painel|site|navegador)\b/, 'WEB'],
  [/\b(ssh|linux|shell|console)\b/, 'SSH'],
  [/\bwinbox\b/, 'WINBOX'],
  [/\btelnet\b/, 'TELNET'],
  [/\b(rdp|windows|area de trabalho)\b/, 'RDP'],
  [/\banydesk\b/, 'ANYDESK'],
  [/\b(banco|db|mysql|postgres|database)\b/, 'BANCO'],
];
const methodOf = (text) => METHOD_WORDS.find(([re]) => re.test(strip(text)))?.[1] || null;
const QUALIFIER_IS_CONTEXT = /\b(web|ssh|winbox|telnet|vpn|rdp|banco|db|wifi|wi-fi|sistema|painel|acesso|do|da|de|aplicacao|app|api|ftp|sftp|mysql|postgres|e-?mail|cliente|admin(istrador)?|master|leitura|novo|nova|antigo|antiga|\d+)\b/;

const U_RE = /^(login|logins|usu[aá]rios?|usuario|users?|username|e-?mail|ssid)\b([^:=;]*?)\s*(?:[:=;]\s*(.*))?$/i;
const S_RE = /^(senhas?|password|pass(?:wd)?|pwd)\b([^:=;]*?)\s*(?:[:=;]\s*(.*))?$/i;
const P_RE = /^portas?\b([^:=;\d]*?)\s*(?:[:=;]\s*)?(\d{1,5})?\s*$/i;
const ADDR_IN = /https?:\/\/[^\s"'<>|]+|(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?/i;
const SEP = /^[-=_#*~.]{5,}/;
const ADDR_LABEL = /^(ip|ips|host|url|link|endere[cç]o|acesso(?:\s+[a-zà-ú]+){0,3}|ip(?:\s+[a-zà-ú]+){1,3})\s*[:=]?\s*$/i;
const isLabel = (l) => U_RE.test(l) || S_RE.test(l) || P_RE.test(l) || ADDR_LABEL.test(l);
const splitList = (v) => v.split(/\s+(?:\/\/?|\|)\s+/).map((x) => x.trim()).filter(Boolean);

function endpointOf(raw) {
  const m = String(raw || '').match(ADDR_IN);
  if (!m) return null;
  let v = m[0].replace(/[),.;]+$/, '');
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      u.username = '';
      u.password = '';
      return { host: u.toString(), port: null, web: true };
    } catch {
      return null;
    }
  }
  const ip = v.match(/^((?:\d{1,3}\.){3}\d{1,3})(?::(\d{1,5}))?$/);
  return ip ? { host: ip[1], port: ip[2] ? Number(ip[2]) : null, web: false } : null;
}

/** Lê a anotação e devolve os pares usuário/senha com o contexto de cada um. */
function parse(note) {
  const lines = note.split('\n').map((l) => l.trim()).filter(Boolean);
  const pairs = [];
  const issues = [];
  let section = { title: '', method: null, addr: null, port: null, orphans: [] };
  let firstAddr = null;
  let lastAddr = null;
  // Endereço lido de uma linha de endereço ("IP: x", "https://..."): vale para os pares do bloco,
  // inclusive os que vieram antes dele no mesmo bloco ("usuário / senha / URL").
  const setAddr = (ep, strong) => {
    if (!ep) return;
    if (strong || !section.addr) section.addr = ep;
    if (strong) {
      section.orphans.forEach((p) => (p.addr = p.addr || ep));
      section.orphans = [];
      lastAddr = ep;
      firstAddr = firstAddr || ep;
    }
  };
  let pendingUsers = null; // { values, method, context }
  let lastUsers = null;
  const valueAt = (i, inline) => {
    if (inline !== undefined && inline !== null && inline.trim() !== '') return { v: inline.trim(), used: i };
    const next = lines[i + 1];
    if (next && !isLabel(next) && !SEP.test(next)) return { v: next, used: i + 1 };
    return { v: '', used: i };
  };
  const newSection = (title) => {
    if (pendingUsers) {
      push({ users: pendingUsers.values, secrets: [], ...ctx(pendingUsers) });
      pendingUsers = null;
    }
    section = { title: title.replace(/[:=#*]+$/g, '').replace(/^[#=*\s-]+|[#=*\s-]+$/g, '').slice(0, 50), method: methodOf(title), addr: null, port: null, orphans: [] };
    lastUsers = null;
  };
  // Porta e tipo do bloco valem no fim (a porta costuma vir depois do usuário e senha).
  const ctx = (extra = {}) => ({
    section: section.title,
    sec: section,
    ownMethod: extra.method || null,
    addr: section.addr,
    fallback: lastAddr,
    context: extra.context || '',
  });
  const push = (pair) => {
    pairs.push(pair);
    if (!pair.addr) section.orphans.push(pair);
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SEP.test(line)) {
      newSection('');
      continue;
    }
    let m;
    if (/\bsenha\b.*\bdo\b.*=|usu[aá]rio e senha/i.test(line)) continue; // "Usuário e senha do banco = x y": sem separação confiável
    if ((m = line.match(P_RE)) && (m[2] || !/[:=]/.test(line))) {
      const { v, used } = m[2] ? { v: m[2], used: i } : valueAt(i, null);
      if (/^\d{1,5}$/.test(v)) {
        section.port = Number(v);
        section.method = section.method || methodOf(m[1] || '');
        i = used;
      }
      continue;
    }
    if ((m = line.match(U_RE))) {
      const qual = (m[2] || '').trim();
      const { v, used } = valueAt(i, m[3]);
      const q = strip(qual);
      // "Usuário mysql: root" + "Senha: x": rótulo de usuário. Só vale se a senha seguinte não tiver
      // qualificador próprio ("Senha do banco:" é outra credencial).
      const nextS = (lines[used + 1] || '').match(S_RE);
      const nextIsSecret = !!nextS && !(nextS[2] || '').trim();
      if (qual && !QUALIFIER_IS_CONTEXT.test(q) && /^\S+$/.test(qual) && v && v !== qual && !nextIsSecret && !/^ssid$/i.test(m[1])) {
        // "User root: X" / "Usuário root:" + valor: o nome está no rótulo e o valor é a senha.
        push({ users: [qual], secrets: [v], ...ctx({}) });
        i = used;
        continue;
      }
      if (!v) {
        i = used;
        continue;
      }
      // "admin ( WEB )": o parêntese diz o tipo de acesso.
      const paren = v.match(/^(.*?)\s*\(\s*([^)]*)\)\s*$/);
      const value = paren ? paren[1] : v;
      if (pendingUsers) push({ users: pendingUsers.values, secrets: [], ...ctx(pendingUsers) });
      pendingUsers = { values: splitList(value), method: methodOf(qual) || (paren ? methodOf(paren[2]) : null), context: /^ssid$/i.test(m[1]) ? 'Wi-Fi' : qual };
      i = used;
      continue;
    }
    if ((m = line.match(S_RE))) {
      let qual = (m[2] || '').trim().replace(/^[-\s]+/, '');
      let inline = m[3];
      // "Senhas @#$abc.." sem dois-pontos: o "qualificador" é a própria senha.
      if (inline === undefined && /^\S{6,}$/.test(qual) && /[^A-Za-zÀ-ÿ]/.test(qual)) {
        inline = qual;
        qual = '';
      }
      const { v, used } = valueAt(i, inline);
      i = used;
      if (!v) continue;
      const q = strip(qual);
      let users = pendingUsers?.values || null;
      let method = pendingUsers?.method || methodOf(qual);
      let context = pendingUsers?.context || '';
      if (qual && !QUALIFIER_IS_CONTEXT.test(q) && /^\S+$/.test(qual)) {
        users = [qual]; // "Senha root: X"
      } else if (qual) {
        context = context || qual;
        if (/\bbanco|db\b/.test(q)) method = 'BANCO';
        if (!users && /\b(root)\b/.test(q)) users = ['root'];
      }
      if (!users && !pendingUsers && lastUsers && !qual) users = lastUsers; // senha alternativa logo depois
      push({ users: users || [''], secrets: splitList(v), ...ctx({ method, context }) });
      if (pendingUsers) lastUsers = pendingUsers.values;
      pendingUsers = null;
      continue;
    }
    // endereço: rótulo "IP:/URL:/Acesso Web:" com valor, linha só com endereço, ou "SSH: user@ip"
    const sshAt = line.match(/^(?:ssh|acesso ssh)\s*[:=]?\s*(?:ssh\s+)?([\w.\-]+)@((?:\d{1,3}\.){3}\d{1,3})/i);
    if (sshAt) {
      newSection('SSH');
      section.addr = endpointOf(sshAt[2]);
      section.method = 'SSH';
      pendingUsers = { values: [sshAt[1]], method: 'SSH', context: '' };
      continue;
    }
    const ep = endpointOf(line);
    const labelOnly = /^(ip|ips|host|url|link|endere[cç]o|acesso[^:]*|ip [^:]*)\s*:?\s*$/i.test(line);
    if (labelOnly) {
      const { v, used } = valueAt(i, null);
      const e2 = endpointOf(v);
      if (/^acesso/i.test(line) && !e2) {
        newSection(line);
        continue;
      }
      if (e2) {
        if (/^acesso/i.test(line)) newSection(line);
        setAddr(e2, true);
        section.method = section.method || methodOf(line) || (e2.web ? 'WEB' : null);
        i = used;
      }
      continue;
    }
    if (ep) {
      const titled = /^acesso\b/i.test(line) || /^[^:]{2,40}:\s*(?:ssh\s+)?(https?:\/\/|\d)/i.test(line);
      if (titled && !/^(ip|ips|host|url|link)\b/i.test(line)) newSection(line.split(':')[0]);
      // Linha que é só o endereço, ou "IP: x" / "IP = x": endereço do bloco. Endereço no meio
      // de uma frase ("fica no servidor 1.2.3.4") só vale se o bloco não tiver outro.
      const strong = ADDR_IN.test(line) && (line.replace(ADDR_IN, '').replace(/^[\s\w.-]{0,30}[:=]/, '').trim().length <= 3 || titled);
      setAddr(ep, strong);
      section.method = section.method || methodOf(line) || (ep.web ? 'WEB' : null);
      continue;
    }
    // "root / admin" ou "Logon: admin" logo antes de uma linha de senha: são os usuários.
    if (S_RE.test(lines[i + 1] || '') && !pendingUsers) {
      const bare = line.match(/^([\w.@-]{2,40})(?:\s+\/\s+([\w.@-]{2,40}))+$/);
      const kv = line.match(/^[A-Za-zÀ-ÿ]{3,12}\s*:\s*([\w.@-]{2,60})$/);
      if (bare) {
        pendingUsers = { values: splitList(line), method: null, context: '' };
        continue;
      }
      if (kv) {
        pendingUsers = { values: [kv[1]], method: null, context: '' };
        continue;
      }
    }
    // título de bloco: linha curta sem ':' e com letras (ex.: "ACESSO WEB", "LINUX", "GRAFANA")
    if (line.length <= 60 && !/[:=]/.test(line) && /[A-Za-zÀ-ÿ]{3}/.test(line) && (/^[^a-z]*$/.test(line) || /^(acesso|banco|vm|maquina|máquina)\b/i.test(line))) {
      newSection(line);
      continue;
    }
  }
  if (pendingUsers) push({ users: pendingUsers.values, secrets: [], ...ctx(pendingUsers) });

  const entries = [];
  for (const p of pairs) {
    const { users, secrets } = p;
    let combos = [];
    if (!secrets.length) combos = users.map((u) => [u, '']);
    else if (users.length === secrets.length) combos = users.map((u, k) => [u, secrets[k]]);
    else if (users.length === 1) combos = secrets.map((s) => [users[0], s]);
    else if (secrets.length === 1) combos = users.map((u) => [u, secrets[0]]);
    else {
      issues.push(`listas de tamanhos diferentes (${users.length} usuários, ${secrets.length} senhas)`);
      continue;
    }
    combos.forEach(([u, s], k) => {
      if (!u && !s) return;
      const wifi = p.context === 'Wi-Fi';
      let addr = wifi ? null : p.addr || p.sec.addr || p.fallback || firstAddr;
      const method = p.ownMethod || p.sec.method || (addr?.web ? 'WEB' : null) || 'OUTROS';
      // SSH, Winbox etc. com endereço web anotado: usa só o host.
      if (addr?.web && method !== 'WEB') {
        try {
          const url = new URL(addr.host);
          addr = { host: url.hostname, port: url.port ? Number(url.port) : null, web: false };
        } catch {
          /* mantém */
        }
      }
      const label = [p.section, p.context && !strip(p.section).includes(strip(p.context)) ? p.context : '', u || 'sem usuário']
        .filter(Boolean)
        .join(' · ')
        .replace(/\s+/g, ' ')
        .slice(0, 120);
      entries.push({
        label: combos.length > 1 && users.length === 1 && secrets.length > 1 ? `${label} (senha ${k + 1})`.slice(0, 120) : label,
        method,
        host: addr?.host || '',
        port: addr?.web || wifi ? null : p.sec.port ?? addr?.port ?? null,
        context: '',
        username: u,
        secret: s,
        notes: '',
      });
    });
  }
  return { entries, issues };
}

(async () => {
  const rows = await prisma.knowledgeCredential.findMany({
    where: { OR: [{ equipmentType: 'A CONFERIR' }, { username: { contains: ' / ' } }] },
    orderBy: [{ provider: 'asc' }, { equipmentName: 'asc' }],
  });
  const c = {};
  const inc = (k, n = 1) => (c[k] = (c[k] || 0) + n);
  const report = [];
  const updates = [];
  for (const r of rows) {
    const raw = r.sourceNoteEnc ? vaultSourceNoteText(r.sourceNoteEnc) || '' : '';
    const note = clean(raw);
    const content = unpackVaultContent(r.protectedContentEnc ? decryptVaultSecret(r.protectedContentEnc) : null);
    if (content.accessEntries.length) {
      inc('já estruturado');
      continue;
    }
    const { entries: parsed, issues } = parse(note);
    const inNote = (v) => !v || note.includes(v) || raw.includes(v);
    // Mesmo par repetido na anotação (cópia do bloco) vira um só.
    const seen = new Set();
    let entries = parsed.filter((e) => {
      const k = [e.host, e.username, e.secret].join('\u0001');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const hasSecrets = entries.some((e) => e.secret);
    // Usuário sem senha ao lado de acessos completos, e senha repetida sem usuário, só poluem.
    entries = entries.filter(
      (e) =>
        !(hasSecrets && !e.secret) &&
        !(!e.username && entries.some((o) => o !== e && o.username && o.secret === e.secret)),
    );
    const withSecret = entries.filter((e) => e.secret);
    const secretsSet = new Set(entries.map((e) => e.secret).filter(Boolean));
    // Trava: usuário igual a uma senha do item é leitura errada (o usuário aparece sem máscara).
    const leak = entries.some((e) => e.username && secretsSet.has(e.username) && !/^(root|admin|user|suporte|ubnt)$/i.test(e.username));
    const bad = leak || entries.some((e) => !inNote(e.username) || !inNote(e.secret)) || entries.length > 30;
    let valid = true;
    try {
      entries.forEach((e) => VaultAccessSchema.parse(e));
    } catch {
      valid = false;
    }
    const tag = `${r.id.slice(0, 8)} [${r.equipmentType}] ${r.equipmentName.slice(0, 48)}`;
    const labeledSecret = /^\s*(senhas?|password|pass(?:wd)?|pwd)\b\s*[:=;]?\s*\S/im.test(note);
    if (!withSecret.length && !labeledSecret && r.equipmentType === 'A CONFERIR' && !issues.length) {
      const byTitle = categoryFor(r.equipmentName);
      const type = byTitle !== 'OUTROS' ? byTitle : /^https?:/i.test(r.host) ? 'SISTEMA' : 'OUTROS';
      inc('sem senha na anotação · só reclassificado');
      report.push(`○ ${tag} → ${type} (a anotação não tem senha)`);
      const meta = r.sourceMetadata && typeof r.sourceMetadata === 'object' ? r.sourceMetadata : {};
      updates.push({ id: r.id, tenantId: r.tenantId, updatedAt: r.updatedAt, count: 0, data: { equipmentType: type, sourceMetadata: { ...meta, curationVersion: VERSION, ambiguous: false, reviewRequired: false } } });
      continue;
    }
    if (!withSecret.length || issues.length || bad || !valid) {
      const why = !withSecret.length ? 'nenhuma senha rotulada' : issues[0] || (leak ? 'usuário igual a uma senha' : bad ? 'valor fora da nota' : 'formato inválido');
      inc('não resolvido · ' + why);
      report.push(`✗ ${tag} — ${why}`);
      continue;
    }
    const first = withSecret[0];
    const byTitle = categoryFor(r.equipmentName);
    const methods = withSecret.map((e) => e.method);
    const most = (m) => methods.filter((x) => x === m).length;
    const known = ['WEB', 'SSH', 'RDP', 'WINBOX', 'TELNET'].some((m) => most(m));
    const byUse = !known ? 'OUTROS' : most('WINBOX') ? 'ROUTER' : most('WEB') >= most('SSH') + most('RDP') ? 'SISTEMA' : 'SERVIDOR';
    const byBody = categoryFor(note);
    const type =
      r.equipmentType !== 'A CONFERIR'
        ? r.equipmentType
        : byTitle !== 'OUTROS'
          ? byTitle
          : ['DNS', 'OLT', 'SW', 'ROUTER', 'FIREWALL'].includes(byBody)
            ? byBody
            : byUse;
    const keepEntries = entries.length > 1 || first.port !== null;
    inc('resolvido');
    inc(`resolvido · ${entries.length} acesso(s)`);
    report.push(
      `✓ ${tag} → ${type} | ` +
        entries.map((e) => `[${mask(e.label).slice(0, 28)}] ${e.method}${e.port ? ':' + e.port : ''} ${e.host ? mask(e.host).slice(0, 22) : '—'} u=${mask(e.username).slice(0, 14) || '—'} s=${e.secret ? mask(e.secret).length + 'c' : '—'}`).join(' ; ').slice(0, 400),
    );
    const meta = r.sourceMetadata && typeof r.sourceMetadata === 'object' ? r.sourceMetadata : {};
    updates.push({
      id: r.id,
      tenantId: r.tenantId,
      updatedAt: r.updatedAt,
      data: {
        equipmentType: type,
        accessMethod: first.method === 'BANCO' ? 'OUTROS' : ['WEB', 'SSH', 'WINBOX', 'TELNET', 'RDP'].includes(first.method) ? first.method : r.accessMethod === 'SEM_ACESSO' ? 'OUTROS' : r.accessMethod,
        host: r.host || first.host || '',
        username: first.username,
        secretEnc: encryptVaultSecret(first.secret),
        ...(keepEntries ? { protectedContentEnc: encryptVaultSecret(packVaultContent(content.text, entries)) } : {}),
        sourceMetadata: { ...meta, curationVersion: VERSION, ambiguous: false, reviewRequired: false, missingFields: [...(!(r.host || first.host) ? ['endereço'] : [])] },
      },
      count: entries.length,
    });
  }
  console.log(APPLY ? '=== GRAVANDO' : '=== SIMULAÇÃO (nada foi gravado)');
  for (const k of Object.keys(c).sort()) console.log(String(c[k]).padStart(5), k);
  console.log('\n' + report.join('\n'));
  if (APPLY) {
    let done = 0;
    await prisma.$transaction(
      async (tx) => {
        for (const u of updates) {
          const res = await tx.knowledgeCredential.updateMany({ where: { id: u.id, updatedAt: u.updatedAt }, data: u.data });
          if (res.count !== 1) continue;
          done++;
          await tx.auditLog.create({ data: { tenantId: u.tenantId, actorUserId: null, action: 'OS_UPDATE', resourceType: 'knowledge_credential', resourceId: u.id, metadata: { op: 'update', operation: 'auto_curation', version: VERSION, changeLabel: 'Acessos organizados a partir da anotação do SGP', accessCount: u.count } } });
        }
      },
      { timeout: 120000 },
    );
    console.log(`\ngravados: ${done}`);
  }
  await prisma.$disconnect();
})().catch((e) => {
  console.error('Interrompido:', e.message);
  process.exit(1);
});
