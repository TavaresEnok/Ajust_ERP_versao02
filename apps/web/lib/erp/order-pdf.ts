import type { ErpRecord } from './contracts';
import { orderStatuses, priorities } from './contracts';
export async function downloadOrderPdf(order: ErpRecord) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 20;
  const line = (value: unknown, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(bold ? 13 : 10);
    const lines = pdf.splitTextToSize(
      String(value ?? 'Não informado').replace(/\t/g, '    '),
      174,
    ) as string[];
    for (const text of lines) {
      if (y > 277) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(text, 18, y);
      y += 5;
    }
    y += 3;
  };
  line('Ajust · Ordem de serviço', true);
  line(`Protocolo: ${order.protocol}`);
  line(order.title, true);
  line(
    `Provedor: ${(order.occurrence as ErpRecord)?.provider || order.requester || 'Não informado'}`,
  );
  line(
    `Situação: ${orderStatuses[String(order.status) as keyof typeof orderStatuses] || order.status} · Prioridade: ${priorities[String(order.priority) as keyof typeof priorities] || order.priority}`,
  );
  line(`Responsável: ${order.analystName || order.ownerName || 'Não informado'}`);
  line(
    `Abertura: ${new Date(String(order.createdAt)).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}`,
  );
  line('Descrição', true);
  line(order.description);
  line('Histórico e anotações', true);
  const notes = Array.isArray(order.occurrences) ? (order.occurrences as ErpRecord[]) : [];
  for (const n of notes) {
    line(
      `${new Date(String(n.createdAt)).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })} · ${(n.actorUser as ErpRecord)?.name || n.sourceAuthorName || 'Equipe'}`,
      true,
    );
    line(n.message);
  }
  const count = pdf.getNumberOfPages();
  for (let p = 1; p <= count; p++) {
    pdf.setPage(p);
    pdf.setFontSize(8);
    pdf.text(`Ajust · ${p} / ${count}`, 18, 290);
  }
  pdf.save(`OS-${String(order.protocol || order.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}
