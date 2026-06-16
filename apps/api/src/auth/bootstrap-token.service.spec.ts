import { BootstrapTokenService } from './bootstrap-token.service';

describe('BootstrapTokenService', () => {
  const service = new BootstrapTokenService();

  it('generates random token and SHA-256 hash and verifies safely', () => {
    const first = service.generateToken();
    const second = service.generateToken();

    expect(first.token).toHaveLength(64);
    expect(first.hash).toHaveLength(64);
    expect(first.token).not.toBe(second.token);
    expect(service.verifyToken(first.token, first.hash)).toBe(true);
    expect(service.verifyToken('wrong', first.hash)).toBe(false);
    expect(service.verifyToken(first.token, 'short')).toBe(false);
  });

  it('generates expiry, checks expiration and formats display', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-05T12:00:00.000Z'));
    const generated = service.generateTokenWithExpiry(2);

    expect(generated.expiresAt).toEqual(new Date('2026-06-05T14:00:00.000Z'));
    expect(service.isExpired(new Date('2026-06-05T11:00:00.000Z'))).toBe(true);
    expect(service.isExpired(new Date('2026-06-05T13:00:00.000Z'))).toBe(false);
    expect(service.formatTokenForDisplay('12345678abcdefghABCDEFGH')).toBe('12345678...ABCDEFGH');
    jest.useRealTimers();
  });
});
