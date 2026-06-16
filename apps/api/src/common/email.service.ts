import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: Transporter;

  async onModuleInit(): Promise<void> {
    await this.initTransporter();
  }

  private async initTransporter() {
    if (!process.env.SMTP_HOST) {
      this.logger.warn('SMTP is not configured. Emails will be logged to console only.');
      return;
    }
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to initialize SMTP transporter: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Enfileira o envio de e-mail de forma assíncrona (fire-and-forget).
   * Nunca lança exceção para o chamador — falhas são retentadas e logadas.
   * Tenta até 3 vezes com backoff exponencial (1s, 2s, 4s).
   */
  sendEmail(to: string, subject: string, text: string, html?: string): void {
    if (!this.transporter || !process.env.SMTP_HOST) {
      this.logger.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
      this.logger.debug(`[MOCK EMAIL CONTENT]\n${text}`);
      return;
    }
    const transporter = this.transporter;

    const MAX_RETRIES = 3;
    const send = async () => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Ajust ERP" <noreply@ajusterp.com.br>',
            to,
            subject,
            text,
            html: html || text,
          });
          this.logger.log(`Email sent to ${to} (attempt ${attempt})`);
          return;
        } catch (error: any) {
          this.logger.warn(
            `Email attempt ${attempt}/${MAX_RETRIES} failed to ${to}: ${error.message}`,
          );
          if (attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
          }
        }
      }
      this.logger.error(
        `All ${MAX_RETRIES} email attempts failed to ${to} — subject: "${subject}"`,
      );
    };

    // Dispara e NÃO aguarda — o chamador é imediatamente liberado
    void send();
  }

  /**
   * Envia e-mail de forma síncrona (bloqueia até confirmar envio).
   * Use apenas para fluxos críticos como OTP/bootstrap onde a
   * confirmação de entrega é necessária antes de continuar.
   */
  private async sendEmailSync(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    if (!this.transporter || !process.env.SMTP_HOST) {
      this.logger.log(`[MOCK EMAIL SYNC] To: ${to} | Subject: ${subject}`);
      this.logger.debug(`[MOCK EMAIL CONTENT]\n${text}`);
      return;
    }
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || '"Ajust ERP" <noreply@ajusterp.com.br>',
      to,
      subject,
      text,
      html: html || text,
    });
    this.logger.log(`Email (sync) sent to ${to}`);
  }

  /**
   * Envia OTP de 6 dígitos para cliente fazer bootstrap via CNPJ.
   * Usa sendEmailSync pois o código só é exibido após envio bem-sucedido.
   */
  async sendBootstrapOtp({
    email,
    otp,
    tenantName,
    expiresAtMinutes = 15,
  }: {
    email: string;
    otp: string;
    tenantName: string;
    expiresAtMinutes?: number;
  }) {
    const subject = `🔐 Seu Código de Acesso - Ajust ERP`;

    const text = `
Olá,

Você solicitou um código de acesso para sua primeira autenticação no Ajust ERP.

Seu código é: ${otp}

Este código é válido por ${expiresAtMinutes} minutos.

Se você não solicitou este código, ignore este email.

---
Ajust ERP - Sistema de Gestão de Serviços
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #007AFF; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .code-box {
      background: white;
      border: 2px solid #007AFF;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
    }
    .code-box .otp {
      font-size: 36px;
      font-weight: bold;
      color: #007AFF;
      letter-spacing: 8px;
      font-family: monospace;
    }
    .code-box .expiry {
      font-size: 12px;
      color: #666;
      margin-top: 10px;
    }
    .footer { font-size: 12px; color: #999; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Ajust ERP - Código de Acesso</h2>
      <p>Tenant: ${tenantName}</p>
    </div>
    <div class="content">
      <p>Olá,</p>
      <p>Você solicitou um código de acesso para sua primeira autenticação no Ajust ERP.</p>
      
      <div class="code-box">
        <div class="otp">${otp}</div>
        <div class="expiry">Válido por ${expiresAtMinutes} minutos</div>
      </div>
      
      <p>Se você não solicitou este código, ignore este email.</p>
      
      <div class="footer">
        <p>Ajust ERP - Sistema de Gestão de Serviços</p>
        <p>Este é um email automático, não responda.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    await this.sendEmailSync(email, subject, text, html);
  }
}
