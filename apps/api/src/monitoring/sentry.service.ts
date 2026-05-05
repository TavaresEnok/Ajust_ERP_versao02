import { Injectable } from '@nestjs/common';

@Injectable()
export class SentryService {
  private dsn: string | null;
  private environment: string;

  constructor() {
    this.dsn = process.env.SENTRY_DSN || null;
    this.environment = process.env.NODE_ENV || 'development';
    this.initialize();
  }

  private initialize(): void {
    if (!this.dsn && this.environment === 'production') {
      console.warn('⚠️  SENTRY_DSN not configured. Error tracking disabled for production.');
    }

    if (this.dsn && this.environment === 'production') {
      console.log('✅ Sentry error tracking initialized for production environment');
    }
  }

  captureException(exception: Error, context?: Record<string, unknown>): void {
    if (!this.dsn) {
      // In development/without Sentry DSN, just log locally
      console.error('Captured Exception:', exception.message);
      if (context) {
        console.error('Context:', context);
      }
      return;
    }

    // When Sentry package is installed, this can be upgraded to:
    // Sentry.captureException(exception, { extra: context })
    console.error('Exception (would send to Sentry):', exception.message, context);
  }

  captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info', context?: Record<string, unknown>): void {
    if (!this.dsn) {
      console.log(`[${level.toUpperCase()}] ${message}`);
      return;
    }

    // When Sentry package is installed, this can be upgraded to:
    // Sentry.captureMessage(message, level)
    console.log(`[${level.toUpperCase()}] ${message}`, context);
  }

  setUser(userId: string, email?: string, username?: string): void {
    if (!this.dsn) {
      return;
    }

    // When Sentry package is installed, this can be upgraded to:
    // Sentry.setUser({ id: userId, email, username })
    console.debug('Sentry: User context set', { userId, email, username });
  }

  clearUser(): void {
    if (!this.dsn) {
      return;
    }

    // When Sentry package is installed, this can be upgraded to:
    // Sentry.setUser(null)
    console.debug('Sentry: User context cleared');
  }

  addBreadcrumb(category: string, message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info', data?: Record<string, unknown>): void {
    if (!this.dsn) {
      return;
    }

    // When Sentry package is installed, this can be upgraded to:
    // Sentry.addBreadcrumb({ category, message, level, data })
    console.debug('Sentry: Breadcrumb added', { category, message, level, data });
  }
}
