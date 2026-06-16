import { SecretsValidationService } from './secrets-validation.service';

describe('SecretsValidationService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('accepts strong secrets', () => {
    const service = new SecretsValidationService();

    expect(service.validateSecret('TOKEN', 'a'.repeat(32))).toBe(true);
  });

  it.each([
    'short',
    'dev-access-secret-that-is-still-unsafe',
    'dev-custom-secret-that-is-long-but-unsafe',
    'value-with-ajust123-inside',
  ])('rejects unsafe secret %s', (secret) => {
    const service = new SecretsValidationService();

    expect(service.validateSecret('TOKEN', secret)).toBe(false);
  });

  it('não inclui o valor do segredo no log de erro', () => {
    const service = new SecretsValidationService();
    const logger = (service as any).logger;
    const error = jest.spyOn(logger, 'error').mockImplementation();

    service.validateSecret('TOKEN', 'secret-value');

    expect(error).toHaveBeenCalledWith("Secret 'TOKEN' is unsafe.");
    expect(error).not.toHaveBeenCalledWith(expect.stringContaining('secret-value'));
  });

  it('throws during production startup when critical secrets are unsafe', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'dev-access-secret';
    process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret';
    process.env.SECRETS_ENCRYPTION_KEY = 'short';
    delete process.env.POSTGRES_PASSWORD;
    const service = new SecretsValidationService();

    expect(() => service.onModuleInit()).toThrow('Unsafe secrets in PRODUCTION');
  });

  it('allows development startup while warning about unsafe secrets', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.SECRETS_ENCRYPTION_KEY;
    delete process.env.POSTGRES_PASSWORD;
    const service = new SecretsValidationService();

    expect(() => service.onModuleInit()).not.toThrow();
  });
});
