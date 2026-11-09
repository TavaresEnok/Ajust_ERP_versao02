const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
// Resolve the exact patched dependency used by Jest, rather than another installed copy.
const jest = require.resolve('jest', { paths: [path.resolve('apps/api')] });
const core = require.resolve('@jest/core', { paths: [path.dirname(jest)] });
const config = require.resolve('jest-config', { paths: [path.dirname(core)] });
const merge = require(require.resolve('deepmerge', { paths: [path.dirname(config)] }));

test('deepmerge patch preserves the result prototype for malicious source and target keys', () => {
  const poison = () => JSON.parse('{"__proto__":{"polluted":true}}');
  for (const result of [
    merge(poison(), {}),
    merge(Object.create(null), poison()),
    merge({ nested: poison() }, {}).nested,
  ]) {
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.equal(result.polluted, undefined);
    assert.equal({}.polluted, undefined);
  }
  assert.deepEqual(
    merge({ config: { first: 1 }, array: [1] }, { config: { second: 2 }, array: [2] }),
    { config: { first: 1, second: 2 }, array: [1, 2] },
  );
});
