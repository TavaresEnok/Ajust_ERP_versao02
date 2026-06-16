import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * Serviço de validação de secrets críticos
 * Garante que secrets não usem valores padrão/defaults inseguros
 * Em produção, levanta erro se secrets estiverem inseguros
 */
@Injectable()
export class SecretsValidationService implements OnModuleInit {
  private readonly logger = new Logger('SecretsValidation');
  private readonly UNSAFE_SECRETS = new Set([
    'dev-access-secret',
    'dev-refresh-secret',
    'change-this-secret-key-in-production',
    'ajust123',
    'change-this',
    'change_me',
    'change-me',
    'dev-only',
    'dev-',
    'test-secret',
    'development',
  ]);

  onModuleInit() {
    this.validateSecrets();
  }

  private validateSecrets(): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const secrets = {
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      JWT_RESET_SECRET: process.env.JWT_RESET_SECRET,
      SECRETS_ENCRYPTION_KEY: process.env.SECRETS_ENCRYPTION_KEY,
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
      SMTP_PASS: process.env.SMTP_PASS,
      MONITORING_WEBHOOK_TOKEN: process.env.MONITORING_WEBHOOK_TOKEN,
      CHAT_WEBHOOK_TOKEN: process.env.CHAT_WEBHOOK_TOKEN,
    };

    const unsafeSecrets: string[] = [];

    for (const [name, value] of Object.entries(secrets)) {
      if (!value) {
        unsafeSecrets.push(`${name} is missing`);
      } else if (this.isUnsafe(value)) {
        unsafeSecrets.push(name);
      }
    }

    if (unsafeSecrets.length > 0) {
      if (isProduction) {
        throw new Error(
          `❌ CRITICAL: Unsafe secrets in PRODUCTION: ${unsafeSecrets.join(', ')}. ` +
            `Generate secure secrets and set environment variables before deploying.`,
        );
      } else {
        this.logger.warn(
          `⚠️  DEVELOPMENT: Using default/unsafe secrets: ${unsafeSecrets.join(', ')}. ` +
            `This is acceptable in development but MUST be changed before production!`,
        );
      }
    } else {
      this.logger.log('✅ All critical secrets are properly configured');
    }
  }

  private isUnsafe(secret: string): boolean {
    const lower = secret.toLowerCase();
    for (const unsafe of this.UNSAFE_SECRETS) {
      if (lower.includes(unsafe.toLowerCase())) {
        return true;
      }
    }
    // Check length for encryption keys (should be at least 64 chars for secure keys)
    if (secret.length < 32) {
      return true;
    }
    return false;
  }

  /**
   * Valida um secret individual
   */
  validateSecret(name: string, value: string): boolean {
    if (!value || this.isUnsafe(value)) {
      this.logger.error(`Secret '${name}' is unsafe.`);
      return false;
    }
    return true;
  }
}
