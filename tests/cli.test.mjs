import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCommandInvocation } from '../dist/cli.js';
import { renderHelpJson, renderHelpText } from '../dist/help.js';

test('resolveCommandInvocation runs Azure CLI through cmd.exe on Windows', () => {
  assert.deepEqual(resolveCommandInvocation('az', ['boards', 'query'], 'win32'), {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', 'az', 'boards', 'query'],
  });
});

test('resolveCommandInvocation runs GitHub CLI executable on Windows', () => {
  assert.deepEqual(resolveCommandInvocation('gh', ['issue', 'view', '1'], 'win32'), {
    command: 'gh.exe',
    args: ['issue', 'view', '1'],
  });
});

test('resolveCommandInvocation leaves CLI commands unchanged on Linux and macOS', () => {
  assert.deepEqual(resolveCommandInvocation('az', ['boards', 'query'], 'linux'), {
    command: 'az',
    args: ['boards', 'query'],
  });
  assert.deepEqual(resolveCommandInvocation('gh', ['issue', 'view', '1'], 'darwin'), {
    command: 'gh',
    args: ['issue', 'view', '1'],
  });
});

test('renderHelpJson returns structured command metadata for work-item claim', () => {
  const help = renderHelpJson(['work-item', 'claim']);

  assert.deepEqual(help.commandPath, ['work-item', 'claim']);
  assert.equal(help.fullCommand, 'agentstack work-item claim');
  assert.equal(help.summary, 'Register an exclusive autonomous execution claim.');
  assert.ok(help.flags.some((flag) => flag.name === '--agent' && flag.required === true));
  assert.ok(help.policyEffects.some((entry) => entry.includes('requireAcceptanceCriteria')));
  assert.equal(help.output?.fields?.some((field) => field.name === 'claim.claimToken'), true);
});

test('renderHelpText returns structured human help for work-item submit-review', () => {
  const text = renderHelpText(['work-item', 'submit-review']);

  assert.match(text, /AgentStack Help: agentstack work-item submit-review/);
  assert.match(text, /Usage:/);
  assert.match(text, /--pr <url>/);
  assert.match(text, /review submission report/);
  assert.match(text, /Policy:/);
});
