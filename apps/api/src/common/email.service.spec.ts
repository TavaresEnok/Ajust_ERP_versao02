import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

describe('EmailService security', () => {
  const prevSmtpHost = process.env.SMTP_HOST;

  beforeEach(() => {
    delete process.env.SMTP_HOST;
  });

  afterEach(() => {
    if (prevSmtpHost !== undefined) process.env.SMTP_HOST = prevSmtpHost;
    else delete process.env.SMTP_HOST;
    jest.restoreAllMocks();
  });

  it('nunca registra códigos OTP, links ou corpo de e-mail em logs quando SMTP está ausente', async () => {
    const service = new EmailService();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    service.sendEmail(
      'usuario@empresa.com.br',
      'Redefinição de senha',
      'Acesse https://erp.ajustconsulting.com.br/reset-password?token=SECRET_TOKEN_999',
    );
    await service.sendBootstrapOtp({
      email: 'cliente@provedor.com.br',
      otp: '987654',
      tenantName: 'Ajust',
    });

    const allLogs = [
      ...logSpy.mock.calls.flat(),
      ...debugSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
    ].join('\n');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(allLogs).not.toContain('SECRET_TOKEN_999');
    expect(allLogs).not.toContain('987654');
    expect(allLogs).not.toContain('usuario@empresa.com.br');
    expect(allLogs).not.toContain('cliente@provedor.com.br');
  });
});
