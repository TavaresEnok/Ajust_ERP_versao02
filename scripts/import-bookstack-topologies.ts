require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: false });
/**
 * Imports the reviewed, authenticated BookStack export into the Ajust workspace.
 * Reads private source files; never fetches or modifies the upstream systems.
 * Default: read-only plan. --apply requires a local PostgreSQL custom backup.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { decryptSecret, encryptSecret } from '../apps/api/src/common/secrets.crypto';
import { validateDrawioXml } from '../apps/api/src/network-topologies/drawio-xml';

// Reviewed against the real customer directory, source notes and book names.
// Different G5 units have different registrations and must remain separate.
const mappings: [book: string, customerId: number | null, name: string][] = [
  ['planaltonet', 59, 'PLANALTO NET'],
  ['glsolucoes', 10, 'GL SOLUÇÕES'],
  ['conect', 1, 'CONECT'],
  ['janet', 29, 'JANET'],
  ['alphanet', 33, 'ALPHANET'],
  ['rionet', 19, 'RIONET'],
  ['fortnet', 6, 'FORTE NET'],
  ['jdi-telecom', 44, 'JDI TELECOM'],
  ['bvnet', 137, 'BVNET'],
  ['insnet', 40, 'INSNET'],
  ['sofianet', 21, 'SOFIANET'],
  ['cavalcantinet', 3, 'CAVALCANTINET'],
  ['maximanet', 14, 'MAXIMANET'],
  ['mgn-fibra', 16, 'MGN FIBRA'],
  ['qualynet', 18, 'QUALYNET'],
  ['sin-fibra', 20, 'SIN FIBRA'],
  ['wellfibra', 27, 'WELL FIBRA'],
  ['vescnet', 11, 'VESCNET'],
  ['cellnet', 4, 'CELLNEET'],
  ['ultralink', null, 'ULTRALINK'],
  ['rcr-telecom', 45, 'RCR TELECOM'],
  ['supernet', 48, 'SUPERNET'],
  ['mcnet', 15, 'MCNET'],
  ['naveganet', 13, 'NAVEGANET'],
  ['grupo-flashnet-ib-telecom', 28, 'GRUPO FLASHNET / IB TELECOM'],
  ['km-telecom', 61, 'KM TELECOM'],
  ['masnet', 68, 'MAS.NET'],
  ['ondanet', 135, 'ONDANET'],
  ['vibe', 26, 'VIBE'],
  ['meganet', 60, 'MEGANET'],
  ['diagrama-infotel', 89, 'INFOTEL'],
  ['ponto-net', 93, 'PONTONET'],
  ['aftelecom', 90, 'AF TELECOM'],
  ['cybernet', 115, 'CYBERNET'],
  ['sntelecom', 121, 'SN TELECOM'],
  ['real-net', 128, 'REAL NET'],
  ['alphaville-desativado', 85, 'ALPHAVILLE (DESATIVADO)'],
  ['infortec', 133, 'INFORTEC'],
  ['world-fibra', 112, 'WORLD FIBRA'],
  ['murilo-net', 131, 'MURILO NET'],
  ['foxnet', 99, 'FOXNET'],
  ['ultrafibra', 96, 'ULTRAFIBRA'],
  ['up-connect', 114, 'UP CONNECT FIBRA'],
  ['gmax-itamaraca-desativado', 104, 'GMAX ITAMARACÁ (DESATIVADO)'],
  ['linsnet', 126, 'LINSNET'],
  ['voolpnet', 123, 'VOOLPNET'],
  ['neconet-desativado', 111, 'NECONET (DESATIVADO)'],
  ['gmax-sao-lourenco', 136, 'GMAX SÃO LOURENÇO'],
  ['dunet', 113, 'DUNET'],
  ['iconlink', 79, 'ICONLINK'],
  ['powerflash', 80, 'POWERFLASH'],
  ['setup-net', 138, 'NETSETUP'],
  ['str-net-jtk', 42, 'STR NET'],
  ['zoom-fibra-rPq', 71, 'ZOOM FIBRA'],
  ['mundonet', 130, 'MUNDONET'],
  ['eco-telecom-BmI', 53, 'ECOTELECOM'],
  ['lelo-net-desativado', 97, 'LELO NET (DESATIVADO)'],
  ['dinhonet', 139, 'DINHONET'],
  ['tcfibra', 39, 'TC+ FIBRA'],
  ['cnb-telecom', 116, 'CNB TELECOM'],
  ['fibermais', 94, 'FIBERMAIS'],
  ['g5-cabo', 51, 'G5 CABO'],
  ['g5-piedade', 72, 'G5 PIEDADE'],
  ['diagrama-g5-prazeres', 74, 'G5 PRAZERES'],
  ['g5-barra-de-jangada', 73, 'G5 BARRA DE JANGADA'],
  ['ponte-digital-RK2', 132, 'PONTE DIGITAL'],
  ['martins-telecom-desativado', 100, 'MARTINS TELECOM (DESATIVADO)'],
  ['voo-telecom', 118, 'VOO TELECOM'],
  ['ultranet-w7M', 25, 'ULTRANET'],
  ['grupo-telecom', 124, 'GRUPO TELECOM'],
  ['mond-telecom-T7B', 67, 'MOND TELECOM'],
  ['inet', 142, 'INET'],
  ['pgi-telecom', 75, 'PGI TELECOM'],
  ['mood-telecom', 77, 'MOOD'],
  ['pixfibra', 109, 'PIXFIBRA'],
  ['i4-telecom', 12, 'I4 TELECOM'],
  ['homenet', 108, 'HOMENET'],
  ['g5-will', 50, 'G5 WILL'],
  ['multnet', 117, 'MULTNET'],
  ['newconnect', 119, 'NEW CONNECT'],
  ['ativa-tec', 143, 'ATIVATEC'],
  ['supernet-camaragibe', 150, 'SUPERNET CAMARAGIBE'],
];

type SourceDiagram = {
  book: string;
  bookUrl: string;
  pageTitle: string;
  pageUrl: string;
  file: string;
  digest: string;
  cells: number;
  hasUpdatedTitle: boolean;
};
type SourceCustomer = {
  id: number;
  nome: string;
  cpfcnpj: string;
  tipo: string;
  endereco?: Record<string, unknown>;
  contatos?: Record<string, unknown>;
};
const prisma = new PrismaClient();
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const strings = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string'))] : [];

function sourceFile(root: string, file: string) {
  const result = resolve(root, file);
  const rel = relative(root, result);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Arquivo fora da exportação.');
  return result;
}

function combineDiagrams(parts: { xml: string; source: SourceDiagram }[], book: string) {
  if (parts.length === 1) return parts[0].xml;
  // Validated direct <diagram> children preserve compressed payloads and models.
  const pages = parts.flatMap(({ xml, source }, i) =>
    [...xml.matchAll(/<diagram\b[^>]*>[\s\S]*?<\/diagram>/g)].map((m, j) =>
      m[0].replace(
        /^<diagram\b[^>]*>/,
        `<diagram id="${book}-${source.digest.slice(0, 12)}-${j}" name="Diagrama atualizado ${i + 1}${j ? ` — página ${j + 1}` : ''}">`,
      ),
    ),
  );
  if (!pages.length) throw new Error(`Nenhuma página combinável: ${book}`);
  return `<mxfile>${pages.join('')}</mxfile>`;
}

async function main() {
  const rootArg = process.argv.find((a) => a.startsWith('--source='))?.slice(9);
  if (!rootArg) throw new Error('Informe --source=<pasta privada da coleta>.');
  const root = resolve(rootArg);
  const apply = process.argv.includes('--apply');
  if (apply) {
    const backup = process.argv.find((a) => a.startsWith('--backup='))?.slice(9);
    if (!backup || readFileSync(backup).subarray(0, 5).toString() !== 'PGDMP')
      throw new Error('Informe --backup=<backup PostgreSQL verificado>.');
  }
  const manifest = JSON.parse(readFileSync(resolve(root, 'atualizados/manifest.json'), 'utf8')) as {
    records: SourceDiagram[];
  };
  const directory = JSON.parse(
    readFileSync(resolve(root, 'diretorio-clientes.json'), 'utf8'),
  ) as SourceCustomer[];
  const sourceBooks = new Set(
    manifest.records.filter((r) => r.hasUpdatedTitle && r.cells > 0).map((r) => r.book),
  );
  if (sourceBooks.size !== mappings.length || mappings.some(([book]) => !sourceBooks.has(book)))
    throw new Error('A coleta diverge do mapeamento revisado.');
  if (new Set(mappings.map(([book]) => book)).size !== mappings.length)
    throw new Error('Livro duplicado no mapeamento.');
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  const actor = await prisma.userTenant.findFirstOrThrow({
    where: {
      tenantId: tenant.id,
      role: { code: 'super_admin' },
      user: { status: 'ACTIVE', deletedAt: null },
    },
    include: { user: { select: { id: true, name: true } } },
  });
  const plans = [];
  for (const [book, sourceId, name] of mappings) {
    const raw = sourceId === null ? null : directory.find((r) => r.id === sourceId);
    if (sourceId !== null && !raw) throw new Error(`Cadastro real ausente: ${book}`);
    const taxId = raw ? raw.cpfcnpj.replace(/\D/g, '') : null;
    if (taxId && ![11, 14].includes(taxId.length)) throw new Error(`Documento inválido: ${book}`);
    const parts = manifest.records
      .filter((r) => r.book === book && r.hasUpdatedTitle && r.cells > 0)
      .filter((r, i, all) => all.findIndex((other) => other.digest === r.digest) === i)
      .map((source) => {
        const xml = readFileSync(sourceFile(resolve(root, 'atualizados'), source.file), 'utf8');
        if (hash(xml) !== source.digest) throw new Error(`Checksum divergente: ${book}`);
        validateDrawioXml(xml);
        return { xml, source };
      });
    const xml = combineDiagrams(parts, book);
    validateDrawioXml(xml);
    const externalId = `bookstack:book:${book}`;
    const found = await prisma.customer.findMany({
      where: {
        tenantId: tenant.id,
        OR: [{ externalId }, ...(taxId ? [{ taxId }] : [])],
      },
    });
    if (found.length > 1 || found[0]?.deletedAt) throw new Error(`Conflito cadastral: ${book}`);
    plans.push({ book, name, raw, taxId, parts, xml, externalId, customer: found[0] });
  }
  const plan = plans.map((p) => ({
    book: p.book,
    provider: p.name,
    createCustomer: !p.customer,
    documentKnown: !!p.taxId,
    diagrams: p.parts.length,
  }));
  if (!apply)
    return console.log(
      JSON.stringify(
        {
          apply,
          providers: plan.length,
          newCustomers: plan.filter((p) => p.createCustomer).length,
          plan,
        },
        null,
        2,
      ),
    );
  const result = await prisma.$transaction(
    async (tx) => {
      const rows = [];
      for (const p of plans) {
        const customer =
          p.customer ||
          (await tx.customer.create({
            data: {
              tenantId: tenant.id,
              tradeName: p.name,
              legalName: p.raw?.nome || '',
              taxId: p.taxId,
              personType: p.raw?.tipo || 'NAO_INFORMADO',
              address: json(p.raw?.endereco || {}),
              contacts: json({
                emails: strings(p.raw?.contatos?.emails),
                telefones: strings(p.raw?.contatos?.telefones),
                celulares: strings(p.raw?.contatos?.celulares),
              }),
              sourceSystem: 'ERP',
              externalId: p.externalId,
              sourceMetadata: json({
                bookstackBookUrl: p.parts[0].source.bookUrl,
                bookstackBook: p.book,
                sourceCustomerId: p.raw?.id ?? null,
                cadastralDataComplete: !!p.raw,
                inactiveInSource: p.book.includes('desativado'),
                scope: 'CADASTRO_E_TOPOLOGIA',
              }),
            },
          }));
        if (p.book === 'g5-barra-de-jangada') {
          const misplaced = await tx.networkTopology.findMany({
            where: {
              tenantId: tenant.id,
              customerId: { not: customer.id },
              title: { contains: 'Barra de Jangada', mode: 'insensitive' },
              sourceFileName: 'G5 - BARRA DE JANGADA.drawio.xml',
            },
          });
          if (misplaced.length > 1) throw new Error('Mais de um vínculo G5 incorreto.');
          if (misplaced[0]) {
            const old = misplaced[0];
            if (await tx.networkTopology.findUnique({ where: { customerId: customer.id } }))
              throw new Error('G5 Barra já possui outra topologia.');
            await tx.networkTopology.update({
              where: { id: old.id },
              data: { customerId: customer.id },
            });
            await tx.auditLog.create({
              data: {
                tenantId: tenant.id,
                actorUserId: actor.user.id,
                action: 'SYNC',
                resourceType: 'network_topology',
                resourceId: old.id,
                metadata: json({
                  operation: 'correct_provider_association',
                  previousCustomerId: old.customerId,
                  customerId: customer.id,
                  book: p.book,
                }),
              },
            });
          }
        }
        const current = await tx.networkTopology.findUnique({ where: { customerId: customer.id } });
        let status = 'preservado';
        let version = current?.version || 0;
        if (!current || hash(decryptSecret(current.xmlEnc)) !== hash(p.xml)) {
          version++;
          const title =
            p.parts.length === 1 ? p.parts[0].source.pageTitle : `Topologia de rede — ${p.name}`;
          const data = {
            title,
            xmlEnc: encryptSecret(p.xml),
            version,
            updatedByUserId: actor.user.id,
            updatedByName: actor.user.name,
            sourceFileName: `${p.book}.drawio.xml`,
          };
          const saved = current
            ? await tx.networkTopology.update({
                where: { id: current.id, version: current.version },
                data,
              })
            : await tx.networkTopology.create({
                data: { ...data, tenantId: tenant.id, customerId: customer.id },
              });
          await tx.networkTopologyRevision.create({
            data: {
              topologyId: saved.id,
              version,
              title,
              xmlEnc: data.xmlEnc,
              sourceFileName: data.sourceFileName,
              savedByUserId: actor.user.id,
              savedByName: actor.user.name,
            },
          });
          status = current ? 'atualizado' : 'importado';
          await tx.auditLog.create({
            data: {
              tenantId: tenant.id,
              actorUserId: actor.user.id,
              action: 'SYNC',
              resourceType: 'network_topology',
              resourceId: saved.id,
              metadata: json({
                source: 'BOOKSTACK',
                book: p.book,
                sourcePages: p.parts.map((r) => r.source.pageUrl),
                version,
                customerId: customer.id,
                customerCreated: !p.customer,
              }),
            },
          });
        }
        const stored = await tx.networkTopology.findUniqueOrThrow({
          where: { customerId: customer.id },
        });
        if (hash(decryptSecret(stored.xmlEnc)) !== hash(p.xml))
          throw new Error(`Verificação da gravação falhou: ${p.book}`);
        rows.push({
          book: p.book,
          provider: customer.tradeName,
          customerId: customer.id,
          createdCustomer: !p.customer,
          documentKnown: !!p.taxId,
          status,
          version,
          digest: hash(p.xml),
          diagrams: p.parts.length,
        });
      }
      return rows;
    },
    { timeout: 120000 },
  );
  const report = {
    appliedAt: new Date().toISOString(),
    total: result.length,
    createdCustomers: result.filter((r) => r.createdCustomer).length,
    results: result,
  };
  writeFileSync(resolve(root, 'importacao-completa-erp.json'), JSON.stringify(report, null, 2), {
    mode: 0o600,
  });
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
