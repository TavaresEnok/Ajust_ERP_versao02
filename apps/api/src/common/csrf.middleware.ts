/**
 * CSRF Protection Middleware
 *
 * Implementa proteção contra ataques Cross-Site Request Forgery (CSRF)
 *
 * Estratégia: Double-submit cookie + header validation
 * - Cookie: csrf_token
 * - Header: x-csrf-token
 *
 * Métodos seguros (GET, HEAD, OPTIONS): Sem validação
 * Métodos arriscados (POST, PUT, PATCH, DELETE): Requer validação
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly COOKIE_NAME = 'csrf_token';
  private readonly HEADER_NAME = 'x-csrf-token';
  private readonly SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];

  use(req: Request, res: Response, next: NextFunction) {
    // Métodos seguros: apenas gerar token se não existir
    if (this.SAFE_METHODS.includes(req.method)) {
      this.ensureTokenInCookie(req, res);
      return next();
    }

    // Autenticação Bearer (BFF → API): CSRF clássico não se aplica; cookie IXC/csrf não costuma existir no domínio da API.
    if (this.shouldSkipCsrf(req)) {
      return next();
    }

    // Métodos arriscados: validar CSRF token
    const cookieToken = req.cookies[this.COOKIE_NAME];
    const headerToken = req.headers[this.HEADER_NAME];

    if (!cookieToken) {
      return res.status(403).json({
        statusCode: 403,
        message: 'CSRF token missing in cookie',
      });
    }

    if (!headerToken) {
      return res.status(403).json({
        statusCode: 403,
        message: 'CSRF token missing in header',
      });
    }

    // Comparar tokens (timing-safe)
    if (!this.secureCompare(String(cookieToken), String(headerToken))) {
      return res.status(403).json({
        statusCode: 403,
        message: 'CSRF token validation failed',
      });
    }

    next();
  }

  /**
   * Rotas stateless com Bearer, webhooks com assinatura própria e auth público não devem ser bloqueados por double-submit cookie.
   */
  private shouldSkipCsrf(req: Request): boolean {
    const auth = req.headers.authorization;
    if (typeof auth === 'string' && /^Bearer\s+\S+/i.test(auth.trim())) {
      return true;
    }

    const rawPath = (req.originalUrl || req.url || '').split('?')[0] || '';
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

    const exactOrChild = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

    if (exactOrChild('/auth/login')) return true;
    if (exactOrChild('/auth/refresh')) return true;
    if (exactOrChild('/auth/forgot-password')) return true;
    if (exactOrChild('/auth/reset-password')) return true;
    if (exactOrChild('/auth/verify-2fa')) return true;
    if (exactOrChild('/auth/bootstrap')) return true;
    if (path === '/integrations/ixc/webhook' || path.startsWith('/integrations/ixc/webhook/')) {
      return true;
    }
    if (exactOrChild('/webhooks/chat')) return true;
    if (exactOrChild('/webhooks/monitoring')) return true;
    if (req.method === 'POST' && /^\/csat\/survey\/[^/]+\/answer$/.test(path)) {
      return true;
    }

    return false;
  }

  private ensureTokenInCookie(req: Request, res: Response) {
    let token = req.cookies[this.COOKIE_NAME];

    if (!token) {
      // Gerar novo token se não existir
      token = randomBytes(32).toString('hex');
      res.cookie(this.COOKIE_NAME, token, {
        httpOnly: false, // Precisa ser acessível via JavaScript para header
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
      });
    }

    // Adicionar token ao res.locals para usar em templates
    res.locals.csrfToken = token;
  }

  /**
   * Comparação timing-safe contra timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
