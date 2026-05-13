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
      join(repoRoot, 'assets/install/setup-agent-stack.mjs'),
      'protocol',
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
      JSON.parse(readFileSync(join(target, '.agent-stack/modules/protocol/workspace.json'), 'utf8')),
      { baseBranch: null, worktreeRoot: null },
    );
    assert.match(
      readFileSync(join(target, '.agent-stack/modules/protocol/templates/markdown-style.md'), 'utf8'),
      /Avoid dense paragraphs/,
    );
    assert.deepEqual(
      Object.keys(JSON.parse(readFileSync(join(target, '.agent-stack/modules.json'), 'utf8')).modules),
      ['protocol'],
    );
    assert.match(
      readFileSync(join(target, 'AGENTS.md'), 'utf8'),
      /\.agent-stack\/modules\/protocol/,
    );
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test('uninstall removes protocol-owned assets and preserves runtime by default', () => {
  const target = mkdtempSync(join(tmpdir(), 'agentstack-uninstall-'));

  try {
    const setup = spawnSync(process.execPath, [
      join(repoRoot, 'assets/install/setup-agent-stack.mjs'),
      'protocol',
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
    assert.equal(setup.status, 0, setup.stderr || setup.stdout);

    const uninstall = spawnSync(process.execPath, [
      join(repoRoot, 'assets/install/setup-agent-stack.mjs'),
      'uninstall',
      'protocol',
      '--target',
      target,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(uninstall.status, 0, uninstall.stderr || uninstall.stdout);
    assert.deepEqual(
      JSON.parse(readFileSync(join(target, '.agent-stack/modules.json'), 'utf8')),
      { modules: {} },
    );
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
