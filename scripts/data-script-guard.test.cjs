const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
function run(args = [], env = {}, fixture = false) {
  const guard = path.join(__dirname, 'data-script-guard.cjs');
  return spawnSync(
    process.execPath,
    [
      '-e',
      `require(${JSON.stringify(guard)}).assertDataScriptAllowed({fixture:${fixture}}); console.log('AUTHORIZED');`,
      '--',
      'script',
      ...args,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:private@localhost/ajust_ci',
        DATA_SCRIPT_BACKUP_VERIFIED: '',
        ALLOW_DATA_SCRIPT: '',
        ...env,
      },
    },
  );
}
test('default preflight never reaches script or exposes credentials', () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.ok(!result.stdout.includes('AUTHORIZED'));
  assert.ok(!result.stdout.includes('private'));
});
test('apply requires database confirmation and verified backup', () => {
  assert.notEqual(run(['--apply']).status, 0);
  assert.notEqual(
    run(['--apply', '--confirm-database=other'], { DATA_SCRIPT_BACKUP_VERIFIED: '1' }).status,
    0,
  );
  assert.equal(
    run(['--apply', '--confirm-database=ajust_ci'], { DATA_SCRIPT_BACKUP_VERIFIED: '1' }).status,
    0,
  );
});
test('production and fixtures remain gated', () => {
  const args = ['--apply', '--confirm-database=ajust_ci'];
  assert.notEqual(
    run(args, { NODE_ENV: 'production', DATA_SCRIPT_BACKUP_VERIFIED: '1' }).status,
    0,
  );
  assert.notEqual(
    run(
      args,
      { NODE_ENV: 'production', DATA_SCRIPT_BACKUP_VERIFIED: '1', ALLOW_DATA_SCRIPT: '1' },
      true,
    ).status,
    0,
  );
});

test('apply requires an explicit environment and does not expose a malformed connection URL', () => {
  const args = ['--apply', '--confirm-database=ajust_ci'];
  assert.notEqual(run(args, { NODE_ENV: undefined, DATA_SCRIPT_BACKUP_VERIFIED: '1' }).status, 0);
  const result = run(args, { DATABASE_URL: 'private-invalid-connection' });
  assert.notEqual(result.status, 0);
  assert.ok(!result.stderr.includes('private-invalid-connection'));
});
