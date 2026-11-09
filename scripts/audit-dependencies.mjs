import { spawnSync } from 'node:child_process';

// pnpm 9 may exit nonzero for low findings even with --audit-level=moderate.
// Enforce the threshold explicitly while keeping every advisory visible.
const result = spawnSync('corepack', ['pnpm', 'audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('Dependency audit did not return a valid report.');
  process.exit(1);
}
const counts = report.metadata?.vulnerabilities;
if (report.error || !counts || result.error) {
  console.error('Dependency audit unavailable; validation cannot continue.');
  process.exit(1);
}
console.log(
  `Dependency audit: ${counts.critical} critical, ${counts.high} high, ${counts.moderate} moderate, ${counts.low} low.`,
);
for (const advisory of Object.values(report.advisories || {})) {
  console.log(`${advisory.severity}: ${advisory.module_name} — ${advisory.url}`);
}
if (counts.critical || counts.high || counts.moderate) process.exit(1);
if (result.status !== 0 && !Object.values(counts).some((count) => count > 0)) process.exit(1);
