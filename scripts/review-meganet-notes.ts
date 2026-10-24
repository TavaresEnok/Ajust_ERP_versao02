import { readSgp } from '../apps/api/src/service-processes/sgp-reader';
import { noteText } from '../apps/api/src/customers/sgp-credential-parser';
async function main() {
  let token = ''; for await (const chunk of process.stdin) token += chunk;
  process.env.SGP_TOKEN = token.trim();
  const notes = await readSgp('/api/ura/cliente/anotacao/list', {}, 'GET');
  const sensitive = /(?:senha|password|passwd|passphrase|secret|token|login|usu[aá]rio|username|community|chave|credencial)/i;
  for (const note of notes.filter((n: any) => Number(n.cliente) === 60)) {
    const raw = noteText(String(note.anotacao || ''));
    let hideNext = false;
    const lines = raw.split('\n').filter(Boolean).map(line => {
      if (sensitive.test(line)) { hideNext = /[:=]\s*$/.test(line) || line.trim().split(/\s+/).length <= 2; return '[campo de autenticação omitido]'; }
      if (hideNext) { hideNext = false; return '[valor omitido]'; }
      return line.replace(/https?:\/\/\S+/gi, '[URL]').replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[IP]').replace(/\S*@\S*/g, '[identificador]').replace(/\b\S*(?=[^\s]*[a-zA-Z])(?=[^\s]*\d)(?=[^\s]*[^a-zA-Z\d\s])\S+\b/g, '[valor técnico omitido]');
    });
    console.log(JSON.stringify({ note: note.id, lines: lines.length, content: lines }));
  }
}
main().catch(() => { console.error('Falha na leitura protegida.'); process.exitCode=1; });
