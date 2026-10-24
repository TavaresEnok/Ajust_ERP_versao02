import { SGP_CUSTOMERS } from '../customers/import-sgp-registry';

export type SourceRow = Record<string, any>;
// Freeze the reviewed pilot: reruns must not silently expand it as new SGP orders arrive.
const SAMPLE_IDS: Record<number, number[]> = {
  60: [
    10873, 11537, 11568, 11926, 11892, 11758, 11695, 11629, 11622, 11511, 11402, 11401, 11386,
    11333, 11326, 11302, 11015, 11007, 10965, 10958,
  ],
  108: [
    8911, 8205, 11840, 4597, 11848, 11620, 11550, 11498, 10774, 10642, 10456, 10257, 10255, 9372,
    8677, 7943, 7460, 7395, 7329, 7070,
  ],
  53: [
    10610, 740, 7237, 9539, 7615, 11935, 11581, 11039, 10738, 9462, 9082, 8733, 8588, 8366, 8315,
    7954, 7925, 7466, 7239, 7193,
  ],
  89: [
    11419, 11174, 11655, 11633, 10860, 11952, 11939, 11937, 11871, 11866, 11765, 11752, 11608,
    11467, 11406, 11396, 11366, 11293, 11287, 11156,
  ],
  25: [
    11885, 10521, 11405, 11858, 11931, 11928, 11915, 11898, 11893, 11879, 11874, 11843, 11781,
    11715, 11667, 11598, 11593, 11591, 11566, 11553,
  ],
  9: [
    11549, 10881, 11854, 10021, 11834, 11815, 11754, 11657, 11583, 11434, 11329, 11275, 11141,
    11054, 10890, 10233, 10200, 9968, 9325, 9138,
  ],
};
export async function collectSgpSample() {
  const token = process.env.SGP_TOKEN;
  if (!token) throw new Error('SGP_TOKEN obrigatório; não é persistido.');
  async function read(path: string, filters: Record<string, string>) {
    const response = await fetch(`https://ajustconsulting.sgp.net.br${path}`, {
      method: 'POST',
      body: new URLSearchParams({ token: token!, app: 'Sistema_de_O.S', ...filters }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`SGP HTTP ${response.status}`);
    const result = await response.json();
    if (result.detail) throw new Error('SGP recusou acesso.');
    return result;
  }
  const result: {
    customer: (typeof SGP_CUSTOMERS)[number];
    selected: { occurrence: SourceRow; order: SourceRow; detail: SourceRow }[];
    inspected: number;
    availableTypes: string[];
  }[] = [];
  for (const customer of SGP_CUSTOMERS) {
    const response = await read('/api/ura/clientes/', {
      cliente_id: String(customer.id),
      limit: '1',
      omitir_titulos: '1',
    });
    const sourceCustomer = response.clientes?.[0];
    if (
      Number(sourceCustomer?.id) !== customer.id ||
      String(sourceCustomer.cpfcnpj).replace(/\D/g, '') !== customer.taxId
    )
      throw new Error(`Identidade do cliente ${customer.id} divergente.`);
    const candidates: { occurrence: SourceRow; order: SourceRow }[] = [];
    for (const contract of sourceCustomer.contratos || []) {
      // Read only list metadata/content needed for classification; fetch at most 100 recent rows per contract.
      const [occurrences, orders] = await Promise.all([
        read('/api/ura/ocorrencia/list/', {
          contrato: String(contract.id),
          limit: '100',
          offset: '0',
        }),
        read('/api/ura/ordemservico/list/', {
          contrato: String(contract.id),
          limit: '100',
          offset: '0',
        }),
      ]);
      for (const order of orders.ordens_servicos || []) {
        const occurrence = occurrences.ocorrencias?.find(
          (o: SourceRow) => o.numero === order.ocorrencia,
        );
        if (occurrence && Number(order.contrato) === Number(contract.id))
          candidates.push({ occurrence, order });
      }
    }
    candidates.sort((a, b) => Number(b.order.id) - Number(a.order.id));
    const size = Number(process.env.SGP_SAMPLE_SIZE || 20);
    if (![5, 20].includes(size)) throw new Error('Amostra autorizada: 5 ou 20 O.S. por provedor.');
    const chosen = SAMPLE_IDS[customer.id].slice(0, size).map((id) => {
      const item = candidates.find((candidate) => Number(candidate.order.id) === id);
      if (!item)
        throw new Error(
          `O.S. revisada ${id} ausente da janela de consulta; amostra não será substituída.`,
        );
      return item;
    });
    if (chosen.length !== size)
      throw new Error(`Cliente ${customer.id}: não há ${size} tipos distintos na janela.`);
    const selected = [];
    for (const item of chosen) {
      const detail = await read(`/api/os/list/id/${Number(item.order.id)}`, {});
      if (
        Number(detail.cliente_id) !== customer.id ||
        Number(detail.contrato_id) !== Number(item.order.contrato) ||
        Number(detail.os_id) !== Number(item.order.id) ||
        detail.os_protocolo !== item.occurrence.numero
      )
        throw new Error(`Vínculo cliente/contrato/O.S. ${item.order.id} divergente.`);
      selected.push({ ...item, detail });
    }
    result.push({
      customer,
      selected,
      inspected: candidates.length,
      availableTypes: [...new Set(candidates.map((x) => String(x.occurrence.tipo)))],
    });
  }
  return result;
}

export const normalizeType = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
