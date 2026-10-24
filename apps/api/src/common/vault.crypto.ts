import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { decryptSecret } from './secrets.crypto';
const PREFIX = 'vault:v1:';
function key(create: boolean) {
  const path =
    process.env.VAULT_KEY_FILE ||
    join(process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads'), '.keys', 'vault.key');
  if (create) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    try {
      writeFileSync(path, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
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
