import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, realpathSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { decryptSecret } from './secrets.crypto';
const PREFIX = 'vault:v1:';
function key(create: boolean) {
  const path =
    process.env.VAULT_KEY_FILE ||
    join(process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads'), '.keys', 'vault.key');
  if (create && process.env.NODE_ENV !== 'production') {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    try {
      writeFileSync(path, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
  }
  if (process.env.NODE_ENV === 'production') {
    try {
      readFileSync(path);
    } catch {
      throw new Error(`Chave do cofre ausente em ${path}. Restaure o backup seguro da chave.`);
    }
  }
  const result = readFileSync(path);
  if (result.length !== 32) throw new Error('Chave do cofre inválida; restaure o backup seguro.');
  return result;
}
/** Dedicated persistent key, independent from insecure development defaults and JWT secrets. */
export function encryptVaultSecret(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(true), iv);
  const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${bytes.toString('base64')}`;
}
export function decryptVaultSecret(value: string | null | undefined) {
  if (!value?.startsWith(PREFIX)) return decryptSecret(value);
  const [iv, tag, body] = value.slice(PREFIX.length).split('.');
  if (!iv || !tag || body === undefined) throw new Error('Segredo do cofre inválido.');
  const decipher = createDecipheriv('aes-256-gcm', key(false), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}

export function vaultSourceNoteText(value: string | null | undefined) {
  const plain = decryptVaultSecret(value);
  if (!plain.startsWith('sgp-note:v1:')) return plain;
  const record = JSON.parse(plain.slice('sgp-note:v1:'.length)) as { text: string };
  return record.text;
}

/** Production must mount the existing key separately from uploads, before API startup. */
export function validateVaultKey() {
  const configured = process.env.VAULT_KEY_FILE;
  if (!configured) throw new Error('Configure VAULT_KEY_FILE fora do volume de uploads.');
  const keyPath = realpathSync(configured);
  const root = resolve(process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads'));
  let uploadPath = root;
  try {
    uploadPath = realpathSync(root);
  } catch {
    /* Uploads may not exist yet. */
  }
  const inside = relative(uploadPath, keyPath);
  if (!inside || (!inside.startsWith('..') && !isAbsolute(inside)))
    throw new Error('A chave do cofre deve ficar fora do volume de uploads.');
  key(false);
}
