/**
 * O worker não pode abortar por falta de SMTP: sem e-mail ele ainda precisa rodar o
 * monitor de SLA, a reconciliação e a retenção (incidente de 04/11: 22 h parado).
 */
describe('validação de ambiente do worker', () => {
  const env = { ...process.env };
  let exit: jest.SpyInstance;
  beforeEach(() => {
    jest.resetModules();
    exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: jest.fn().mockResolvedValue({ enableShutdownHooks: jest.fn(), listen: jest.fn() }),
      },
    }));
    jest.doMock('./app.module', () => ({ AppModule: class {} }));
    Object.assign(process.env, {
      NODE_ENV: 'production',
      WORKER_HOST: '0.0.0.0',
      SECRETS_ENCRYPTION_KEY: 'k'.repeat(64),
      DATABASE_URL: 'postgresql://u:p@db:5432/x',
      WORKER_API_TOKEN: 't'.repeat(64),
    });
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });
  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  it('sobe sem SMTP configurado', async () => {
    await import('./main');
    expect(exit).not.toHaveBeenCalled();
  });

  it('aceita senha de caixa de e-mail comum (menos de 32 caracteres)', async () => {
    process.env.SMTP_HOST = 'smtp.exemplo.com';
    process.env.SMTP_USER = 'nao-responda@ajustconsulting.com.br';
    process.env.SMTP_PASS = 'Caixa#Ajust2026';
    await import('./main');
    expect(exit).not.toHaveBeenCalled();
  });

  it('com SMTP configurado, recusa senha curta', async () => {
    process.env.SMTP_HOST = 'smtp.exemplo.com';
    process.env.SMTP_USER = 'noc';
    process.env.SMTP_PASS = 'curta';
    await import('./main');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('sem token do worker, aborta', async () => {
    delete process.env.WORKER_API_TOKEN;
    await import('./main');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
