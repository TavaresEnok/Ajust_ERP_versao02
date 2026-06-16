import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredSecrets = [
  'DATABASE_URL',
  'POSTGRES_PASSWORD',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_RESET_SECRET',
  'SECRETS_ENCRYPTION_KEY',
  'MONITORING_WEBHOOK_TOKEN',
  'CHAT_WEBHOOK_TOKEN',
  'WORKER_API_TOKEN',
  'WEB_BASE_URL',
  'API_BASE_URL',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
];
const placeholderPattern = /change_me|your_|example|ajust123/i;
const errors = [];

for (const name of requiredSecrets) {
  const value = process.env[name] || '';
  if (!value) errors.push(`${name} is missing.`);
  else if (placeholderPattern.test(value)) errors.push(`${name} still contains a placeholder.`);
}

for (const name of [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_RESET_SECRET',
  'SECRETS_ENCRYPTION_KEY',
  'MONITORING_WEBHOOK_TOKEN',
  'CHAT_WEBHOOK_TOKEN',
  'WORKER_API_TOKEN',
]) {
  const value = process.env[name] || '';
  if (value && value.length < 32) errors.push(`${name} must have at least 32 characters.`);
}

for (const file of ['docker-compose.staging.yml', 'docker-compose.prod.yml']) {
  const result = spawnSync('docker', ['compose', '-f', file, 'config', '--quiet'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    errors.push(`${file} is invalid: ${(result.stderr || result.stdout).trim()}`);
  }
}

for (const file of ['scripts/db-backup.sh', 'scripts/db-rollback.sh', 'scripts/rollback.sh']) {
  if (!existsSync(file)) {
    errors.push(`${file} is missing.`);
    continue;
  }
  if ((statSync(file).mode & 0o111) === 0) errors.push(`${file} is not executable.`);
  const result = spawnSync('bash', ['-n', file], { encoding: 'utf8' });
  if (result.status !== 0) errors.push(`${file} has invalid shell syntax.`);
}

if (errors.length) {
  console.error('Release readiness failed:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('Release readiness OK: secrets, compose files and operational scripts validated.');
