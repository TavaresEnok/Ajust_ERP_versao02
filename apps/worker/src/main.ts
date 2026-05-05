import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const INSECURE_DEFAULTS = new Set([
  'change-this-secret-key-in-production',
]);

function validateEnv() {
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (!isProduction) return;

  const criticalVars = [
    { name: 'SECRETS_ENCRYPTION_KEY', value: process.env.SECRETS_ENCRYPTION_KEY },
    { name: 'DATABASE_URL', value: process.env.DATABASE_URL },
  ];

  const insecure = criticalVars.filter(
    (v) => !v.value || INSECURE_DEFAULTS.has(v.value)
  );

  if (insecure.length > 0) {
    const names = insecure.map((v) => v.name).join(', ');
    console.error(
      `[worker] ERRO CRÍTICO: Variáveis inseguras em produção: ${names}. Abortando.`
    );
    process.exit(1);
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT || 3002);

  app.enableCors();

  await app.listen(port, '0.0.0.0');
  console.log(`[worker] running on port ${port}`);
}

void bootstrap();

