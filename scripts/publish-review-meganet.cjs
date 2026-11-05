require('./data-script-guard.cjs').assertDataScriptAllowed({ fixture: true });
// Publish only the reviewed 20-order Meganet sample for the requested client-portal review.
// Internal comments, attachments, credentials and all other customers stay unchanged.
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const accessFile = process.env.ERP_REVIEW_ACCESS_FILE;
  const access = JSON.parse(fs.readFileSync(accessFile, 'utf8'));
  const snapshot = path.join(path.dirname(accessFile), 'meganet-visibility-before.json');
  if (fs.existsSync(snapshot))
    throw new Error('Visibility snapshot already exists; review before repeating.');
  const where = {
    tenantId: access.tenantId,
    deletedAt: null,
    sourceSystem: 'SGP',
    externalProtocol: { startsWith: 'ajustconsulting.sgp.net.br:os:' },
    occurrence: { customerId: access.customerId, tenantId: access.tenantId, deletedAt: null },
  };
  const orders = await prisma.serviceOrder.findMany({
    where,
    select: { id: true, description: true, title: true, isCustomerVisible: true, version: true },
  });
  if (orders.length !== 20 || orders.some((order) => order.isCustomerVisible))
    throw new Error('Unexpected sample or previous publication.');
  if (
    orders.some((order) =>
      /senha|password|passwd|token|secret|https?:\/\/[^\s]*:[^\s]*@/i.test(
        order.title + '\n' + order.description,
      ),
    )
  )
    throw new Error('Possible secret in public text; manual review required.');
  fs.writeFileSync(
    snapshot,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        records: orders.map(({ description, title, ...order }) => order),
      },
      null,
      2,
    ),
    { mode: 0o600, flag: 'wx' },
  );
  await prisma.$transaction(async (tx) => {
    const updated = await tx.serviceOrder.updateMany({
      where: { ...where, id: { in: orders.map((order) => order.id) }, isCustomerVisible: false },
      data: { isCustomerVisible: true, version: { increment: 1 } },
    });
    if (updated.count !== 20) throw new Error('Sample changed during publication.');
    await tx.auditLog.create({
      data: {
        tenantId: access.tenantId,
        actorUserId: access.accounts.find((account) => account.role === 'gerente').id,
        action: 'OS_UPDATE',
        resourceType: 'customer_portal_review_publication',
        resourceId: access.customerId,
        metadata: {
          purpose: 'Requested manager review with customer login',
          customerId: access.customerId,
          orderIds: orders.map((order) => order.id),
          publishedCount: updated.count,
          commentsChanged: false,
          attachmentsChanged: false,
        },
      },
    });
  });
  console.log(
    JSON.stringify({
      publishedOrders: 20,
      otherCustomersChanged: false,
      commentsChanged: false,
      attachmentsChanged: false,
    }),
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
