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

@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  constructor(
    @Optional() private readonly prometheusService?: PrometheusService,
    @Optional() private readonly loggerService?: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, path } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(
        () => {
          const duration = Date.now() - startTime;
          const status = response.statusCode || 200;

          // Record metrics
          this.prometheusService?.recordHttpRequest(method, path, status, duration);

          // Log request
          const userId = request.auth?.userId || request.user?.id || 'anonymous';
          this.loggerService?.logHttpRequest(method, path, status, duration, userId);
        },
        (error) => {
          const duration = Date.now() - startTime;
          const status = error?.status || 500;

          // Record metrics for errors
          this.prometheusService?.recordHttpRequest(method, path, status, duration);

          // Log error
          const userId = request.auth?.userId || request.user?.id || 'anonymous';
          this.loggerService?.error(
            `${method} ${path} - Status: ${status}`,
            error,
            'HTTP',
            { userId, duration },
          );
        },
      ),
    );
  }
}
