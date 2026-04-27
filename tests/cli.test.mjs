import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCommandInvocation } from '../dist/cli.js';

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
