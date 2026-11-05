import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptVaultSecret, decryptVaultSecret } from './vault.crypto';
describe('Dedicated vault key', () => {
  let folder: string;
  const previous = process.env.VAULT_KEY_FILE;
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'ajust-vault-test-'));
    process.env.VAULT_KEY_FILE = join(folder, 'key');
  });
  afterEach(() => {
    rmSync(folder, { recursive: true, force: true });
    if (previous === undefined) delete process.env.VAULT_KEY_FILE;
    else process.env.VAULT_KEY_FILE = previous;
  });
  it('persists a private random key and authenticates both empty and populated secrets', () => {
    const a = encryptVaultSecret('secret-value');
    expect(a).not.toContain('secret-value');
    expect(decryptVaultSecret(a)).toBe('secret-value');
    const key = readFileSync(process.env.VAULT_KEY_FILE!);
    expect(key.length).toBe(32);
    expect(decryptVaultSecret(encryptVaultSecret(''))).toBe('');
    expect(readFileSync(process.env.VAULT_KEY_FILE!)).toEqual(key);
  });
  it('rejects a wrong key and never silently generates a replacement on decryption', () => {
    const encrypted = encryptVaultSecret('value');
    writeFileSync(process.env.VAULT_KEY_FILE!, Buffer.alloc(32, 5));
    expect(() => decryptVaultSecret(encrypted)).toThrow();
    unlinkSync(process.env.VAULT_KEY_FILE!);
    expect(() => decryptVaultSecret(encrypted)).toThrow();
    expect(existsSync(process.env.VAULT_KEY_FILE!)).toBe(false);
  });
});

describe('Production vault key', () => {
  it('never creates a key even with the legacy autocreate flag', () => {
    const previous = {
      env: process.env.NODE_ENV,
      path: process.env.VAULT_KEY_FILE,
      auto: process.env.VAULT_KEY_AUTOCREATE,
    };
    const folder = mkdtempSync(join(tmpdir(), 'vault-prod-'));
    try {
      process.env.NODE_ENV = 'production';
      process.env.VAULT_KEY_FILE = join(folder, 'absent');
      process.env.VAULT_KEY_AUTOCREATE = 'true';
      expect(() => encryptVaultSecret('value')).toThrow('Chave do cofre ausente');
      expect(existsSync(process.env.VAULT_KEY_FILE)).toBe(false);
    } finally {
      for (const [key, value] of Object.entries({
        NODE_ENV: previous.env,
        VAULT_KEY_FILE: previous.path,
        VAULT_KEY_AUTOCREATE: previous.auto,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
