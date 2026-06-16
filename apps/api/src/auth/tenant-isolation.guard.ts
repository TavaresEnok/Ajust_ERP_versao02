import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Optional,
  Inject,
} from '@nestjs/common';
import { RequestWithAuth } from '../common/request-with-auth';
import { PrometheusService } from '../monitoring/prometheus.service';

/**
 * Guard obrigatório para validar tenant isolation
 * NUNCA aceita tenantId de query parameters ou body (exceto rotas explicitamente listadas)
 * SEMPRE usa tenantId do JWT token como âncora
 */
@Injectable()
export class TenantIsolationGuard implements CanActivate {
  constructor(
    @Optional() @Inject(PrometheusService) private readonly prometheusService?: PrometheusService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    // Validar que o usuário tem tenantId no token
    if (!request.auth?.tenantId) {
      throw new UnauthorizedException('Missing tenantId in token');
    }

    // 🔴 CRÍTICO: Se houver tenantId no query, REJEITAR
    const query = request.query;
    const body = request.body;

    if (query && typeof query === 'object' && 'tenantId' in query) {
      // Record violation
      if (this.prometheusService) {
        this.prometheusService.recordTenantIsolationViolation();
      }
      throw new ForbiddenException(
        'tenantId cannot be passed as query parameter. Use authenticated token instead.',
      );
    }

    // tenantId no body: permitido só em rotas onde o controller valida escopo (ex.: IAM criar usuário em tenant alvo)
    if (body && typeof body === 'object' && !Array.isArray(body) && 'tenantId' in body) {
      if (!this.bodyTenantIdAllowed(request)) {
        if (this.prometheusService) {
          this.prometheusService.recordTenantIsolationViolation();
        }
        throw new ForbiddenException(
          'tenantId cannot be passed in request body. Use authenticated token instead.',
        );
      }
    }

    return true;
  }

  /** Paths onde body.tenantId é parte do contrato legítimo (sempre validado no controller). */
  private bodyTenantIdAllowed(req: RequestWithAuth): boolean {
    const method = (req.method || '').toUpperCase();
    const path = req.path || req.url?.split('?')[0] || '';
    if (method === 'POST' && path === '/iam/users') {
      return true;
    }
    return false;
  }
}
