import { Inject, Injectable, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { RequestContext } from '../common/request-context';

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  traceId?: string;
  tenantId?: string;
  userId?: string;
  context?: string;
  [key: string]: unknown;
}

@Injectable()
export class LoggerService {
  private logDir: string;
  private lokiUrl: string | null;
  private lokiBuffer: LogEntry[] = [];
  private lokiFlushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Optional() @Inject(RequestContext) private readonly requestContext?: RequestContext,
  ) {
    this.logDir = process.env.LOG_DIR || 'logs';
    this.lokiUrl = process.env.LOKI_URL || null;
    this.ensureLogDir();
    if (this.lokiUrl) this.startLokiFlush();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private startLokiFlush(): void {
    // Flush buffered logs to Loki every 5 seconds
    this.lokiFlushTimer = setInterval(() => this.flushToLoki(), 5000);
  }

  private async flushToLoki(): Promise<void> {
    if (!this.lokiUrl || this.lokiBuffer.length === 0) return;

    const entries = this.lokiBuffer.splice(0, 100);
    const streams = entries.map((entry) => ({
      stream: {
        app: 'ajust-api',
        level: entry.level.toLowerCase(),
        ...(entry.tenantId ? { tenantId: entry.tenantId } : {}),
      },
      values: [[`${new Date(entry.timestamp).getTime() * 1_000_000}`, JSON.stringify(entry)]],
    }));

    const payload = JSON.stringify({ streams });
    const url = new URL('/loki/api/v1/push', this.lokiUrl);
    const transport = url.protocol === 'https:' ? https : http;

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        res.resume();
      },
    );
    req.on('error', () => {
      /* silent — don't crash if Loki is down */
    });
    req.write(payload);
    req.end();
  }

  private buildLogEntry(
    level: string,
    message: string,
    context?: string,
    meta?: Record<string, unknown>,
  ): LogEntry {
    const traceId = this.requestContext?.getTraceId();
    const tenantId = this.requestContext?.getTenantId();
    const userId = this.requestContext?.getUserId();

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(traceId ? { traceId } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(userId ? { userId } : {}),
      ...(context ? { context } : {}),
      ...(meta || {}),
    };

    return entry;
  }

  private writeLog(
    level: string,
    message: string,
    context?: string,
    meta?: Record<string, unknown>,
  ): void {
    const entry = this.buildLogEntry(level, message, context, meta);

    if (process.env.NODE_ENV !== 'production') {
      const colors: Record<string, string> = {
        ERROR: '\x1b[31m',
        WARN: '\x1b[33m',
        INFO: '\x1b[32m',
        DEBUG: '\x1b[36m',
        RESET: '\x1b[0m',
      };
      const color = colors[level] || colors.INFO;
      const ctxStr = entry.context ? ` [${entry.context}]` : '';
      const traceStr = entry.traceId ? ` [trace=${entry.traceId}]` : '';
      const msgStr =
        Object.keys(entry).length > 5
          ? `${message} ${JSON.stringify(entry)}`
          : `${entry.timestamp} [${level}]${ctxStr}${traceStr}: ${message}`;
      console.log(`${color}${msgStr}${colors.RESET}`);
    }

    try {
      const jsonLine = JSON.stringify(entry);
      if (level === 'ERROR') {
        const errorLogPath = path.join(this.logDir, 'error.log');
        fs.appendFileSync(errorLogPath, jsonLine + '\n');
      }
      const combinedLogPath = path.join(this.logDir, 'combined.log');
      fs.appendFileSync(combinedLogPath, jsonLine + '\n');

      if (this.lokiUrl) {
        this.lokiBuffer.push(entry);
        // Cap buffer to avoid unbounded growth if Loki is unavailable
        if (this.lokiBuffer.length > 500) this.lokiBuffer.shift();
      }
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  log(message: string, context?: string, meta?: Record<string, unknown>): void {
    this.writeLog('INFO', message, context, meta);
  }

  error(
    message: string,
    error?: Error | string,
    context?: string,
    meta?: Record<string, unknown>,
  ): void {
    const errorData: Record<string, unknown> = {
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

  logHttpRequest(
    method: string,
    path: string,
    status: number,
    duration: number,
    userId?: string,
  ): void {
    this.log(`${method} ${path} - Status: ${status} - Duration: ${duration}ms`, 'HTTP', {
      userId,
      status,
      duration,
    });
  }

  logDatabaseQuery(operation: string, model: string, duration: number, userId?: string): void {
    this.debug(`${operation} on ${model} - Duration: ${duration}ms`, 'DATABASE', {
      userId,
      duration,
    });
  }

  logSecurityEvent(eventType: string, details: Record<string, unknown>): void {
    this.warn(`Security Event: ${eventType}`, 'SECURITY', details);
  }

  logAuthenticationAttempt(
    identifier: string,
    success: boolean,
    details?: Record<string, unknown>,
  ): void {
    const level = success ? 'INFO' : 'WARN';
    const message = success
      ? `Authentication successful for ${identifier}`
      : `Authentication failed for ${identifier}`;
    this.writeLog(level, message, 'AUTH', details);
  }
}
