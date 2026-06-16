import 'reflect-metadata';
import { initTracing } from './monitoring/tracing';
initTracing(); // Must run before any other imports to instrument correctly
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import { CsrfMiddleware } from './common/csrf.middleware';
import { randomUUID } from 'crypto';
import { RequestContext } from './common/request-context';
import { RequestWithAuth } from './common/request-with-auth';

// ─── Variáveis inseguras detectadas em ambientes não-dev ────────────────────
const INSECURE_DEFAULTS = new Set([
  'dev-access-secret',
  'dev-refresh-secret',
  'dev_secret_key_123',
  'change-this-secret-key-in-production',
]);

function validateEnv() {
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (!isProduction) return;

  const criticalVars = [
    { name: 'JWT_ACCESS_SECRET', value: process.env.JWT_ACCESS_SECRET },
    { name: 'JWT_REFRESH_SECRET', value: process.env.JWT_REFRESH_SECRET },
    { name: 'JWT_RESET_SECRET', value: process.env.JWT_RESET_SECRET },
    { name: 'SECRETS_ENCRYPTION_KEY', value: process.env.SECRETS_ENCRYPTION_KEY },
    { name: 'MONITORING_WEBHOOK_TOKEN', value: process.env.MONITORING_WEBHOOK_TOKEN },
    { name: 'CHAT_WEBHOOK_TOKEN', value: process.env.CHAT_WEBHOOK_TOKEN },
  ];

  const insecure = criticalVars.filter((v) => !v.value || INSECURE_DEFAULTS.has(v.value));
  const missingOperationalVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'WEB_BASE_URL'].filter(
    (name) => !process.env[name],
  );

  if (insecure.length > 0 || missingOperationalVars.length > 0) {
    const names = [...insecure.map((variable) => variable.name), ...missingOperationalVars].join(
      ', ',
    );
    console.error(
      `[api] ERRO CRÍTICO: As seguintes variáveis de ambiente estão com valores inseguros em produção: ${names}. ` +
        'Defina valores seguros antes de subir em produção.',
    );
    process.exit(1);
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
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Validation Error',
        issues: exception.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      return response
        .status(status)
        .json(
          typeof exceptionResponse === 'string'
            ? { statusCode: status, message: exceptionResponse }
            : exceptionResponse,
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
  const requestContext = app.get(RequestContext);

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
  // CSP permite inline scripts/styles apenas para o Swagger UI (/api/docs).
  // Rotas de API (JSON) não renderizam HTML, então o benefício real é proteger o Swagger.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
    }),
  );
  app.use(cookieParser()); // Parse cookies para CSRF validation
  const csrfMiddleware = new CsrfMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) => csrfMiddleware.use(req, res, next)); // Proteção CSRF (compatível com Bearer + webhooks públicos)
  app.use(
    (req: RequestWithAuth & { user?: { id?: string } }, _res: Response, next: NextFunction) => {
      const traceId =
        (req.headers['x-trace-id'] as string) ||
        (req.headers['x-request-id'] as string) ||
        randomUUID();

      const tenantId = (req.headers['x-tenant-id'] as string) || undefined;
      const userId = req.auth?.userId || req.user?.id || undefined;

      requestContext.run({ traceId, tenantId, userId }, next);
    },
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  // ✅ Auto-documentação com Swagger/OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Ajust ERP API')
    .setDescription('API do Ajust ERP - BPO Técnico para Provedores')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port, '0.0.0.0');
  console.log(`[api] running on port ${port}`);
}

void bootstrap();
