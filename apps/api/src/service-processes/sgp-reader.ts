/** Read-only allowlisted client. Never log request URLs: documented GET endpoints use query auth. */
export async function readSgp(
  path: string,
  filters: Record<string, string> = {},
  method: 'GET' | 'POST' = 'POST',
): Promise<any> {
  if (
    !/^\/api\/(?:ura\/(?:clientes\/|tecnicos\/|cliente\/anotacao\/list\/?|ocorrencia\/list\/|ordemservico\/list\/)|os\/(?:list\/id\/\d+|anotacoes\/list\/id\/\d+\/|ocorrencia\/comentario\/list\/id\/\d+\/|imagem\/id\/\d+\/list\/|\d+\/(?:comentario\/list\/|checklist\/list\/|imagem\/detail\/)|ocorrencia\/(?:tipo|motivo|metodo)\/list\/))$/.test(
      path,
    )
  )
    throw new Error('Leitura SGP fora da lista permitida.');
  const token = process.env.SGP_TOKEN;
  if (!token) throw new Error('SGP_TOKEN necessário no ambiente.');
  const params = new URLSearchParams({ token, app: 'Sistema_de_O.S', ...filters });
  const response = await fetch(
    `https://ajustconsulting.sgp.net.br${path}${method === 'GET' ? `?${params}` : ''}`,
    { method, ...(method === 'POST' ? { body: params } : {}), signal: AbortSignal.timeout(45000) },
  );
  if (!response.ok) throw new Error(`Consulta SGP ${path}: HTTP ${response.status}`);
  const result = await response.json();
  if (result.detail) throw new Error(`Consulta SGP ${path} recusada.`);
  return result;
}
