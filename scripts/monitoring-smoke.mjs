const endpoints = [
  {
    name: 'api-health',
    url: process.env.API_HEALTH_URL || 'http://127.0.0.1:8071/monitoring/health',
    contains: '"status":"ok"',
  },
  {
    name: 'api-readiness',
    url: process.env.API_READY_URL || 'http://127.0.0.1:8071/monitoring/ready',
    contains: '"ready":true',
  },
  {
    name: 'api-metrics',
    url: process.env.API_METRICS_URL || 'http://127.0.0.1:8071/monitoring/metrics',
    contains: 'tenant_isolation_violations_total',
  },
  {
    name: 'worker-health',
    url: process.env.WORKER_HEALTH_URL || 'http://127.0.0.1:8076/health',
    contains: '"status":"ok"',
  },
  {
    name: 'loki-readiness',
    url: process.env.LOKI_READY_URL || 'http://127.0.0.1:3100/ready',
    contains: 'ready',
  },
];

const failures = [];
for (const endpoint of endpoints) {
  const startedAt = Date.now();
  try {
    const response = await fetch(endpoint.url, { signal: AbortSignal.timeout(5_000) });
    const body = await response.text();
    const durationMs = Date.now() - startedAt;
    if (!response.ok || !body.includes(endpoint.contains)) {
      failures.push(`${endpoint.name}: status=${response.status}, expected=${endpoint.contains}`);
    } else {
      console.log(`${endpoint.name}: OK (${durationMs}ms)`);
    }
  } catch (error) {
    failures.push(`${endpoint.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error('Monitoring smoke failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('Monitoring smoke OK.');
