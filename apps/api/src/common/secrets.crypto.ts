import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';

function resolveKey() {
  const raw = process.env.SECRETS_ENCRYPTION_KEY || 'change-this-secret-key-in-production';
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string) {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return '';
  if (!value.startsWith(PREFIX)) return value;

  const raw = value.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = raw.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted secret format.');
  }

  const key = resolveKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString('utf8');
}
