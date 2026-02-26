import { createDecipheriv, createHash } from 'node:crypto';

const PREFIX = 'enc:v1:';

function resolveKey() {
  const raw = process.env.SECRETS_ENCRYPTION_KEY || 'change-this-secret-key-in-production';
  return createHash('sha256').update(raw).digest();
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return '';
  if (!value.startsWith(PREFIX)) return value;

  const raw = value.slice(PREFIX.length);
  const parts = raw.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format.');
  }

  const [ivB64, tagB64, dataB64] = parts;
  const key = resolveKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
