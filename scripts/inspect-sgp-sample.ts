import { collectSgpSample } from '../apps/api/src/service-processes/sgp-sample-source';
collectSgpSample()
  .then((rows) =>
    console.log(
      JSON.stringify(
        rows.map((r) => ({
          provider: r.customer.tradeName,
          inspected: r.inspected,
          selected: r.selected.map((s) => ({
            orderId: s.order.id,
            occurrenceId: s.occurrence.id,
            type: s.occurrence.tipo,
            status: s.order.status,
          })),
        })),
        null,
        2,
      ),
    ),
  )
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
