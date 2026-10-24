import { packVaultContent, unpackVaultContent, VaultAccessEntriesSchema } from './vault-content';
describe('structured vault content', () => {
  const entry = {
    label: 'SSH interno',
    method: 'SSH' as const,
    host: '192.0.2.1',
    port: 2222,
    context: 'VPN',
    username: 'operator',
    secret: 'private-example',
    notes: 'Acesso de administração',
  };
  it('preserves independent accounts, endpoints and the original technical text', () => {
    const entries = [
      entry,
      {
        ...entry,
        label: 'Web',
        method: 'WEB' as const,
        host: 'https://example.invalid',
        port: 443,
        username: 'web-user',
        secret: 'other-example',
      },
    ];
    expect(unpackVaultContent(packVaultContent('texto preservado', entries))).toEqual({
      text: 'texto preservado',
      accessEntries: entries,
    });
  });
  it('reads previous plain technical text without guessing credentials', () =>
    expect(unpackVaultContent('texto antigo')).toEqual({
      text: 'texto antigo',
      accessEntries: [],
    }));
  it('rejects invalid ports, excessive arrays and malformed versioned data', () => {
    expect(() => VaultAccessEntriesSchema.parse([{ ...entry, port: 65536 }])).toThrow();
    expect(() => VaultAccessEntriesSchema.parse(Array.from({ length: 51 }, () => entry))).toThrow();
    expect(() => unpackVaultContent('vault-content:v2:{}')).toThrow();
  });
});
