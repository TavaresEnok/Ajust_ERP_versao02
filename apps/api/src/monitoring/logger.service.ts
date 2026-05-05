import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LoggerService {
  private logDir: string;

  constructor() {
    this.logDir = process.env.LOG_DIR || 'logs';
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatLog(level: string, message: string, context?: string, meta?: Record<string, unknown>): string {
    const timestamp = this.formatTimestamp();
    const contextStr = context ? ` [${context}]` : '';
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]${contextStr}: ${message}${metaStr}`;
  }

  private writeLog(level: string, message: string, context?: string, meta?: Record<string, unknown>): void {
    const formatted = this.formatLog(level, message, context, meta);

    // Console output for all levels in development
    if (process.env.NODE_ENV !== 'production') {
      const colors: Record<string, string> = {
        ERROR: '\x1b[31m', // Red
        WARN: '\x1b[33m',  // Yellow
        INFO: '\x1b[32m',  // Green
        DEBUG: '\x1b[36m', // Cyan
        RESET: '\x1b[0m',
      };
      const color = colors[level] || colors.INFO;
      console.log(`${color}${formatted}${colors.RESET}`);
    }

    // File output for errors and combined logs
    try {
      if (level === 'ERROR') {
        const errorLogPath = path.join(this.logDir, 'error.log');
        fs.appendFileSync(errorLogPath, formatted + '\n');
      }
      const combinedLogPath = path.join(this.logDir, 'combined.log');
      fs.appendFileSync(combinedLogPath, formatted + '\n');
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  log(message: string, context?: string, meta?: Record<string, unknown>): void {
    this.writeLog('INFO', message, context, meta);
  }

  error(message: string, error?: Error | string, context?: string, meta?: Record<string, unknown>): void {
    const errorData = {
      ...meta,
      ...(error instanceof Error ? { error: error.message, stack: error.stack } : { error }),
    };
    this.writeLog('ERROR', message, context, errorData);
  }

  warn(message: string, context?: string, meta?: Record<string, unknown>): void {
    this.writeLog('WARN', message, context, meta);
  }

  debug(message: string, context?: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug') {
      this.writeLog('DEBUG', message, context, meta);
    }
  }

  verbose(message: string, context?: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'verbose' || process.env.LOG_LEVEL === 'debug') {
      this.writeLog('VERBOSE', message, context, meta);
    }
  }

  logHttpRequest(method: string, path: string, status: number, duration: number, userId?: string): void {
    this.log(
      `${method} ${path} - Status: ${status} - Duration: ${duration}ms`,
      'HTTP',
      { userId, status, duration },
    );
  }

  logDatabaseQuery(operation: string, model: string, duration: number, userId?: string): void {
    this.debug(
      `${operation} on ${model} - Duration: ${duration}ms`,
      'DATABASE',
      { userId, duration },
    );
  }

  logSecurityEvent(eventType: string, details: Record<string, unknown>): void {
    this.warn(`Security Event: ${eventType}`, 'SECURITY', details);
  }

  logAuthenticationAttempt(identifier: string, success: boolean, details?: Record<string, unknown>): void {
    const level = success ? 'INFO' : 'WARN';
    const message = success ? `Authentication successful for ${identifier}` : `Authentication failed for ${identifier}`;
    this.writeLog(level, message, 'AUTH', details);
  }
}
