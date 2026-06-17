import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

test('agentstack module available returns JSON list', () => {
  const bin = resolve('dist', 'agentstack.js');
  const res = spawnSync(process.execPath, [bin, 'module', 'available', '--repo', '.'], { encoding: 'utf8' });
  assert.equal(res.status, 0, `exit code 0 expected, got ${res.status}; stderr: ${res.stderr}`);
  const out = res.stdout.trim();
  // Expect JSON output with available array or object
  assert.ok(out.length > 0, 'Expected non-empty output');
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch (e) {
    throw new Error(`Output was not valid JSON: ${e.message}\nOutput:\n${out}`);
  }
  assert.ok(Array.isArray(parsed.available) || (parsed.available && typeof parsed.available === 'object'), 'Expected top-level `available` array or object');
});
