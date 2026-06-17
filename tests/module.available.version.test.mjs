import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('module available includes version for installed modules', () => {
  const bin = resolve('dist', 'agentstack.js');
  const target = mkdtempSync(join(tmpdir(), 'agentstack-test-'));

  // Install protocol into target
  const setup = spawnSync(process.execPath, [bin, 'setup', 'protocol', '--target', target, '--tracker', 'github', '--github-repository', 'owner/repo', '--overwrite'], { encoding: 'utf8' });
  assert.equal(setup.status, 0, `setup failed: ${setup.stderr}`);

  // Run module available against the target
  const res = spawnSync(process.execPath, [bin, 'module', 'available', '--repo', target], { encoding: 'utf8' });
  assert.equal(res.status, 0, `exit code 0 expected, got ${res.status}; stderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stdout.trim());
  const avail = parsed.available || parsed;
  const protocol = (avail || []).find((i) => (typeof i === 'string' ? i : i.id) === 'protocol');
  assert.ok(protocol, 'protocol should be present in available modules');
  const version = typeof protocol === 'string' ? undefined : protocol.version;
  // Compare to package.json version
  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  assert.equal(version, pkg.version, 'installed protocol version should match agentstack package version');
});
