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
import { NextFunction, Request, Response, json as expressJson } from 'express';
import { CsrfMiddleware } from './common/csrf.middleware';
import { randomUUID } from 'crypto';
import { RequestContext } from './common/request-context';
import { auditDeniedResponse } from './audit/audit-denied-response';
import { PrismaService } from './prisma/prisma.service';
import { validateVaultKey } from './common/vault.crypto';
import { RequestWithAuth } from './common/request-with-auth';
import { translateErrorMessage, translateZodIssue } from './common/error-messages-pt';

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
  // E-mail é opcional: sem SMTP a API só não envia e-mail. Exigir SMTP derrubaria a API em
  // produção, como aconteceu com o worker (C-086). Só é validado quando configurado.
  const missingOperationalVars = [
    'WEB_BASE_URL',
    ...(process.env.SMTP_HOST ? ['SMTP_USER', 'SMTP_PASS'] : []),
  ].filter((name) => !process.env[name]);

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
          message: translateZodIssue(issue),
        })),
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const body =
        typeof exceptionResponse === 'string'
          ? { statusCode: status, message: exceptionResponse }
          : (exceptionResponse as Record<string, unknown>);
      // Mensagens em português para o usuário final (C-080).
      if (typeof body.message === 'string') body.message = translateErrorMessage(body.message);
      else if (Array.isArray(body.message))
        body.message = body.message.map((m) =>
          typeof m === 'string' ? translateErrorMessage(m) : m,
        );
      return response.status(status).json(body);
    }

    console.error('[api] Unhandled error:', exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: translateErrorMessage('Internal server error'),
    });
  }
}

async function bootstrap() {
  validateEnv();
  if (process.env.NODE_ENV === 'production') validateVaultKey();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Confia só nos proxies da rede interna (contêiner web/BFF, Caddy no host): request.ip passa a
  // ser o IP real do usuário, e não o do contêiner web (auditoria C-049).
  app.getHttpAdapter().getInstance().set('trust proxy', 'loopback, linklocal, uniquelocal');
  const port = Number(process.env.PORT || 3001);
  const requestContext = app.get(RequestContext);
  const auditPrisma = app.get(PrismaService);
  app.use((req: RequestWithAuth, res: Response, next: NextFunction) => {
    res.once('finish', () => {
      void auditDeniedResponse(auditPrisma, req, res.statusCode);
    });
    next();
  });

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
  // Keep a wrapper: Nest detects middleware named jsonParser and would otherwise
  // skip installing its regular JSON parser for unrelated routes such as login.
  const topologyJsonParser = expressJson({ limit: '12mb' });
  app.use('/network-topologies', (req: Request, res: Response, next: NextFunction) =>
    topologyJsonParser(req, res, next),
  );
  app.use(cookieParser()); // Parse cookies para CSRF validation
  const csrfMiddleware = new CsrfMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) => csrfMiddleware.use(req, res, next)); // Proteção CSRF (compatível com Bearer + webhooks públicos)
  app.use(
    (req: RequestWithAuth & { user?: { id?: string } }, res: Response, next: NextFunction) => {
      const traceId =
        (req.headers['x-trace-id'] as string) ||
        (req.headers['x-request-id'] as string) ||
        randomUUID();

      res.setHeader('x-trace-id', traceId);
      res.setHeader('x-request-id', traceId);

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
