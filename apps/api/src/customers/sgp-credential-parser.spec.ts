import { parseAccessNote } from './sgp-credential-parser';
describe('SGP access-note parsing', () => {
  it('does not treat URL-shaped passwords as public equipment addresses', () => {
    const [p] = parseAccessNote('SGP\nLogin: person\nSenha: https://secret.example/', 16);
    expect(p.secret).toBe('https://secret.example/');
    expect(p.host).toBe('');
  });
  it('extracts labeled real values across HTML lines without inventing an environment', () => {
    const [p] = parseAccessNote(
      '<p>PROXMOX</p><p>URL: https://host.example:8006/</p><p>Login:</p><p>root</p><p>Senha:</p><p>A&#38;B</p>',
      12,
    );
    expect(p.host).toBe('https://host.example:8006/');
    expect(p.username).toBe('root');
    expect(p.secret).toBe('A&B');
    expect(p.missing).toEqual([]);
  });
  it('does not guess which password belongs to which user when a note has multiple pairs', () => {
    const [p] = parseAccessNote('SGP\nLogin: a\nSenha: x\nLogin: b\nSenha: y', 13);
    expect(p.username).toBe('');
    expect(p.secret).toBe('');
    expect(p.ambiguous).toBe(true);
  });
  it('keeps missing values empty and retains the original content for protected review', () => {
    const [p] = parseAccessNote('OLT\nAcesso ainda não informado', 14);
    expect(p.host).toBe('');
    expect(p.sourceText).toContain('não informado');
  });
  it('splits explicitly separate systems and strips secrets from public host URLs', () => {
    const parts = parseAccessNote(
      'GRAFANA\nURL: https://a:b@a.example/?token=hidden\nLogin: a\nSenha: x\nZABBIX\nURL: https://z.example/\nLogin: b\nSenha: y',
      15,
    );
    expect(parts).toHaveLength(2);
    expect(parts[0].host).toBe('https://a.example/');
    expect(parts[0].secret).toBe('x');
    expect(parts[1].secret).toBe('y');
  });
});
