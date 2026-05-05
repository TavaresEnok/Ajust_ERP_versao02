import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import { CsrfMiddleware } from './common/csrf.middleware';

// ─── Variáveis inseguras detectadas em ambientes não-dev ────────────────────
const INSECURE_DEFAULTS = new Set([
  'dev-access-secret',
  'dev-refresh-secret',
  'change-this-secret-key-in-production',
]);

function validateEnv() {
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (!isProduction) return;

  const criticalVars = [
    { name: 'JWT_ACCESS_SECRET', value: process.env.JWT_ACCESS_SECRET },
    { name: 'JWT_REFRESH_SECRET', value: process.env.JWT_REFRESH_SECRET },
    { name: 'SECRETS_ENCRYPTION_KEY', value: process.env.SECRETS_ENCRYPTION_KEY },
  ];

  const insecure = criticalVars.filter(
    (v) => !v.value || INSECURE_DEFAULTS.has(v.value)
  );

  if (insecure.length > 0) {
    const names = insecure.map((v) => v.name).join(', ');
    console.error(
      `[api] ERRO CRÍTICO: As seguintes variáveis de ambiente estão com valores inseguros em produção: ${names}. ` +
      'Defina valores seguros antes de subir em produção.'
    );
    process.exit(1);
  }
}

/**
 * Filtro global: converte ZodError em HTTP 400 com detalhes de validação.
 * Antes disso, um campo inválido retornava 500 Internal Server Error.
 */
@Catch(ZodError)
class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<import('express').Response>();

    const issues = exception.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: 400,
      error: 'Validation Error',
      issues,
    });
  }
}

/**
 * Filtro global: garante que todos os erros retornam JSON consistente.
 */
@Catch()
class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<import('express').Response>();

    if (exception instanceof ZodError) {
      // Tratado pelo ZodExceptionFilter acima
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      return response.status(status).json(
        typeof exceptionResponse === 'string'
          ? { statusCode: status, message: exceptionResponse }
          : exceptionResponse
      );
    }

    console.error('[api] Unhandled error:', exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  const port = Number(process.env.PORT || 3001);

  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  
  if (isProduction) {
    app.enableCors({
      origin: process.env.WEB_BASE_URL || 'https://ajusterp.com.br',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });
  } else {
    app.enableCors();
  }

  // ✅ SECURITY: Helmet + cookies + CSRF (Bearer/webhooks isentos no CsrfMiddleware)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser()); // Parse cookies para CSRF validation
  const csrfMiddleware = new CsrfMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) => csrfMiddleware.use(req, res, next)); // Proteção CSRF (compatível com Bearer + webhooks públicos)

  // Filtros globais: ZodError primeiro (mais específico), depois genérico
  app.useGlobalFilters(new GlobalExceptionFilter(), new ZodExceptionFilter());

  await app.listen(port, '0.0.0.0');
  console.log(`[api] running on port ${port}`);
}

void bootstrap();
