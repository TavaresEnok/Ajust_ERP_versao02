import { TotpService } from './totp.service';

describe('TotpService', () => {
  const service = new TotpService();
  const secret = 'JBSWY3DPEHPK3PXP';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates a base32 secret with the expected entropy size', () => {
    const generated = service.generateSecret();

    expect(generated).toMatch(/^[A-Z2-7]+=*$/);
    expect(generated.length).toBe(56);
  });

  it('generates and verifies the current six-digit code', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const code = service.getCurrentCode(secret);

    expect(code).toMatch(/^\d{6}$/);
    expect(service.verifyCode(secret, code)).toBe(true);
    expect(service.verifyCode(secret, '000000')).toBe(code === '000000');
  });

  it('accepts a code from the adjacent time window', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const code = service.getCurrentCode(secret);

    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_030_000);

    expect(service.verifyCode(secret, code)).toBe(true);
  });

  it('builds an authenticator-compatible provisioning URL', () => {
    expect(service.getProvisioningUrl(secret, 'user+test@example.com', 'Ajust ERP')).toBe(
      `otpauth://totp/Ajust%20ERP:user%2Btest%40example.com?secret=${secret}&issuer=Ajust%20ERP&algorithm=SHA1&digits=6&period=30`,
    );
  });

  it('rejects invalid base32 secrets', () => {
    expect(() => service.getCurrentCode('INVALID!')).toThrow('Invalid base32 character');
  });
});
