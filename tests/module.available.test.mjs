import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

test('module available lists built-in modules via CLI', () => {
  const bin = resolve('dist', 'agentstack.js');
  const res = spawnSync(process.execPath, [bin, 'module', 'available', '--repo', '.'], { encoding: 'utf8' });
  assert.equal(res.status, 0, `exit code 0 expected, got ${res.status}; stderr: ${res.stderr}`);
  const out = res.stdout.trim();
  const parsed = JSON.parse(out);
  const avail = parsed.available || parsed;
  const ids = Array.isArray(avail) ? avail.map((i) => (typeof i === 'string' ? i : i.id)) : Object.keys(avail || {});
  assert.ok(ids.includes('protocol'));
  assert.ok(ids.includes('rules'));
});
