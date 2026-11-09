const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ajust-deploy-'));
  const script = path.resolve('scripts/deploy-images.sh');
  try {
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.writeFileSync(
      path.join(root, 'scripts/db-backup.sh'),
      '#!/bin/sh\necho "backup $COMPOSE_FILE" >> "$TEST_LOG"\n',
      { mode: 0o700 },
    );
    fs.writeFileSync(
      path.join(root, 'docker'),
      `#!/bin/sh
echo "$*" >> "$TEST_LOG"
case "$*" in
  inspect*) echo 'sha256:${'a'.repeat(64)}' ;;
  *"ps -q"*) [ "$TEST_NO_CONTAINER" = 1 ] || echo "container" ;;
  *"up -d"*)
    case "$*" in *previous.json*) exit 0 ;; esac
    [ "$TEST_FAIL_ROLLOUT" != 1 ] ;;
esac
`,
      { mode: 0o700 },
    );
    const log = path.join(root, 'calls');
    const exec = (args = [], overrides = {}) =>
      spawnSync('bash', [script, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH}`,
          TEST_LOG: log,
          COMPOSE_FILE: 'docker-compose.prod.yml',
          DEPLOY_ID: 'test-1',
          ...overrides,
        },
      });
    run({ root, exec, calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '') });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('deployment pins all previous images and backs up the selected database before migration', () =>
  fixture(({ root, exec, calls }) => {
    const result = exec();
    assert.equal(result.status, 0, result.stderr);
    const previous = JSON.parse(
      fs.readFileSync(
        path.join(root, '.deploy/docker-compose.prod.yml.test-1.previous.json'),
        'utf8',
      ),
    );
    for (const service of ['api', 'worker', 'web']) {
      assert.match(previous.services[service].image, /^sha256:[a-f0-9]{64}$/);
      assert.equal(previous.services[service].pull_policy, 'never');
    }
    assert.ok(
      calls().indexOf('backup docker-compose.prod.yml') < calls().indexOf('migrate deploy'),
    );
    assert.match(calls(), /--wait --wait-timeout 180/);
  }));

test('failed rollout restores captured images by recreating containers and reports failure', () =>
  fixture(({ exec, calls }) => {
    const result = exec([], { TEST_FAIL_ROLLOUT: '1' });
    assert.equal(result.status, 1);
    assert.match(
      calls(),
      /-f \.deploy\/docker-compose\.prod\.yml\.test-1\.previous\.json up -d --no-deps --force-recreate/,
    );
    assert.doesNotMatch(calls(), /--no-recreate/);
  }));

test('deployment without previous running images stops before backup or migration', () =>
  fixture(({ exec, calls }) => {
    assert.equal(exec([], { TEST_NO_CONTAINER: '1' }).status, 1);
    assert.doesNotMatch(calls(), /backup|migrate deploy|pull api|up -d/);
  }));

test('rollback without this deployment snapshot cannot use an older deployment snapshot', () =>
  fixture(({ exec, calls }) => {
    assert.equal(exec(['rollback']).status, 1);
    assert.equal(calls(), '');
  }));
