import { Injectable } from '@nestjs/common';

interface Counter {
  [key: string]: number;
}

interface Histogram {
  [key: string]: number[];
}

interface Gauge {
  value: number;
}

@Injectable()
export class PrometheusService {
  private httpRequestCounter: Counter = {};
  private httpRequestDuration: Histogram = {};
  private activeConnections: Gauge = { value: 0 };
  private databaseQueryDuration: Histogram = {};
  private authenticationAttempts: Counter = {};
  private tenantIsolationViolations: number = 0;
  private rateLimitExceeded: Counter = {};

  private ordersCreatedCounter: Counter = {};
  private slaBreachesCounter: Counter = {};
  private activeSessions: Gauge = { value: 0 };
  private workflowExecutionsCounter: Counter = {};

  recordHttpRequest(method: string, route: string, status: number, duration: number): void {
    const key = `${method}:${route}:${status}`;
    this.httpRequestCounter[key] = (this.httpRequestCounter[key] || 0) + 1;

    if (!this.httpRequestDuration[key]) {
      this.httpRequestDuration[key] = [];
    }
    this.httpRequestDuration[key].push(duration);
  }

  incrementActiveConnections(): void {
    this.activeConnections.value++;
  }

  decrementActiveConnections(): void {
    this.activeConnections.value = Math.max(0, this.activeConnections.value - 1);
  }

  recordDatabaseQuery(operation: string, model: string, duration: number): void {
    const key = `${operation}:${model}`;
    if (!this.databaseQueryDuration[key]) {
      this.databaseQueryDuration[key] = [];
    }
    this.databaseQueryDuration[key].push(duration);
  }

  recordAuthenticationAttempt(success: boolean): void {
    const key = success ? 'success' : 'failure';
    this.authenticationAttempts[key] = (this.authenticationAttempts[key] || 0) + 1;
  }

  recordTenantIsolationViolation(): void {
    this.tenantIsolationViolations++;
  }

  recordRateLimitExceeded(endpoint: string): void {
    this.rateLimitExceeded[endpoint] = (this.rateLimitExceeded[endpoint] || 0) + 1;
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

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  getMetrics(): string {
    let metrics = '# HELP metrics Ajust ERP Metrics\n';
    metrics += '# TYPE metrics gauge\n\n';

    // HTTP Requests
    metrics += '# HTTP Requests\n';
    for (const [key, count] of Object.entries(this.httpRequestCounter)) {
      const [method, route, status] = key.split(':');
      const durations = this.httpRequestDuration[key] || [];
      const avgDuration = this.calculateMean(durations);
      metrics += `http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}\n`;
      metrics += `http_request_duration_ms{method="${method}",route="${route}",status="${status}",quantile="mean"} ${avgDuration.toFixed(2)}\n`;
    }

    // Active Connections
    metrics += `\n# Active WebSocket Connections\n`;
    metrics += `active_connections ${this.activeConnections.value}\n`;

    // Database Queries
    metrics += `\n# Database Queries\n`;
    for (const [key, durations] of Object.entries(this.databaseQueryDuration)) {
      const [operation, model] = key.split(':');
      const avgDuration = this.calculateMean(durations);
      const p95Duration = this.calculatePercentile(durations, 95);
      metrics += `database_query_duration_ms{operation="${operation}",model="${model}",quantile="mean"} ${avgDuration.toFixed(2)}\n`;
      metrics += `database_query_duration_ms{operation="${operation}",model="${model}",quantile="p95"} ${p95Duration.toFixed(2)}\n`;
    }

    // Authentication Attempts
    metrics += `\n# Authentication Attempts\n`;
    for (const [status, count] of Object.entries(this.authenticationAttempts)) {
      metrics += `authentication_attempts_total{status="${status}"} ${count}\n`;
    }

    // Security Violations
    metrics += `\n# Security Violations\n`;
    metrics += `tenant_isolation_violations_total ${this.tenantIsolationViolations}\n`;

    // Rate Limit Violations
    metrics += `\n# Rate Limit Violations\n`;
    for (const [endpoint, count] of Object.entries(this.rateLimitExceeded)) {
      metrics += `rate_limit_exceeded_total{endpoint="${endpoint}"} ${count}\n`;
    }

    // Orders Created
    metrics += `\n# Orders Created\n`;
    for (const [key, count] of Object.entries(this.ordersCreatedCounter)) {
      const [priority, type] = key.split(':');
      metrics += `ajust_orders_created_total{priority="${priority}",type="${type}"} ${count}\n`;
    }

    // SLA Breaches
    metrics += `\n# SLA Breaches\n`;
    for (const [tenant, count] of Object.entries(this.slaBreachesCounter)) {
      metrics += `ajust_sla_breaches_total{tenant="${tenant}"} ${count}\n`;
    }

    // Active Sessions
    metrics += `\n# Active Sessions\n`;
    metrics += `ajust_active_sessions ${this.activeSessions.value}\n`;

    // Workflow Executions
    metrics += `\n# Workflow Executions\n`;
    for (const [key, count] of Object.entries(this.workflowExecutionsCounter)) {
      const [rule, status] = key.split(':');
      metrics += `ajust_workflow_executions_total{rule="${rule}",status="${status}"} ${count}\n`;
    }

    return metrics;
  }
}
