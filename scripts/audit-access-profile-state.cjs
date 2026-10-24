// Read-only state fingerprint; snapshots stay outside the repository and contain no passwords.
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function main() {
  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, passwordHash: true, status: true, deletedAt: true },
  });
  const orders = await prisma.serviceOrder.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      occurrenceId: true,
      assigneeUserId: true,
      ownerUserId: true,
      status: true,
      version: true,
      deletedAt: true,
    },
  });
  const definitions = await prisma.serviceProcessTemplate.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, definition: true, draft: true, version: true },
  });
  const instances = await prisma.serviceProcessInstance.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, definition: true, state: true, version: true },
  });
  const state = {
    at: new Date().toISOString(),
    roles: await prisma.role.findMany({ orderBy: { code: 'asc' } }),
    memberships: await prisma.userTenant.findMany({ orderBy: { id: 'asc' } }),
    fingerprints: {
      users: digest(users),
      orders: digest(orders),
      definitions: digest(definitions),
      instances: digest(instances),
    },
    counts: {
      users: users.length,
      orders: orders.length,
      definitions: definitions.length,
      instances: instances.length,
      tenants: await prisma.tenant.count(),
      customers: await prisma.customer.count(),
      notes: await prisma.note.count(),
      credentials: await prisma.knowledgeCredential.count(),
      annotations: await prisma.serviceOrderOccurrence.count(),
    },
  };
  const output = process.env.ERP_ROLE_STATE_FILE;
  if (!output?.startsWith('/tmp/ajust-role-consolidation-'))
    throw new Error('Choose a private role-consolidation temporary directory.');
  fs.writeFileSync(output, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
  if (process.env.ERP_ROLE_BEFORE_FILE) {
    const before = JSON.parse(fs.readFileSync(process.env.ERP_ROLE_BEFORE_FILE, 'utf8'));
    if (
      JSON.stringify(before.fingerprints) !== JSON.stringify(state.fingerprints) ||
      JSON.stringify(before.counts) !== JSON.stringify(state.counts)
    )
      throw new Error('Unrelated user/order/workflow data changed; investigate.');
  }
  console.log(
    JSON.stringify({
      roles: state.roles.map((role) => role.code),
      memberships: state.memberships.length,
      counts: state.counts,
      unchangedOperationalData: !!process.env.ERP_ROLE_BEFORE_FILE,
    }),
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
