import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = join(import.meta.dirname, '..');
const lifecycleScript = join(repoRoot, 'assets/install/setup-agent-stack.mjs');
const rulesStart = '<!-- as:rules -->';
const rulesEnd = '<!-- /as:rules -->';

function runLifecycle(args) {
  return spawnSync(process.execPath, [lifecycleScript, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

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

test('rules setup installs, refreshes, and moves the managed block to the top', () => {
  const target = mkdtempSync(join(tmpdir(), 'agentstack-rules-'));
  const agentsMd = join(target, 'AGENTS.md');

  try {
    writeFileSync(agentsMd, '# Existing\n', 'utf8');
    const setup = runLifecycle(['rules', '--target', target]);
    assert.equal(setup.status, 0, setup.stderr || setup.stdout);

    const template = readFileSync(join(repoRoot, 'assets/modules/rules/rules.md'), 'utf8').trim();
    const installed = readFileSync(agentsMd, 'utf8');
    assert.equal(installed.startsWith(`${rulesStart}\n${template}\n${rulesEnd}\n\n# Existing\n`), true);
    assert.deepEqual(
      Object.keys(JSON.parse(readFileSync(join(target, '.agent-stack/modules.json'), 'utf8')).modules),
      ['rules'],
    );
    assert.equal(existsSync(join(target, '.agent-stack/modules/rules')), false);

    writeFileSync(agentsMd, `# Before\n\n${rulesStart}\nstale\n${rulesEnd}\n\n# After\n`, 'utf8');
    const refresh = runLifecycle(['rules', '--target', target]);
    assert.equal(refresh.status, 0, refresh.stderr || refresh.stdout);
    assert.equal(
      readFileSync(agentsMd, 'utf8'),
      `${rulesStart}\n${template}\n${rulesEnd}\n\n# Before\n\n# After\n`,
    );
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test('rules setup preserves protocol block and rejects overwrite', () => {
  const target = mkdtempSync(join(tmpdir(), 'agentstack-rules-protocol-'));

  try {
    const protocol = runLifecycle([
      'protocol',
      '--tracker',
      'github',
      '--github-repository',
      'octo/widgets',
      '--target',
      target,
    ]);
    assert.equal(protocol.status, 0, protocol.stderr || protocol.stdout);

    const before = readFileSync(join(target, 'AGENTS.md'), 'utf8');
    const rules = runLifecycle(['rules', '--target', target]);
    assert.equal(rules.status, 0, rules.stderr || rules.stdout);
    const after = readFileSync(join(target, 'AGENTS.md'), 'utf8');
    assert.equal(after.startsWith(rulesStart), true);
    assert.equal(after.includes(before.trim()), true);

    const overwrite = runLifecycle(['rules', '--target', target, '--overwrite']);
    assert.notEqual(overwrite.status, 0);
    assert.match(overwrite.stderr, /--overwrite is not supported/);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test('rules setup and uninstall fail without mutation for malformed markers', () => {
  const malformed = [
    `${rulesStart}\ncontent\n`,
    `${rulesEnd}\ncontent\n${rulesStart}\n`,
    `${rulesStart}\none\n${rulesEnd}\n${rulesStart}\ntwo\n${rulesEnd}\n`,
  ];

  for (const content of malformed) {
    const target = mkdtempSync(join(tmpdir(), 'agentstack-rules-malformed-'));
    const agentsMd = join(target, 'AGENTS.md');
    try {
      writeFileSync(agentsMd, content, 'utf8');
      const setup = runLifecycle(['rules', '--target', target]);
      assert.notEqual(setup.status, 0);
      assert.equal(readFileSync(agentsMd, 'utf8'), content);
      assert.equal(existsSync(join(target, '.agent-stack')), false);

      const uninstall = runLifecycle(['uninstall', 'rules', '--target', target]);
      assert.notEqual(uninstall.status, 0);
      assert.equal(readFileSync(agentsMd, 'utf8'), content);
      assert.equal(existsSync(join(target, '.agent-stack')), false);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }
});

test('rules uninstall preserves unrelated content and keeps an empty AGENTS.md', () => {
  const target = mkdtempSync(join(tmpdir(), 'agentstack-rules-uninstall-'));
  const agentsMd = join(target, 'AGENTS.md');

  try {
    assert.equal(runLifecycle(['rules', '--target', target]).status, 0);
    assert.equal(runLifecycle(['uninstall', 'rules', '--target', target]).status, 0);
    assert.equal(existsSync(agentsMd), true);
    assert.equal(readFileSync(agentsMd, 'utf8'), '');
    assert.deepEqual(JSON.parse(readFileSync(join(target, '.agent-stack/modules.json'), 'utf8')), { modules: {} });

    writeFileSync(agentsMd, '# Existing\n', 'utf8');
    assert.equal(runLifecycle(['rules', '--target', target]).status, 0);
    assert.equal(runLifecycle(['uninstall', 'rules', '--target', target]).status, 0);
    assert.equal(readFileSync(agentsMd, 'utf8'), '# Existing\n');
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
