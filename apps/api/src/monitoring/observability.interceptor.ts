import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrometheusService } from './prometheus.service';
import { LoggerService } from './logger.service';

const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;
const NUMERIC_SEGMENT = /\/\d+(?=\/|$)/g;
const LONG_TOKEN_SEGMENT = /\/[A-Za-z0-9_-]{24,}(?=\/|$)/g;

export function normalizeMetricRoute(request: {
  baseUrl?: string;
  route?: { path?: string };
  path?: string;
}): string {
  if (request.route?.path) {
    const combined = `${request.baseUrl || ''}${request.route.path}`;
    return combined.startsWith('/') ? combined : `/${combined}`;
  }
  const raw = request.path || '/';
  return raw
    .replace(UUID_SEGMENT, '/:id')
    .replace(NUMERIC_SEGMENT, '/:id')
    .replace(LONG_TOKEN_SEGMENT, '/:token');
}

@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  constructor(
    @Optional() private readonly prometheusService?: PrometheusService,
    @Optional() private readonly loggerService?: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, path } = request;
    const metricRoute = normalizeMetricRoute(request);
    const startTime = Date.now();

    return next.handle().pipe(
      tap(
        () => {
          const duration = Date.now() - startTime;
          const status = response.statusCode || 200;

          // Record metrics using route template to prevent unbounded label cardinality
          this.prometheusService?.recordHttpRequest(method, metricRoute, status, duration);

          // Log request
          const userId = request.auth?.userId || request.user?.id || 'anonymous';
          this.loggerService?.logHttpRequest(method, path, status, duration, userId);
        },
        (error) => {
          const duration = Date.now() - startTime;
          const status = error?.status || 500;

          // Record metrics for errors
          this.prometheusService?.recordHttpRequest(method, metricRoute, status, duration);

          // Log error
          const userId = request.auth?.userId || request.user?.id || 'anonymous';
          this.loggerService?.error(`${method} ${path} - Status: ${status}`, error, 'HTTP', {
            userId,
            duration,
          });
        },
      ),
    );
  }
}
