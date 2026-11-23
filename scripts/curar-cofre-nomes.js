/**
 * Nomes repetidos no mesmo provedor ("SGP", "SGP (2)", "SGP (3)") ganham o que realmente os
 * diferencia: o endereço ("SGP · vibetelecom.sgp.net.br", "OLT HUAWEI · 187.17.137.188").
 * Se o endereço também se repete, usa o usuário; se ainda repetir, mantém a numeração.
 *   docker exec -i ajust_erp-api-1 node - < scripts/curar-cofre-nomes.js            (simulação)
 *   docker exec -i -e APPLY=1 ajust_erp-api-1 node - < scripts/curar-cofre-nomes.js (grava)
 */
const { PrismaClient } = require('/app/apps/api/node_modules/@prisma/client');
const APPLY = process.env.APPLY === '1';
const prisma = new PrismaClient();
const hostLabel = (h) => {
  const v = String(h || '').trim();
  if (!v) return '';
  try {
    if (/^https?:\/\//i.test(v)) {
      const u = new URL(v);
      return (
        u.hostname.replace(/^www\./, '') +
        (u.port && !/[a-z]/i.test(u.hostname) ? ':' + u.port : '')
      );
    }
  } catch {}
  return v.replace(/\/.*$/, '');
};
(async () => {
  const rows = await prisma.knowledgeCredential.findMany({
    select: {
      id: true,
      tenantId: true,
      provider: true,
      equipmentName: true,
      host: true,
      username: true,
      updatedAt: true,
    },
  });
  const groups = new Map();
  for (const r of rows) {
    const base = r.equipmentName.replace(/\s*\(\d+\)$/, '').trim();
    const key = r.tenantId + '|' + r.provider + '|' + base.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...r, base });
  }
  const updates = [];
  let kept = 0;
  for (const list of groups.values()) {
    if (list.length < 2 || !list.some((r) => /\(\d+\)$/.test(r.equipmentName))) continue;
    const taken = new Set(
      rows.filter((r) => r.provider === list[0].provider).map((r) => r.equipmentName.toLowerCase()),
    );
    list.forEach((r) => taken.delete(r.equipmentName.toLowerCase()));
    const name = (r, extra) => `${r.base} · ${extra}`.slice(0, 120);
    const proposals = list.map((r) => {
      const h = hostLabel(r.host);
      const base = r.base.toLowerCase();
      return h && !base.includes(h.toLowerCase())
        ? name(r, h)
        : r.username
          ? name(r, r.username)
          : null;
    });
    const count = new Map();
    proposals.forEach(
      (p) => p && count.set(p.toLowerCase(), (count.get(p.toLowerCase()) || 0) + 1),
    );
    list.forEach((r, i) => {
      let p = proposals[i];
      if (p && count.get(p.toLowerCase()) > 1 && r.username && !p.endsWith(' · ' + r.username))
        p = `${p} · ${r.username}`.slice(0, 120);
      if (!p || taken.has(p.toLowerCase())) {
        kept++;
        return;
      }
      taken.add(p.toLowerCase());
      if (p !== r.equipmentName)
        updates.push({
          id: r.id,
          tenantId: r.tenantId,
          updatedAt: r.updatedAt,
          from: r.equipmentName,
          to: p,
          provider: r.provider,
        });
    });
  }
  console.log(
    APPLY ? '=== GRAVANDO' : '=== SIMULAÇÃO',
    '| renomear:',
    updates.length,
    '| mantidos com número (mesmo endereço e usuário):',
    kept,
  );
  updates
    .filter((u) => u.provider === 'VIBE')
    .forEach((u) => console.log('  VIBE:', u.from, '→', u.to));
  updates
    .filter((u) => u.provider !== 'VIBE')
    .slice(0, 8)
    .forEach((u) => console.log('  ex.:', u.provider, '|', u.from, '→', u.to));
  if (APPLY) {
    let done = 0;
    await prisma.$transaction(
      async (tx) => {
        for (const u of updates) {
          const r = await tx.knowledgeCredential.updateMany({
            where: { id: u.id, updatedAt: u.updatedAt },
            data: { equipmentName: u.to },
          });
          if (!r.count) continue;
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
                changeLabel: 'Nome com o endereço no lugar do número',
                from: u.from,
                to: u.to,
              },
            },
          });
        }
      },
      { timeout: 120000 },
    );
    console.log('gravados:', done);
  }
  await prisma.$disconnect();
})();
