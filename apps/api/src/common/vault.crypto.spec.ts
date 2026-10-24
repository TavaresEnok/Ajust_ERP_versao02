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
