import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = join(import.meta.dirname, '..');

test('setup deploys local agent-stack runtime assets', () => {
  const target = mkdtempSync(join(tmpdir(), 'agentstack-setup-'));

  try {
    const result = spawnSync(process.execPath, [
      join(repoRoot, '.agent-stack/install/setup-agent-stack.mjs'),
      '--tracker',
      'github',
      '--github-repository',
      'octo/widgets',
      '--target',
      target,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      readFileSync(join(target, '.agent-stack/.gitignore'), 'utf8'),
      '# AgentStack local runtime state\nlocal/\nruns/\n',
    );
    assert.deepEqual(
      JSON.parse(readFileSync(join(target, '.agent-stack/workspace.json'), 'utf8')),
      { baseBranch: null, worktreeRoot: null },
    );
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
