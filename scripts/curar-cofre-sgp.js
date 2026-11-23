/**
 * Organiza os itens do cofre importados do SGP (revisão de 12/11/2026,
 * docs/analises/cofre-revisao-importacao.md). Roda DENTRO do contêiner da API:
 *
 *   docker exec -i ajust_erp-api-1 node - < scripts/curar-cofre-sgp.js            (simulação)
 *   docker exec -i -e APPLY=1 ajust_erp-api-1 node - < scripts/curar-cofre-sgp.js (grava)
 *
 * Regras (conservadoras; a anotação original nunca é alterada):
 *  - Só cria acessos estruturados quando a própria nota liga usuário e senha de forma
 *    explícita: "Login: a / b" + "Senha: x / y" com a mesma quantidade, ou linhas rotuladas
 *    em sequência estrita usuário, senha, usuário, senha.
 *  - Todo valor gravado em campo precisa existir, igual, na anotação original.
 *  - Nunca imprime segredo: a saída é só contagem e exemplos mascarados.
 */
const { PrismaClient } = require('/app/apps/api/node_modules/@prisma/client');
const {
  decryptVaultSecret,
  encryptVaultSecret,
  vaultSourceNoteText,
} = require('/app/apps/api/dist/common/vault.crypto.js');
const {
  unpackVaultContent,
  packVaultContent,
} = require('/app/apps/api/dist/common/vault-content.js');
const { categoryOf, categoryFor } = require('/app/apps/api/dist/customers/sgp-vault-import.js');
const { decodeHTML } = require('/app/node_modules/.pnpm/entities@6.0.1/node_modules/entities');

const APPLY = process.env.APPLY === '1';
const VERSION = 'auto-2026-11-12';
const prisma = new PrismaClient();
const mask = (s) =>
  String(s ?? '')
    .replace(/[A-Za-zÀ-ÿ]/g, 'a')
    .replace(/\d/g, '9');
const clean = (s) =>
  decodeHTML(
    String(s || '')
      .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ');
const hasEntity = (s) => /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i.test(s || '');

const U =
  /^(?:login|usu[aá]rio|usuario|user(?:name)?)(?:\s+(?:web|ssh|winbox|telnet))?\s*(?:[:=]\s*(.*))?$/i;
const S =
  /^(?:senha|password|pass(?:wd)?|pwd)(?:\s+(?:web|ssh|winbox|telnet))?\s*(?:[:=]\s*(.*))?$/i;
const P = /^portas?\s*(ssh|telnet|winbox|web|http|https|api)?\s*[:=]\s*(\d{1,5})$/i;
const A_LABEL =
  /^(?:ips?|host|url|link|endere[cç]o(?:\s+de\s+acesso)?|acesso(?:\s+(?:web|externo|interno|ssh|winbox))?|ip\s+(?:do\s+)?servidor|servidor)\s*[:=]\s*(.+)$/i;
const ADDR = /^(?:https?:\/\/[^\s"'<>()]+|(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?)$/i;
const METHODS = {
  ssh: 'SSH',
  telnet: 'TELNET',
  winbox: 'WINBOX',
  web: 'WEB',
  http: 'WEB',
  https: 'WEB',
  api: 'OUTROS',
};
const token = (v) => !!v && !/\s/.test(v) && v.length <= 200;

/** Linhas da nota classificadas. Rótulo sem valor pega a linha seguinte (formato de tabela). */
function classify(note) {
  const lines = note
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] || '';
    const nextIsLabel = U.test(next) || S.test(next) || P.test(next) || A_LABEL.test(next);
    let m;
    if ((m = line.match(P)))
      out.push({ k: 'P', method: METHODS[(m[1] || '').toLowerCase()] || null, port: Number(m[2]) });
    else if ((m = line.match(U))) {
      const v = (m[1] ?? '').trim() || (!nextIsLabel ? (i++, next) : '');
      out.push({ k: 'U', v });
    } else if ((m = line.match(S))) {
      const v = (m[1] ?? '').trim() || (!nextIsLabel ? (i++, next) : '');
      out.push({ k: 'S', v });
    } else if ((m = line.match(A_LABEL)) && ADDR.test(m[1].trim().split(/\s/)[0]))
      out.push({ k: 'A', v: m[1].trim().split(/\s/)[0] });
    else if (ADDR.test(line)) out.push({ k: 'A', v: line });
    else out.push({ k: 'T', v: line });
  }
  return out;
}

function splitEndpoint(host) {
  const ip = String(host || '').match(/^((?:\d{1,3}\.){3}\d{1,3})(?::(\d{1,5}))?$/);
  if (ip) return { host: ip[1], port: ip[2] ? Number(ip[2]) : null, web: false };
  try {
    const url = new URL(host);
    return { host, port: url.port ? Number(url.port) : null, web: true };
  } catch {
    return null;
  }
}

function methodFromNote(note) {
  const found = [
    /\btelnet\b/i.test(note) && 'TELNET',
    /\bwinbox\b|\b8291\b/i.test(note) && 'WINBOX',
    /\bssh\b/i.test(note) && 'SSH',
  ].filter(Boolean);
  return found.length === 1 ? found[0] : null;
}

/** Limpa endereço com texto colado depois ("http://1.2.3.4/%20(GRAFANA)"). */
function cleanHost(host) {
  let h = decodeHTML(String(host || '')).trim();
  const cut = h.search(/%20|%28|%7C|\s|\(|\|/i);
  if (cut > 0) h = h.slice(0, cut);
  return h;
}

function heading(items, from, to) {
  for (let i = to - 1; i >= from; i--) {
    const it = items[i];
    if (it.k === 'T' && it.v.length <= 70 && !/[:=]\s*\S/.test(it.v) && /[A-Za-zÀ-ÿ]{2}/.test(it.v))
      return it.v.replace(/^[#=\-*•·\s]+|[#=\-*•·:\s]+$/g, '').slice(0, 80);
  }
  return '';
}

(async () => {
  const rows = await prisma.knowledgeCredential.findMany({
    where: { sourceSystem: 'SGP' },
    orderBy: { id: 'asc' },
  });
  const c = {};
  const inc = (k, n = 1) => (c[k] = (c[k] || 0) + n);
  const ex = {};
  const addEx = (k, v, max = 4) => {
    ex[k] = ex[k] || [];
    if (ex[k].length < max) ex[k].push(v);
  };
  const updates = [];
  const before = {};
  const after = {};

  for (const r of rows) {
    const secret0 = decryptVaultSecret(r.secretEnc) || '';
    const raw = r.sourceNoteEnc ? vaultSourceNoteText(r.sourceNoteEnc) || '' : '';
    const note = clean(raw);
    const content = unpackVaultContent(
      r.protectedContentEnc ? decryptVaultSecret(r.protectedContentEnc) : null,
    );
    const meta =
      r.sourceMetadata && typeof r.sourceMetadata === 'object' ? { ...r.sourceMetadata } : {};
    const next = {
      equipmentName: r.equipmentName,
      equipmentType: r.equipmentType,
      accessMethod: r.accessMethod,
      host: r.host,
      username: r.username,
      secret: secret0,
      text: content.text,
      entries: content.accessEntries.slice(),
    };
    const ops = [];
    before[r.equipmentType] = (before[r.equipmentType] || 0) + 1;
    const inNote = (v) => !v || note.includes(v) || raw.includes(v);

    // 1. Limpeza: códigos HTML em nome, texto, usuário e senha; endereço com texto colado.
    if (hasEntity(next.equipmentName)) {
      next.equipmentName = decodeHTML(next.equipmentName).replace(/\s+/g, ' ').trim();
      ops.push('nome-html');
    }
    if (hasEntity(next.text) || /<[a-z][^>]*>/i.test(next.text)) {
      next.text = clean(next.text);
      ops.push('texto-html');
    }
    for (const f of ['username', 'secret'])
      if (hasEntity(next[f]) && inNote(decodeHTML(next[f]))) {
        next[f] = decodeHTML(next[f]);
        ops.push(f + '-html');
      }
    if (next.host && /%20|%28|%7C|\s|\(|\||&[a-z]+;/i.test(next.host)) {
      const h = cleanHost(next.host);
      if (h !== next.host && splitEndpoint(h)) {
        next.host = h;
        ops.push('endereco-limpo');
      } else inc('endereço com lixo não resolvido');
    }

    const items = classify(note);
    const users = items.filter((i) => i.k === 'U');
    const secrets = items.filter((i) => i.k === 'S');
    const addrs = items.filter((i) => i.k === 'A');
    const ports = items.filter((i) => i.k === 'P');
    const endpoint = splitEndpoint(next.host);
    const rootMethod = () =>
      endpoint?.web
        ? 'WEB'
        : next.accessMethod !== 'OUTROS' && next.accessMethod !== 'SEM_ACESSO'
          ? next.accessMethod
          : methodFromNote(note) || 'OUTROS';

    // 2. "Login: a / b" + "Senha: x / y" com a mesma quantidade: um acesso por par.
    if (!next.entries.length && /\s\/\s/.test(next.username)) {
      const us = next.username.split(/\s+\/\s+/).map((v) => v.trim());
      const ss = next.secret.split(/\s+\/\s+/).map((v) => v.trim());
      if (
        us.length >= 2 &&
        us.length === ss.length &&
        us.every(token) &&
        ss.every(token) &&
        endpoint &&
        us.every(inNote) &&
        ss.every(inNote)
      ) {
        const method = rootMethod();
        const port = endpoint.port ?? (ports.length === 1 ? ports[0].port : null);
        next.entries = us.map((u, i) => ({
          label: `Acesso ${i + 1} · ${u}`.slice(0, 120),
          method,
          host: endpoint.host,
          port,
          context: '',
          username: u,
          secret: ss[i],
          notes: '',
        }));
        next.username = us[0];
        next.secret = ss[0];
        if (!endpoint.web && method !== 'OUTROS') next.accessMethod = method;
        ops.push('pares-separados');
      } else {
        inc('usuário "a / b" não separado (pares não casam ou valor com espaço)');
      }
    }

    // 3. Linhas rotuladas em sequência estrita usuário, senha, usuário, senha.
    if (
      !next.entries.length &&
      !next.secret &&
      users.length >= 2 &&
      users.length === secrets.length
    ) {
      const seq = items
        .filter((i) => i.k === 'U' || i.k === 'S')
        .map((i) => i.k)
        .join('');
      const strict = /^(US)+$/.test(seq);
      const values = [...users, ...secrets].every((i) => token(i.v));
      if (strict && values && users.length <= 20) {
        const blocks = [];
        let lastAddr = null;
        let lastPort = null;
        let lastCut = 0;
        let current = null;
        let ok = true;
        items.forEach((it, idx) => {
          if (it.k === 'A') lastAddr = it.v;
          else if (it.k === 'P') lastPort = it;
          else if (it.k === 'U') {
            current = {
              username: it.v,
              addr: lastAddr,
              port: lastPort,
              label: heading(items, lastCut, idx),
            };
          } else if (it.k === 'S') {
            if (!current) ok = false;
            else {
              blocks.push({ ...current, secret: it.v });
              current = null;
              lastCut = idx + 1;
            }
          }
        });
        const distinct = [...new Set(addrs.map((a) => a.v))];
        // Um endereço só na nota: todos os acessos são dele. Vários: cada acesso precisa do seu antes.
        if (distinct.length === 1) blocks.forEach((b) => (b.addr = distinct[0]));
        else if (distinct.length === 0 && endpoint) blocks.forEach((b) => (b.addr = next.host));
        const entries = blocks.map((b, i) => {
          const ep = splitEndpoint(cleanHost(b.addr || ''));
          if (!ep) return null;
          const method = ep.web ? 'WEB' : b.port?.method || methodFromNote(note) || 'OUTROS';
          return {
            label: (b.label || `Acesso ${i + 1} · ${b.username}`).slice(0, 120),
            method,
            host: ep.host,
            port: ep.port ?? (ports.length === 1 ? ports[0].port : null),
            context: '',
            username: b.username,
            secret: b.secret,
            notes: '',
          };
        });
        if (
          ok &&
          entries.length >= 2 &&
          entries.every(Boolean) &&
          entries.every((e) => inNote(e.username) && inNote(e.secret))
        ) {
          next.entries = entries;
          next.username = entries[0].username;
          next.secret = entries[0].secret;
          if (!next.host) next.host = blocks[0].addr ? cleanHost(blocks[0].addr) : '';
          ops.push('multiacesso-estruturado');
        } else inc('multiacesso: sequência ok, mas endereço não resolvido');
      } else if (secrets.length >= 2) inc('multiacesso não estruturado (sequência não é estrita)');
    } else if (!next.entries.length && !next.secret && secrets.length >= 2)
      inc('multiacesso não estruturado (quantidades diferentes)');

    // 4. Um acesso só, com porta e método escritos na nota.
    const ep2 = splitEndpoint(next.host);
    if (
      !next.entries.length &&
      ep2 &&
      !ep2.web &&
      next.username &&
      next.secret &&
      token(next.username)
    ) {
      const labeled = ports.filter((p) => p.method);
      if (labeled.length >= 1 && new Set(labeled.map((p) => p.method)).size === labeled.length) {
        next.entries = labeled.map((p) => ({
          label: `Acesso ${p.method === 'WEB' ? 'web' : p.method.toLowerCase()}`,
          method: p.method,
          host: ep2.host,
          port: p.port,
          context: '',
          username: next.username,
          secret: next.secret,
          notes: '',
        }));
        if (next.accessMethod === 'OUTROS')
          next.accessMethod = labeled[0].method === 'OUTROS' ? 'OUTROS' : labeled[0].method;
        ops.push('porta-metodo');
      } else if (ports.length === 1 || ep2.port) {
        const method = rootMethod();
        const port = ep2.port ?? ports[0].port;
        next.entries = [
          {
            label: 'Acesso principal',
            method,
            host: ep2.host,
            port,
            context: '',
            username: next.username,
            secret: next.secret,
            notes: '',
          },
        ];
        if (next.accessMethod === 'OUTROS' && method !== 'OUTROS') next.accessMethod = method;
        ops.push('porta');
      } else if (next.accessMethod === 'OUTROS') {
        const method = methodFromNote(note);
        if (method) {
          next.accessMethod = method;
          ops.push('metodo');
        }
      }
    }

    // 5. Categoria de quem estava em "A conferir".
    if (next.equipmentType === 'A CONFERIR') {
      const labeledCreds = users.length + secrets.length;
      const byTitle = categoryFor(next.equipmentName);
      if (next.secret) {
        next.equipmentType = categoryOf(next.equipmentName, note);
        ops.push('categoria');
      } else if (!next.username && labeledCreds === 0) {
        if (!next.host)
          next.equipmentType = ['REDE', 'CIRCUITOS'].includes(byTitle) ? byTitle : 'DOCUMENTO';
        else if (byTitle !== 'OUTROS') next.equipmentType = byTitle;
        else next.equipmentType = 'REFERENCIA';
        ops.push('categoria');
      }
    }

    // 6. Nome genérico "Acesso · anotação SGP 1234".
    if (/· anotação SGP \d+/.test(next.equipmentName)) {
      const ep = splitEndpoint(next.host);
      let name = '';
      if (ep?.web) {
        try {
          name = new URL(next.host).host;
        } catch {
          /* mantém */
        }
      } else if (ep) name = `IP ${next.host}`;
      const kind = next.equipmentName.split(' · ')[0];
      if (name) {
        next.equipmentName = (kind && kind !== 'Acesso' ? `${kind} · ${name}` : name).slice(0, 90);
        ops.push('nome');
      }
    }

    after[next.equipmentType] = (after[next.equipmentType] || 0) + 1;
    if (!ops.length) continue;

    // Trava: nada do que vai para campo pode ser inventado.
    const fields = [
      next.username,
      next.secret,
      ...next.entries.flatMap((e) => [e.username, e.secret]),
    ];
    if (!fields.every(inNote)) {
      inc('RECUSADO: valor fora da anotação original');
      after[next.equipmentType]--;
      after[r.equipmentType] = (after[r.equipmentType] || 0) + 1;
      continue;
    }
    ops.forEach((o) => inc('op · ' + o));
    inc('itens alterados');
    if (ops.includes('pares-separados'))
      addEx(
        'pares separados',
        `${r.equipmentType} | ${mask(r.username).replace(/\s+/g, ' ')} → ${next.entries.map((e) => mask(e.username) + '@' + e.method + (e.port ? ':' + e.port : '')).join(' ; ')}`,
      );
    if (ops.includes('multiacesso-estruturado'))
      addEx(
        'multiacesso',
        `${r.equipmentType}→${next.equipmentType} | ${next.entries
          .map(
            (e) =>
              `[${mask(e.label).slice(0, 24)}] ${mask(e.host).slice(0, 30)} ${mask(e.username)}`,
          )
          .join(' ; ')
          .slice(0, 230)}`,
        6,
      );
    if (ops.includes('porta-metodo') || ops.includes('porta'))
      addEx(
        'porta/método',
        `${r.equipmentType} | ${r.accessMethod}→${next.accessMethod} | ${next.entries.map((e) => e.method + ':' + e.port).join(', ')}`,
      );
    if (ops.includes('categoria'))
      addEx(
        'categoria ' + next.equipmentType,
        mask(next.equipmentName).slice(0, 50) + ' | host=' + mask(next.host).slice(0, 40),
        3,
      );
    if (ops.includes('nome'))
      addEx('nome', `${mask(r.equipmentName)} → ${mask(next.equipmentName)}`);
    if (ops.includes('endereco-limpo'))
      addEx('endereço limpo', `${mask(r.host).slice(0, 70)} → ${mask(next.host)}`);

    const missing = [
      ...(!next.host ? ['endereço'] : []),
      ...(!next.username ? ['usuário'] : []),
      ...(!next.secret ? ['senha'] : []),
    ];
    const structured = next.entries.length > 0;
    updates.push({
      id: r.id,
      tenantId: r.tenantId,
      updatedAt: r.updatedAt,
      ops,
      data: {
        equipmentName: next.equipmentName,
        equipmentType: next.equipmentType,
        accessMethod: next.accessMethod,
        host: next.host,
        username: next.username,
        ...(next.secret !== secret0 ? { secretEnc: encryptVaultSecret(next.secret) } : {}),
        ...(structured || next.text !== content.text
          ? { protectedContentEnc: encryptVaultSecret(packVaultContent(next.text, next.entries)) }
          : {}),
        sourceMetadata: {
          ...meta,
          curationVersion: VERSION,
          curationOps: ops,
          missingFields: missing,
          ...(structured || next.equipmentType !== 'A CONFERIR'
            ? { ambiguous: false, reviewRequired: next.equipmentType === 'A CONFERIR' }
            : {}),
        },
      },
    });
  }

  // 7. Duplicados exatos: marca os repetidos apontando para o primeiro.
  const seen = new Map();
  let dups = 0;
  for (const r of rows) {
    if (!r.host && !r.username) continue;
    const key = [
      r.tenantId,
      r.provider,
      r.host.toLowerCase(),
      r.username.toLowerCase(),
      decryptVaultSecret(r.secretEnc) || '',
    ].join('\u0001');
    const first = seen.get(key);
    if (!first) seen.set(key, r.id);
    else {
      dups++;
      const u = updates.find((x) => x.id === r.id);
      const meta = r.sourceMetadata && typeof r.sourceMetadata === 'object' ? r.sourceMetadata : {};
      if (u) u.data.sourceMetadata.duplicateOf = first;
      else
        updates.push({
          id: r.id,
          tenantId: r.tenantId,
          updatedAt: r.updatedAt,
          ops: ['duplicado'],
          data: { sourceMetadata: { ...meta, duplicateOf: first } },
        });
    }
  }
  inc('duplicados marcados', dups);

  console.log(APPLY ? '=== GRAVANDO' : '=== SIMULAÇÃO (nada foi gravado)');
  for (const k of Object.keys(c).sort()) console.log(String(c[k]).padStart(6), k);
  console.log('\n=== CATEGORIAS antes → depois');
  for (const k of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort())
    console.log(
      `${String(before[k] || 0).padStart(6)} → ${String(after[k] || 0).padStart(5)}  ${k}`,
    );
  console.log('\n=== EXEMPLOS (a=letra, 9=dígito)');
  for (const k of Object.keys(ex)) {
    console.log('·', k);
    ex[k].forEach((e) => console.log('     ', e));
  }

  if (APPLY) {
    let done = 0;
    let skipped = 0;
    for (let i = 0; i < updates.length; i += 100) {
      await prisma.$transaction(
        async (tx) => {
          for (const u of updates.slice(i, i + 100)) {
            const result = await tx.knowledgeCredential.updateMany({
              where: { id: u.id, updatedAt: u.updatedAt },
              data: u.data,
            });
            if (result.count !== 1) {
              skipped++;
              continue;
            }
            done++;
            await tx.auditLog.create({
              data: {
                tenantId: u.tenantId,
                actorUserId: null,
                action: 'OS_UPDATE',
                resourceType: 'knowledge_credential',
                resourceId: u.id,
                metadata: {
                  op: 'update',
                  operation: 'auto_curation',
                  version: VERSION,
                  changeLabel: 'Organização automática da anotação do SGP',
                  steps: u.ops,
                },
              },
            });
          }
        },
        { timeout: 120000 },
      );
    }
    console.log(
      `\ngravados: ${done} | pulados (alterados por alguém durante a execução): ${skipped}`,
    );
  } else console.log(`\nitens que seriam gravados: ${updates.length}`);
  await prisma.$disconnect();
})().catch((error) => {
  console.error('Interrompido:', error.message);
  process.exit(1);
});
