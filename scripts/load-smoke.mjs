import { performance } from 'node:perf_hooks';

const baseUrl = (process.env.LOAD_BASE_URL || 'http://127.0.0.1:8071').replace(/\/+$/, '');
const path = process.env.LOAD_PATH || '/monitoring/health';
const requests = Number(process.env.LOAD_REQUESTS || 200);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 20);
const maxErrorRate = Number(process.env.LOAD_MAX_ERROR_RATE || 0.01);
const maxP95Ms = Number(process.env.LOAD_MAX_P95_MS || 500);

if (![requests, concurrency, maxErrorRate, maxP95Ms].every(Number.isFinite)) {
  throw new Error('Invalid numeric load-test configuration.');
}
if (requests < 1 || concurrency < 1 || concurrency > requests) {
  throw new Error(
    'LOAD_REQUESTS and LOAD_CONCURRENCY must be positive and concurrency <= requests.',
  );
}

let cursor = 0;
const durations = [];
let errors = 0;

async function worker() {
  while (cursor < requests) {
    cursor += 1;
    const startedAt = performance.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { 'user-agent': 'ajust-load-smoke/1.0' },
      });
      if (!response.ok) errors += 1;
      await response.arrayBuffer();
    } catch {
      errors += 1;
    } finally {
      durations.push(performance.now() - startedAt);
    }
  }
}

const suiteStartedAt = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
const elapsedMs = performance.now() - suiteStartedAt;

durations.sort((a, b) => a - b);
const percentile = (value) =>
  durations[Math.min(durations.length - 1, Math.ceil(value * durations.length) - 1)];
const errorRate = errors / requests;
const p95 = percentile(0.95);
const throughput = requests / (elapsedMs / 1000);

console.log(
  JSON.stringify(
    {
      url: `${baseUrl}${path}`,
      requests,
      concurrency,
      errors,
      errorRate,
      p50Ms: Number(percentile(0.5).toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      maxMs: Number(durations.at(-1).toFixed(2)),
      throughputRps: Number(throughput.toFixed(2)),
    },
    null,
    2,
  ),
);

if (errorRate > maxErrorRate) {
  throw new Error(`Error rate ${errorRate} exceeded limit ${maxErrorRate}.`);
}
if (p95 > maxP95Ms) {
  throw new Error(`P95 ${p95.toFixed(2)}ms exceeded limit ${maxP95Ms}ms.`);
}
