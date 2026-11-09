require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: false });
/**
 * Preenche o cofre de cada provedor com as anotações de acesso do SGP.
 *
 * Uso (dentro da rede do Docker, com a chave do cofre montada):
 *   SGP_TOKEN=... NODE_ENV=production ALLOW_DATA_SCRIPT=1 DATA_SCRIPT_BACKUP_VERIFIED=1 \
 *     tsx scripts/import-sgp-vault.ts --apply --confirm-database=ajust_erp [--simulate]
 *
 * --simulate conecta e calcula tudo, mas não grava. Provedores que já têm itens no cofre
 * (ex.: MEGANET, revisada à mão) ficam de fora. Reexecutar não duplica: a chave externa é
 * cliente+anotação+parte. O token do SGP vem do ambiente e não é gravado.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { encryptVaultSecret } from '../apps/api/src/common/vault.crypto';
import {
  buildSgpVaultEntries,
  numberRepeatedNames,
} from '../apps/api/src/customers/sgp-vault-import';

const db = new PrismaClient();
const write = !process.argv.includes('--simulate');
const domain = 'ajustconsulting.sgp.net.br';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');

async function sgp(path: string, params: Record<string, string>, method: 'GET' | 'POST') {
  const token = process.env.SGP_TOKEN;
  if (!token) throw new Error('Defina SGP_TOKEN no ambiente.');
  const query = new URLSearchParams({ token, app: 'Sistema_de_O.S', ...params });
  const response = await fetch(`https://${domain}${path}${method === 'GET' ? `?${query}` : ''}`, {
    method,
    ...(method === 'POST' ? { body: query } : {}),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw new Error(`SGP ${path}: HTTP ${response.status}`);
  const body = await response.json();
  if (body?.detail) throw new Error(`SGP ${path} recusou a consulta.`);
  return body;
}

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({ where: { status: 'ACTIVE', deletedAt: null } });
  const actor = await db.userTenant.findFirstOrThrow({
    where: { tenantId: tenant.id, role: { code: 'gerente' }, user: { status: 'ACTIVE' } },
  });

  const sgpClients = new Map<number, string>();
  for (let offset = 0; ; offset += 100) {
    const page = await sgp(
      '/api/ura/clientes/',
      { limit: '100', offset: String(offset), omitir_contratos: '1', omitir_titulos: '1' },
      'POST',
    );
    for (const c of page.clientes || [])
      sgpClients.set(Number(c.id), String(c.cpfcnpj || '').replace(/\D/g, ''));
    if ((page.clientes || []).length < 100) break;
  }
  const notes: Array<Record<string, unknown>> = await sgp(
    '/api/ura/cliente/anotacao/list',
    {},
    'GET',
  );
  if (!Array.isArray(notes)) throw new Error('Formato de anotações desconhecido.');

  const customers = await db.customer.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { taxId: true, tradeName: true },
  });
  const nameByTax = new Map(
    customers.map((c) => [(c.taxId || '').replace(/\D/g, ''), c.tradeName]),
  );
  const withVault = new Set(
    (
      await db.knowledgeCredential.groupBy({ by: ['provider'], where: { tenantId: tenant.id } })
    ).map((r) => r.provider.toLowerCase()),
  );

  const byProvider = new Map<string, Prisma.KnowledgeCredentialCreateManyInput[]>();
  const skipped = { semCadastro: 0, cofreJaPreenchido: new Set<string>() };
  for (const note of notes) {
    const customerId = Number(note.cliente);
    const provider = nameByTax.get(sgpClients.get(customerId) || '');
    if (!provider) {
      skipped.semCadastro++;
      continue;
    }
    if (withVault.has(provider.toLowerCase())) {
      skipped.cofreJaPreenchido.add(provider);
      continue;
    }
    const html = String(note.anotacao || '');
    const noteId = Number(note.id);
    const rows = byProvider.get(provider) ?? [];
    for (const e of buildSgpVaultEntries(html, { customerId, noteId })) {
      rows.push({
        tenantId: tenant.id,
        createdById: actor.userId,
        provider,
        equipmentType: e.equipmentType,
        equipmentName: e.equipmentName,
        accessMethod: e.accessMethod,
        environment: 'NAO_INFORMADO',
        host: e.host,
        username: e.username,
        secretEnc: encryptVaultSecret(e.secret),
        protectedContentEnc: encryptVaultSecret(e.orientation),
        sourceNoteEnc: encryptVaultSecret(html),
        sourceSystem: 'SGP',
        externalId: e.externalId,
        sourceMetadata: {
          sourceCustomerId: customerId,
          noteId,
          sourceHash: hash(html),
          missingFields: e.missing,
          ambiguous: e.ambiguous,
          reviewRequired: e.reviewRequired,
          importedAt: new Date().toISOString(),
        },
        notes:
          `Importado da anotação SGP #${noteId}.` +
          (e.reviewRequired
            ? ' Revisar: ' +
              (e.ambiguous
                ? 'há mais de um usuário/senha na anotação'
                : `não identificado: ${e.missing.join(', ')}`) +
              '. A anotação original está protegida neste item.'
            : ''),
      });
    }
    byProvider.set(provider, rows);
  }

  let created = 0;
  const summary: { provedor: string; itens: number; aConferir: number }[] = [];
  for (const [provider, raw] of byProvider) {
    const rows = numberRepeatedNames(raw);
    summary.push({
      provedor: provider,
      itens: rows.length,
      aConferir: rows.filter((r) => r.equipmentType === 'A CONFERIR').length,
    });
    if (!write) continue;
    created += await db.$transaction(async (tx) => {
      const result = await tx.knowledgeCredential.createMany({ data: rows, skipDuplicates: true });
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId: actor.userId,
          action: 'RESOURCE_CREATE',
          resourceType: 'knowledge_credential_import',
          metadata: { source: 'SGP', provider, items: result.count },
        },
      });
      return result.count;
    });
  }
  summary.sort((a, b) => b.itens - a.itens);
  console.log(
    JSON.stringify(
      {
        modo: write ? 'gravado' : 'simulação',
        anotacoes: notes.length,
        provedores: summary.length,
        itens: summary.reduce((s, r) => s + r.itens, 0),
        aConferir: summary.reduce((s, r) => s + r.aConferir, 0),
        gravados: created,
        ignorados: {
          anotacoesDeClienteSemCadastro: skipped.semCadastro,
          provedoresComCofreJaPreenchido: [...skipped.cofreJaPreenchido],
        },
        maiores: summary.slice(0, 12),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Falha na importação');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
