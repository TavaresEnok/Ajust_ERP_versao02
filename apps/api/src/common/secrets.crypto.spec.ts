import { decryptSecret, encryptSecret } from './secrets.crypto';

describe('secrets.crypto', () => {
  afterEach(() => {
    delete process.env.SECRETS_ENCRYPTION_KEY;
  });

  it('encrypts and decrypts authenticated v1 values', () => {
    process.env.SECRETS_ENCRYPTION_KEY = 'strong-secret-key-for-tests';
    const encrypted = encryptSecret('sensitive-value');
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain('sensitive-value');
    expect(decryptSecret(encrypted)).toBe('sensitive-value');
  });

  it('returns empty/plain values and rejects malformed encrypted value', () => {
    expect(decryptSecret(null)).toBe('');
    expect(decryptSecret('plain-value')).toBe('plain-value');
    expect(() => decryptSecret('enc:v1:broken')).toThrow('Invalid encrypted secret format');
  });

  it('requires encryption key', () => {
    expect(() => encryptSecret('value')).toThrow('SECRETS_ENCRYPTION_KEY');
  });
});
