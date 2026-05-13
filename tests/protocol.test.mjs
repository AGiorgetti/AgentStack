import test from 'node:test';
import assert from 'node:assert/strict';

import { assertActiveClaimToken } from '../dist/protocol.js';

function createWorkItem(claimToken) {
  return {
    ref: {
      platform: 'github',
      project: 'octo',
      container: 'widgets',
      id: '101',
    },
    title: 'Claim race prevention',
    description: '',
    acceptanceCriteria: ['Claims are verified'],
    executionMode: 'agent',
    readyForAgent: true,
    protocolState: 'claimed',
    ...(claimToken
      ? {
          claim: {
            agentId: 'codex-01',
            claimToken,
            claimedAt: '2026-04-23T13:00:00.000Z',
          },
        }
      : {}),
    tags: [],
    relations: [],
  };
}

test('assertActiveClaimToken accepts the active tracker token', () => {
  assert.doesNotThrow(() => assertActiveClaimToken(createWorkItem('clm_current'), 'clm_current', 'claim'));
});

test('assertActiveClaimToken rejects missing active tracker token', () => {
  assert.throws(
    () => assertActiveClaimToken(createWorkItem(undefined), 'clm_current', 'claim'),
    /Cannot claim work item 101: no active claim token found in tracker/,
  );
});

test('assertActiveClaimToken rejects another active tracker token', () => {
  assert.throws(
    () => assertActiveClaimToken(createWorkItem('clm_other'), 'clm_current', 'release'),
    /Cannot release work item 101: active claim belongs to another token/,
  );
});
