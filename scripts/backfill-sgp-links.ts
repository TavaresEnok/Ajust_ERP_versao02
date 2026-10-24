import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug: 'ajust-demo' } });
  const people = await db.user.findMany({
    where: { sourceSystem: 'SGP', tenants: { some: { tenantId: tenant.id } } },
    select: { id: true, name: true, sourceMetadata: true },
  });
  function match(value: string) {
    const key = value.trim().toLowerCase();
    if (!key) return;
    const found = people.filter(
      (p) =>
        p.name.trim().toLowerCase() === key ||
        String((p.sourceMetadata as any).sourceUsername)
          .trim()
          .toLowerCase() === key,
    );
    return found.length === 1 ? found[0].id : undefined;
  }
  let orders = 0,
    calendar = 0,
    comments = 0;
  for (const order of await db.serviceOrder.findMany({
    where: { tenantId: tenant.id, sourceSystem: 'SGP' },
  })) {
    const id = order.assigneeUserId || match(order.analystName || '');
    if (!order.assigneeUserId && id && order.version === 1) {
      await db.serviceOrder.update({ where: { id: order.id }, data: { assigneeUserId: id } });
      orders++;
    }
    if (id) {
      const updated = await db.calendarEvent.updateMany({
        where: {
          tenantId: tenant.id,
          serviceOrderId: order.id,
          assigneeId: null,
          title: { startsWith: 'SGP-' },
        },
        data: { assigneeId: id },
      });
      calendar += updated.count;
    }
  }
  for (const note of await db.serviceOrderOccurrence.findMany({
    where: { serviceOrder: { tenantId: tenant.id }, sourceSystem: 'SGP', actorUserId: null },
  })) {
    const id = match(note.sourceAuthorName || '');
    if (id) {
      await db.serviceOrderOccurrence.update({ where: { id: note.id }, data: { actorUserId: id } });
      comments++;
    }
  }
  for (const note of await db.occurrenceAnnotation.findMany({
    where: {
      tenantId: tenant.id,
      actorUserId: null,
      message: { startsWith: '[Comentário SGP · ' },
    },
  })) {
    const name = note.message.match(/^\[Comentário SGP · ([^\]]+)\]/)?.[1];
    const id = match(name || '');
    if (id) {
      await db.occurrenceAnnotation.update({ where: { id: note.id }, data: { actorUserId: id } });
      comments++;
    }
  }
  console.log(
    JSON.stringify({
      ordersLinked: orders,
      calendarLinked: calendar,
      commentsLinked: comments,
      people: people.length,
    }),
  );
}
main()
  .catch((e) => {
    console.error(e.name);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
