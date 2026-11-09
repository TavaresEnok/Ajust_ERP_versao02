import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const INSECURE_PATTERN = /change[_-]?me|change-this|ajust123|example|dev-/i;
const STRONG_SECRET_NAMES = new Set(['SECRETS_ENCRYPTION_KEY', 'WORKER_API_TOKEN']);

function validateEnv() {
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const host = process.env.WORKER_HOST || '0.0.0.0';
  if (!isProduction && ['localhost', '127.0.0.1', '::1'].includes(host)) return;

  const criticalVars = [
    { name: 'SECRETS_ENCRYPTION_KEY', value: process.env.SECRETS_ENCRYPTION_KEY },
    { name: 'DATABASE_URL', value: process.env.DATABASE_URL },
    { name: 'WORKER_API_TOKEN', value: process.env.WORKER_API_TOKEN },
    // E-mail é opcional (sem SMTP, só não envia e registra aviso). Só é validado quando
    // configurado: exigir SMTP derrubava o worker inteiro e parava o monitor de SLA.
    ...(process.env.SMTP_HOST
      ? [
          { name: 'SMTP_USER', value: process.env.SMTP_USER },
          { name: 'SMTP_PASS', value: process.env.SMTP_PASS },
        ]
      : []),
  ];

  const insecure = criticalVars.filter(
    ({ name, value }) =>
      !value ||
      INSECURE_PATTERN.test(value) ||
      (STRONG_SECRET_NAMES.has(name) && value.length < 32) ||
      // Senha do e-mail vem do provedor: 8+ caracteres, sem os 32 dos segredos internos.
      (name === 'SMTP_PASS' && value.length < 8),
  );

  if (insecure.length > 0) {
    const names = insecure.map((v) => v.name).join(', ');
    console.error(`[worker] ERRO CRÍTICO: Variáveis inseguras em produção: ${names}. Abortando.`);
    process.exit(1);
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT || 3002);

  await app.listen(port, process.env.WORKER_HOST || '0.0.0.0');
  console.log(`[worker] running on port ${port}`);
}

void bootstrap();
