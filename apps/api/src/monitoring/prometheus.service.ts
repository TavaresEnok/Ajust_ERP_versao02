import { Injectable } from '@nestjs/common';

interface Counter {
  [key: string]: number;
}

interface BoundedSeries {
  count: number;
  sum: number;
  buckets: number[];
  samples: number[];
  cursor: number;
}

interface Gauge {
  value: number;
}

const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const MAX_SAMPLES_PER_SERIES = 256;
const MAX_HTTP_SERIES = 500;
const MAX_DB_SERIES = 200;

function createSeries(): BoundedSeries {
  return {
    count: 0,
    sum: 0,
    buckets: new Array(DURATION_BUCKETS_MS.length + 1).fill(0),
    samples: [],
    cursor: 0,
  };
}

function observe(series: BoundedSeries, value: number): void {
  series.count += 1;
  series.sum += value;

  let bucketIndex = DURATION_BUCKETS_MS.length;
  for (let i = 0; i < DURATION_BUCKETS_MS.length; i++) {
    if (value <= DURATION_BUCKETS_MS[i]) {
      bucketIndex = i;
      break;
    }
  }
  series.buckets[bucketIndex] += 1;

  if (series.samples.length < MAX_SAMPLES_PER_SERIES) {
    series.samples.push(value);
  } else {
    series.samples[series.cursor] = value;
    series.cursor = (series.cursor + 1) % MAX_SAMPLES_PER_SERIES;
  }
}

/**
 * Escapa valores de label no formato de exposição do Prometheus. Nomes de regra, rota ou
 * endpoint com aspas ou quebra de linha quebravam o scrape (ou injetavam séries falsas).
 */
function labelValue(value: unknown): string {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

@Injectable()
export class PrometheusService {
  private httpRequestCounter: Counter = {};
  private httpRequestDuration = new Map<string, BoundedSeries>();
  private activeConnections: Gauge = { value: 0 };
  private databaseQueryDuration = new Map<string, BoundedSeries>();
  private authenticationAttempts: Counter = {};
  private tenantIsolationViolations: number = 0;
  private rateLimitExceeded: Counter = {};

  private ordersCreatedCounter: Counter = {};
  private slaBreachesCounter: Counter = {};
  private activeSessions: Gauge = { value: 0 };
  private workflowExecutionsCounter: Counter = {};

  private boundedKey(
    store: Map<string, BoundedSeries>,
    candidate: string,
    fallback: string,
    maxKeys: number,
  ): string {
    if (store.has(candidate) || store.size < maxKeys) return candidate;
    return fallback;
  }

  recordHttpRequest(method: string, route: string, status: number, duration: number): void {
    const rawKey = `${method}:${route}:${status}`;
    const key = this.boundedKey(
      this.httpRequestDuration,
      rawKey,
      `${method}:_other:${status}`,
      MAX_HTTP_SERIES,
    );
    this.httpRequestCounter[key] = (this.httpRequestCounter[key] || 0) + 1;

    let series = this.httpRequestDuration.get(key);
    if (!series) {
      series = createSeries();
      this.httpRequestDuration.set(key, series);
    }
    observe(series, duration);
  }

  incrementActiveConnections(): void {
    this.activeConnections.value++;
  }

  decrementActiveConnections(): void {
    this.activeConnections.value = Math.max(0, this.activeConnections.value - 1);
  }

  recordDatabaseQuery(operation: string, model: string, duration: number): void {
    const rawKey = `${operation}:${model}`;
    const key = this.boundedKey(
      this.databaseQueryDuration,
      rawKey,
      `${operation}:_other`,
      MAX_DB_SERIES,
    );
    let series = this.databaseQueryDuration.get(key);
    if (!series) {
      series = createSeries();
      this.databaseQueryDuration.set(key, series);
    }
    observe(series, duration);
  }

  recordAuthenticationAttempt(success: boolean): void {
    const key = success ? 'success' : 'failure';
    this.authenticationAttempts[key] = (this.authenticationAttempts[key] || 0) + 1;
  }

  recordTenantIsolationViolation(): void {
    this.tenantIsolationViolations++;
  }

  recordRateLimitExceeded(endpoint: string): void {
    const key =
      endpoint in this.rateLimitExceeded || Object.keys(this.rateLimitExceeded).length < 200
        ? endpoint
        : '_other';
    this.rateLimitExceeded[key] = (this.rateLimitExceeded[key] || 0) + 1;
  }

  incrementOrdersCreated(priority: string, type: string): void {
    const key = `${priority}:${type}`;
    this.ordersCreatedCounter[key] = (this.ordersCreatedCounter[key] || 0) + 1;
  }

  incrementSlaBreaches(tenant: string): void {
    this.slaBreachesCounter[tenant] = (this.slaBreachesCounter[tenant] || 0) + 1;
  }

  setActiveSessions(count: number): void {
    this.activeSessions.value = Math.max(0, count);
  }

  incrementActiveSessions(): void {
    this.activeSessions.value++;
  }

  decrementActiveSessions(): void {
    this.activeSessions.value = Math.max(0, this.activeSessions.value - 1);
  }

  incrementWorkflowExecutions(rule: string, status: string): void {
    const key = `${rule}:${status}`;
    this.workflowExecutionsCounter[key] = (this.workflowExecutionsCounter[key] || 0) + 1;
  }

  private calculateMean(series: BoundedSeries | undefined): number {
    if (!series || series.count === 0) return 0;
    return series.sum / series.count;
  }

  private calculatePercentile(series: BoundedSeries | undefined, percentile: number): number {
    if (!series || series.samples.length === 0) return 0;
    const sorted = [...series.samples].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  getMetrics(): string {
    // Sem "# TYPE metrics gauge": declarava uma métrica que não existe.
    let metrics = '';

    // HTTP Requests (bounded ring + fixed histogram buckets)
    metrics += '# HTTP Requests\n';
    for (const [key, count] of Object.entries(this.httpRequestCounter)) {
      const firstColon = key.indexOf(':');
      const lastColon = key.lastIndexOf(':');
      const method = key.slice(0, firstColon);
      const route = key.slice(firstColon + 1, lastColon);
      const status = key.slice(lastColon + 1);
      const series = this.httpRequestDuration.get(key);
      const avgDuration = this.calculateMean(series);
      const p95Duration = this.calculatePercentile(series, 95);
      metrics += `http_requests_total{method="${labelValue(method)}",route="${labelValue(route)}",status="${labelValue(status)}"} ${count}\n`;
      metrics += `http_request_duration_ms{method="${labelValue(method)}",route="${labelValue(route)}",status="${labelValue(status)}",quantile="mean"} ${avgDuration.toFixed(2)}\n`;
      metrics += `http_request_duration_ms{method="${labelValue(method)}",route="${labelValue(route)}",status="${labelValue(status)}",quantile="p95"} ${p95Duration.toFixed(2)}\n`;
      if (series) {
        let cumulative = 0;
        for (let i = 0; i < DURATION_BUCKETS_MS.length; i++) {
          cumulative += series.buckets[i];
          metrics += `http_request_duration_ms_bucket{method="${labelValue(method)}",route="${labelValue(route)}",status="${labelValue(status)}",le="${DURATION_BUCKETS_MS[i]}"} ${cumulative}\n`;
        }
        cumulative += series.buckets[DURATION_BUCKETS_MS.length];
        metrics += `http_request_duration_ms_bucket{method="${labelValue(method)}",route="${labelValue(route)}",status="${labelValue(status)}",le="+Inf"} ${cumulative}\n`;
        metrics += `http_request_duration_ms_sum{method="${labelValue(method)}",route="${labelValue(route)}",status="${labelValue(status)}"} ${series.sum.toFixed(2)}\n`;
        metrics += `http_request_duration_ms_count{method="${labelValue(method)}",route="${labelValue(route)}",status="${labelValue(status)}"} ${series.count}\n`;
      }
    }

    // Active Connections
    metrics += `\n# Active WebSocket Connections\n`;
    metrics += `active_connections ${this.activeConnections.value}\n`;

    // Database Queries
    metrics += `\n# Database Queries\n`;
    for (const [key, series] of this.databaseQueryDuration.entries()) {
      const [operation, model] = key.split(':');
      const avgDuration = this.calculateMean(series);
      const p95Duration = this.calculatePercentile(series, 95);
      metrics += `database_query_duration_ms{operation="${labelValue(operation)}",model="${labelValue(model)}",quantile="mean"} ${avgDuration.toFixed(2)}\n`;
      metrics += `database_query_duration_ms{operation="${labelValue(operation)}",model="${labelValue(model)}",quantile="p95"} ${p95Duration.toFixed(2)}\n`;
    }

    // Authentication Attempts
    metrics += `\n# Authentication Attempts\n`;
    for (const [status, count] of Object.entries(this.authenticationAttempts)) {
      metrics += `authentication_attempts_total{status="${labelValue(status)}"} ${count}\n`;
    }

    // Security Violations
    metrics += `\n# Security Violations\n`;
    metrics += `tenant_isolation_violations_total ${this.tenantIsolationViolations}\n`;

    // Rate Limit Violations
    metrics += `\n# Rate Limit Violations\n`;
    for (const [endpoint, count] of Object.entries(this.rateLimitExceeded)) {
      metrics += `rate_limit_exceeded_total{endpoint="${labelValue(endpoint)}"} ${count}\n`;
    }

    // Orders Created
    metrics += `\n# Orders Created\n`;
    for (const [key, count] of Object.entries(this.ordersCreatedCounter)) {
      const [priority, type] = key.split(':');
      metrics += `ajust_orders_created_total{priority="${labelValue(priority)}",type="${labelValue(type)}"} ${count}\n`;
    }

    // SLA Breaches
    metrics += `\n# SLA Breaches\n`;
    for (const [tenant, count] of Object.entries(this.slaBreachesCounter)) {
      metrics += `ajust_sla_breaches_total{tenant="${labelValue(tenant)}"} ${count}\n`;
    }

    // Active Sessions
    metrics += `\n# Active Sessions\n`;
    metrics += `ajust_active_sessions ${this.activeSessions.value}\n`;

    // Workflow Executions
    metrics += `\n# Workflow Executions\n`;
    for (const [key, count] of Object.entries(this.workflowExecutionsCounter)) {
      const [rule, status] = key.split(':');
      metrics += `ajust_workflow_executions_total{rule="${labelValue(rule)}",status="${labelValue(status)}"} ${count}\n`;
    }

    return metrics;
  }
}
