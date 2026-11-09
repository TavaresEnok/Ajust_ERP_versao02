'use client';
import Link from 'next/link';
import { useErpQuery } from '@/lib/erp/gateway';
import { useRouteBase } from '@/lib/erp/visual-data';
import type { ErpRecord } from '@/lib/erp/contracts';
export function OperationalAlerts() {
  const base = useRouteBase();
  const query = useErpQuery<ErpRecord[]>('/service-orders/operational-alerts');
  if (!query.data?.length) return null;
  return (
    <section className="panel mb-5 p-5 border-warning/30">
      <h2 className="section-title">Atenção aos atendimentos · {query.data.length}</h2>
      <div className="mt-3 max-h-56 overflow-auto space-y-3">
        {query.data.map((o) => (
          <div key={String(o.id)} className="text-sm">
            <Link className="text-link" href={`${base}/ordens/${o.id}`}>
              {String(o.protocol)} · {String(o.analystName || 'Sem responsável')}
            </Link>
            <p>
              {o.pausedAt
                ? `SLA pausado: ${o.pauseReason}`
                : 'Horário agendado passou sem início registrado.'}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
