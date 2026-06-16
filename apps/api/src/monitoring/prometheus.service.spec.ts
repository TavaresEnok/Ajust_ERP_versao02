import { PrometheusService } from './prometheus.service';

describe('PrometheusService', () => {
  it('records and renders operational, security and business metrics', () => {
    const service = new PrometheusService();

    service.recordHttpRequest('GET', '/health', 200, 10);
    service.recordHttpRequest('GET', '/health', 200, 30);
    service.incrementActiveConnections();
    service.incrementActiveConnections();
    service.decrementActiveConnections();
    service.recordDatabaseQuery('findMany', 'ServiceOrder', 10);
    service.recordDatabaseQuery('findMany', 'ServiceOrder', 30);
    service.recordAuthenticationAttempt(true);
    service.recordAuthenticationAttempt(false);
    service.recordTenantIsolationViolation();
    service.recordRateLimitExceeded('/auth/login');
    service.incrementOrdersCreated('CRITICA', 'ROMPIMENTO');
    service.incrementSlaBreaches('tenant-1');
    service.setActiveSessions(-1);
    service.incrementActiveSessions();
    service.decrementActiveSessions();
    service.decrementActiveSessions();
    service.incrementWorkflowExecutions('rule-1', 'SUCCESS');

    const metrics = service.getMetrics();

    expect(metrics).toContain('http_requests_total{method="GET",route="/health",status="200"} 2');
    expect(metrics).toContain('quantile="mean"} 20.00');
    expect(metrics).toContain('quantile="p95"} 30.00');
    expect(metrics).toContain('active_connections 1');
    expect(metrics).toContain('authentication_attempts_total{status="success"} 1');
    expect(metrics).toContain('authentication_attempts_total{status="failure"} 1');
    expect(metrics).toContain('tenant_isolation_violations_total 1');
    expect(metrics).toContain('rate_limit_exceeded_total{endpoint="/auth/login"} 1');
    expect(metrics).toContain('ajust_orders_created_total{priority="CRITICA",type="ROMPIMENTO"} 1');
    expect(metrics).toContain('ajust_sla_breaches_total{tenant="tenant-1"} 1');
    expect(metrics).toContain('ajust_active_sessions 0');
    expect(metrics).toContain('ajust_workflow_executions_total{rule="rule-1",status="SUCCESS"} 1');
  });

  it('renders empty metrics safely', () => {
    expect(new PrometheusService().getMetrics()).toContain('tenant_isolation_violations_total 0');
  });
});
