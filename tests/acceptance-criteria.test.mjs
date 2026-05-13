import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAcceptanceCriteria } from '../dist/acceptance-criteria.js';
import { isEligibleForExecution } from '../dist/protocol.js';

test('parseAcceptanceCriteria parses markdown heading bullets and checkboxes', () => {
  assert.deepEqual(
    parseAcceptanceCriteria(`# Implement flow

## Acceptance Criteria
- Smoke claim works
- [ ] Smoke progress works
1. Smoke submit-review works

## Notes
Not a criterion`),
    ['Smoke claim works', 'Smoke progress works', 'Smoke submit-review works'],
  );
});

test('parseAcceptanceCriteria parses inline semicolon criteria', () => {
  assert.deepEqual(
    parseAcceptanceCriteria('Acceptance Criteria: Smoke claim works; Smoke progress works; Smoke submit-review works'),
    ['Smoke claim works', 'Smoke progress works', 'Smoke submit-review works'],
  );
});

test('parseAcceptanceCriteria parses Azure DevOps html descriptions', () => {
  assert.deepEqual(
    parseAcceptanceCriteria('<p>Implement flow.</p><h2>Acceptance Criteria</h2><ul><li>Claim works</li><li>Progress works</li></ul>'),
    ['Claim works', 'Progress works'],
  );
});

test('parsed acceptance criteria satisfy execution eligibility gate', () => {
  const acceptanceCriteria = parseAcceptanceCriteria('Acceptance Criteria: Claim works; Progress works');
  const result = isEligibleForExecution(
    {
      ref: { platform: 'github', project: 'octo', container: 'widgets', id: '1' },
      title: 'Ready item',
      description: 'Acceptance Criteria: Claim works; Progress works',
      executionMode: 'agent',
      readyForAgent: true,
      protocolState: 'ready',
      acceptanceCriteria,
      relations: [],
    },
    {
      activeClaimExists: false,
      blockedByOpen: [],
      requireAcceptanceCriteria: true,
    },
  );

  assert.deepEqual(result, { ok: true, reasons: [] });
});
