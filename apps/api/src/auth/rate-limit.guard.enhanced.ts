import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { PrometheusService } from '../monitoring/prometheus.service';

// In-memory store: key = identifier + endpoint, value = array of timestamps
const requestLog = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LIMIT = 5; // 5 attempts per window

@Injectable()
export class RateLimitGuardEnhanced implements CanActivate {
  constructor(@Inject(PrometheusService) private prometheusService?: PrometheusService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const identifier = request.body?.identifier || request.body?.email || request.ip;
    const endpoint = request.route?.path || request.url;
    const key = `${identifier}:${endpoint}`;
    const now = Date.now();

    // Get existing requests for this key
    const requests = requestLog.get(key) || [];

    // Remove old requests outside the window
    const recentRequests = requests.filter((timestamp) => now - timestamp < WINDOW_MS);

    if (recentRequests.length >= LIMIT) {
      // Record the violation
      if (this.prometheusService) {
        this.prometheusService.recordRateLimitExceeded(endpoint);
      }

      throw new HttpException(
        'Too many login attempts. Please try again after 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Add current request
    recentRequests.push(now);
    requestLog.set(key, recentRequests);

    // Clean up old entries periodically (every hour)
    if (Math.random() < 0.01) {
      this.cleanupOldEntries();
    }

    return true;
  }

  private cleanupOldEntries(): void {
    const now = Date.now();
    for (const [key, requests] of requestLog.entries()) {
      const recentRequests = requests.filter((timestamp) => now - timestamp < WINDOW_MS);
      if (recentRequests.length === 0) {
        requestLog.delete(key);
      } else {
        requestLog.set(key, recentRequests);
      }
    }
  }
}
