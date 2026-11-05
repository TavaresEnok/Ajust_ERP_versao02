const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
for (const fail of [false, true]) {
  test(`backup ${fail ? 'removes incomplete dump on failure' : 'writes owner-only dump'}`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ajust-backup-test-'));
    try {
      fs.writeFileSync(
        path.join(root, 'docker'),
        `#!/bin/sh\nprintf 'fake-dump'\nexit ${fail ? 1 : 0}\n`,
        { mode: 0o700 },
      );
      const backup = path.join(root, 'backups');
      const result = spawnSync('bash', ['scripts/db-backup.sh'], {
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH}`,
          BACKUP_DIR: backup,
          POSTGRES_DB: 'test_only',
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, fail ? 1 : 0, result.stderr);
      assert.equal(fs.statSync(backup).mode & 0o777, 0o700);
      const files = fs.readdirSync(backup);
      assert.equal(files.length, fail ? 0 : 1);
      if (!fail) assert.equal(fs.statSync(path.join(backup, files[0])).mode & 0o777, 0o600);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
