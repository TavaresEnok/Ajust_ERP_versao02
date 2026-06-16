import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ALLOWED = new Set([
  '.editorconfig',
  '.env',
  '.env.example',
  '.env.prod.example',
  '.env.staging.example',
  '.gitignore',
  '.prettierignore',
  '.prettierrc.json',
  'Dockerfile',
  'docker-compose.prod.yml',
  'docker-compose.staging.yml',
  'docker-compose.yml',
  'eslint.config.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'start-api.sh',
  'tsconfig.base.json',
]);

const BANNED_EXTS = ['.js', '.py', '.cjs', '.mjs'];

const errors = [];

for (const entry of readdirSync(ROOT)) {
  if (entry === 'node_modules' || entry === '.git' || entry === '.next' || entry === '.pnpm-store') {
    continue;
  }
  if (ALLOWED.has(entry)) {
    continue;
  }
  const fullPath = join(ROOT, entry);
  if (!statSync(fullPath).isFile()) {
    continue;
  }
  const lower = entry.toLowerCase();
  if (BANNED_EXTS.some((ext) => lower.endsWith(ext))) {
    errors.push(`Arquivo de script não permitido na raiz: ${entry}`);
  }
}

if (errors.length > 0) {
  console.error('Pre-flight falhou:');
  for (const e of errors) console.error('  - ' + e);
  console.error('\nMova scripts para `scripts/` ou adicione ao allowlist (com justificativa) no `scripts/check-root-files.mjs`.');
  process.exit(1);
}

console.log('Pre-flight OK: nenhum script solto na raiz.');
