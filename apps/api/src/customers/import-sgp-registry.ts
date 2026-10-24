import { Prisma, PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';

export const SGP_CUSTOMERS = [
  { id: 60, taxId: '22672493000149', tradeName: 'MEGANET' },
  { id: 108, taxId: '44931803000135', tradeName: 'HOMENET' },
  { id: 53, taxId: '11775818000100', tradeName: 'ECOTELECOM' },
  { id: 89, taxId: '10779392000192', tradeName: 'INFOTEL' },
  { id: 25, taxId: '31391557000124', tradeName: 'ULTRANET' },
  { id: 9, taxId: '32878279000105', tradeName: 'G5 JABOATÃO' },
] as const;
const domain = 'ajustconsulting.sgp.net.br';
const strings = (v: unknown): string[] =>
  Array.isArray(v)
    ? [
        ...new Set(
          v
            .filter((x): x is string => typeof x === 'string')
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      ]
    : [];
const text = (v: unknown) =>
  typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';

export function sanitizeCustomer(
  raw: Record<string, unknown>,
  expected: (typeof SGP_CUSTOMERS)[number],
) {
  if (Number(raw.id) !== expected.id || text(raw.cpfcnpj).replace(/\D/g, '') !== expected.taxId)
    throw new Error(`Cliente ${expected.id}: ID/CNPJ divergente; nenhuma escrita autorizada.`);
  if (!text(raw.nome)) throw new Error(`Cliente ${expected.id} sem razão social.`);
  const address =
    raw.endereco && typeof raw.endereco === 'object'
      ? (raw.endereco as Record<string, unknown>)
      : {};
  const contacts =
    raw.contatos && typeof raw.contatos === 'object'
      ? (raw.contatos as Record<string, unknown>)
      : {};
  return {
    legalName: text(raw.nome),
    tradeName: expected.tradeName,
    taxId: expected.taxId,
    personType: text(raw.tipo),
    address: Object.fromEntries(
      ['logradouro', 'numero', 'bairro', 'cidade', 'uf', 'cep', 'complemento'].map((k) => [
        k,
        text(address[k]),
      ]),
    ),
    contacts: {
      emails: strings(contacts.emails),
      telefones: strings(contacts.telefones),
      celulares: strings(contacts.celulares),
    },
    sourceSystem: 'SGP' as const,
    externalId: `${domain}:cliente:${expected.id}`,
    sourceMetadata: {
      domain,
      sourceCustomerId: expected.id,
      registeredAtRaw: text(raw.dataCadastro),
      scope: 'CADASTRO_ONLY',
      contractStatusImported: false,
      tradeNameBasis: 'Identificação informada pela Ajust; razão social original preservada.',
    },
  };
}

export function sanitizeTechnicians(raw: unknown) {
  if (!Array.isArray(raw) || !raw.length) throw new Error('SGP não retornou a lista de técnicos.');
  const ids = new Set<number>();
  return raw.map((r: Record<string, unknown>) => {
    const id = Number(r.id),
      username = text(r.username),
      name = text(r.nome);
    if (!Number.isSafeInteger(id) || id <= 0 || !username || ids.has(id))
      throw new Error('Técnico com ID/login ausente, inválido ou duplicado.');
    ids.add(id);
    const operational = ['chamados_em_espera', 'sistema_os'].includes(username.toLowerCase());
    if (!operational && !name)
      throw new Error(`Técnico ${id} sem nome; revisar antes da migração.`);
    return { id, username, name, operational, externalId: `${domain}:tecnico:${id}` };
  });
}

export async function importSgpRegistry(
  prisma: PrismaClient,
  apply = false,
  fetcher: typeof fetch = fetch,
) {
  const token = process.env.SGP_TOKEN;
  if (!token) throw new Error('Defina SGP_TOKEN no ambiente (não gravado pelo importador).');
  const tenant = await prisma.tenant.findUnique({
    where: { slug: process.env.REGISTRY_TENANT_SLUG || 'ajust-demo' },
  });
  if (!tenant || tenant.status !== 'ACTIVE' || tenant.deletedAt)
    throw new Error('Workspace Ajust não disponível.');
  const role = await prisma.role.findUnique({ where: { code: 'analista' } });
  if (!role) throw new Error('Função técnica básica não cadastrada.');
  async function read(path: string, filters: Record<string, string>) {
    const response = await fetcher(`https://${domain}${path}`, {
      method: 'POST',
      body: new URLSearchParams({ token: token!, app: 'Sistema_de_O.S', ...filters }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`Leitura cadastral SGP recusada: HTTP ${response.status}.`);
    return response.json();
  }
  // Only cadastral endpoints. Ask the source to omit contracts and financial titles.
  const technicians = sanitizeTechnicians(await read('/api/ura/tecnicos/', {}));
  const customers = await Promise.all(
    SGP_CUSTOMERS.map(async (spec) => {
      const response = await read('/api/ura/clientes/', {
        cliente_id: String(spec.id),
        limit: '1',
        offset: '0',
        omitir_contratos: '1',
        omitir_titulos: '1',
      });
      if (!Array.isArray(response.clientes) || response.clientes.length !== 1)
        throw new Error(`Cliente ${spec.id} não retornado de forma única.`);
      return sanitizeCustomer(response.clientes[0], spec);
    }),
  );
  const people = technicians.filter((t) => !t.operational);
  const excluded = technicians
    .filter((t) => t.operational)
    .map((t) => ({ id: t.id, username: t.username, reason: 'Conta operacional, não é pessoa' }));
  const plan = {
    workspace: tenant.slug,
    customers: customers.map((c) => ({
      name: c.tradeName,
      sourceId: c.sourceMetadata.sourceCustomerId,
    })),
    people: people.length,
    excluded,
    access: 'BLOCKED',
    provisionalRole: 'analista',
    roleVerified: false,
    newOrders: 0,
    newOccurrences: 0,
  };
  if (!apply) return { status: 'DRY_RUN', plan };
  // Precompute random, unrecoverable password hashes outside the transaction. No emails or invitations.
  const passwords = await Promise.all(people.map(() => hash(randomBytes(48).toString('hex'), 12)));
  return prisma.$transaction(
    async (tx) => {
      const createdCustomers: string[] = [],
        existingCustomers: string[] = [],
        createdPeople: string[] = [],
        existingPeople: string[] = [];
      const before = {
        orders: await tx.serviceOrder.count(),
        occurrences: await tx.occurrence.count(),
        tenants: await tx.tenant.count(),
      };
      for (const data of customers) {
        const existing = await tx.customer.findFirst({
          where: {
            tenantId: tenant.id,
            OR: [{ externalId: data.externalId, sourceSystem: 'SGP' }, { taxId: data.taxId }],
          },
        });
        if (existing) {
          if (
            existing.deletedAt ||
            existing.taxId !== data.taxId ||
            existing.externalId !== data.externalId ||
            existing.sourceSystem !== 'SGP'
          )
            throw new Error(
              `Conflito cadastral ${data.tradeName}: revisão manual necessária, sem sobrescrever.`,
            );
          existingCustomers.push(data.tradeName);
          continue;
        }
        const customer = await tx.customer.create({ data: { ...data, tenantId: tenant.id } });
        createdCustomers.push(data.tradeName);
        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: 'SYNC',
            resourceType: 'customer',
            resourceId: customer.id,
            metadata: { sourceSystem: 'SGP', externalId: data.externalId, scope: 'CADASTRO_ONLY' },
          },
        });
      }
      for (const [i, person] of people.entries()) {
        const existing = await tx.user.findUnique({
          where: {
            sourceSystem_externalId: { sourceSystem: 'SGP', externalId: person.externalId },
          },
        });
        if (existing) {
          const member = await tx.userTenant.findUnique({
            where: { userId_tenantId: { userId: existing.id, tenantId: tenant.id } },
          });
          if (existing.deletedAt || !member)
            throw new Error(`Técnico ${person.id}: vínculo anterior conflitante, revisar.`);
          existingPeople.push(person.name);
          continue;
        }
        // Do not fuzzy-match names or invent real emails. This reserved-domain identifier is not a contact.
        const email = `sgp.${person.id}@cadastro.ajust.invalid`;
        if (await tx.user.findUnique({ where: { email } }))
          throw new Error(`Identificador reservado em conflito para ${person.id}.`);
        const sameName = await tx.user.findMany({
          where: { name: { equals: person.name, mode: 'insensitive' }, deletedAt: null },
          select: { id: true },
        });
        if (sameName.length)
          throw new Error(
            `Possível cadastro existente para ${person.name}; revisar identidade antes de duplicar.`,
          );
        const user = await tx.user.create({
          data: {
            name: person.name,
            email,
            passwordHash: passwords[i],
            status: 'BLOCKED',
            sourceSystem: 'SGP',
            externalId: person.externalId,
            sourceMetadata: {
              domain,
              sourceTechnicianId: person.id,
              sourceUsername: person.username,
              emailMissing: true,
              roleVerified: false,
              sourceActiveStatus: 'UNKNOWN',
              accessPendingReview: true,
              placeholderEmail: true,
              importedAs:
                'Pessoa retornada pelo endpoint de técnicos; analista/técnico não distinguido pela API.',
            },
            tenants: { create: { tenantId: tenant.id, roleId: role.id } },
          },
        });
        createdPeople.push(person.name);
        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: 'CREATE_USER',
            resourceType: 'user',
            resourceId: user.id,
            metadata: {
              sourceSystem: 'SGP',
              externalId: person.externalId,
              access: 'BLOCKED',
              provisionalRole: 'analista',
            },
          },
        });
      }
      const after = {
        orders: await tx.serviceOrder.count(),
        occurrences: await tx.occurrence.count(),
        tenants: await tx.tenant.count(),
      };
      if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error(
          'Invariante de escopo violada: O.S., ocorrências e tenants devem permanecer intactos.',
        );
      if (createdPeople.length || createdCustomers.length)
        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: 'SYNC',
            resourceType: 'sgp_registry_import',
            metadata: {
              createdPeople: createdPeople.length,
              createdCustomers: createdCustomers.length,
              excluded,
              before,
              after,
              scope: 'CADASTRO_ONLY',
            },
          },
        });
      return {
        status: createdPeople.length || createdCustomers.length ? 'IMPORTED' : 'ALREADY_IMPORTED',
        plan,
        createdCustomers,
        existingCustomers,
        createdPeople,
        existingPeople,
        before,
        after,
      };
    },
    { timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
