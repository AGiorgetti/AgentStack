import test from 'node:test';
import assert from 'node:assert/strict';

import { GitHubTrackerAdapter } from '../dist/github.js';
import { MockCommandRunner } from '../dist/testing.js';

function createIssueNode({
  id,
  number,
  title,
  body = '',
  labels = [],
  assignees = [],
  parent = null,
  subIssues = [],
  blockedBy = [],
  blocking = [],
  state = 'OPEN',
}) {
  return {
    repository: {
      issue: {
        id,
        number,
        title,
        body,
        url: `https://github.com/octo/widgets/issues/${number}`,
        state,
        labels: { nodes: labels.map((name) => ({ name })) },
        assignees: { nodes: assignees.map((login) => ({ login })) },
        parent,
        subIssues: { nodes: subIssues },
        blockedBy: { nodes: blockedBy },
        blocking: { nodes: blocking },
      },
    },
  };
}

test('GitHubTrackerAdapter.getWorkItem parses labels, relations, and claim metadata', async () => {
  const runner = new MockCommandRunner();

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'graphql' && args.includes('number=101'),
    createIssueNode({
      id: 'ISSUE_101',
      number: 101,
      title: 'Implement scheduler guardrails',
      body: 'Ensure autonomous claims do not overlap.',
      labels: [
        'execution:agent',
        'ready-for-agent',
        'claim:active',
        'protocol:ready',
        'assigned-agent:codex-01',
        'priority:2',
        'area:orchestrator',
      ],
      assignees: ['alice'],
      parent: { number: 100, url: 'https://github.com/octo/widgets/issues/100' },
      subIssues: [{ number: 102, url: 'https://github.com/octo/widgets/issues/102', state: 'OPEN' }],
      blockedBy: [{ number: 90, url: 'https://github.com/octo/widgets/issues/90', state: 'OPEN' }],
      blocking: [{ number: 120, url: 'https://github.com/octo/widgets/issues/120', state: 'OPEN' }],
    }),
    { name: 'issue graph query' },
  );

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'repos/octo/widgets/issues/101/comments',
    [
      {
        body:
          '<!-- agentstack-protocol:claim {"agentId":"codex-01","claimToken":"clm_test_001","claimedAt":"2026-04-23T13:00:00.000Z","branchName":"agent/101-scheduler-guardrails"} -->\nAgent claim registered for autonomous execution.',
      },
    ],
    { name: 'issue comments query' },
  );

  const adapter = new GitHubTrackerAdapter({ owner: 'octo', repo: 'widgets', runner });
  const item = await adapter.getWorkItem({
    platform: 'github',
    project: 'octo',
    container: 'widgets',
    id: '101',
  });

  assert.equal(item.title, 'Implement scheduler guardrails');
  assert.equal(item.executionMode, 'agent');
  assert.equal(item.readyForAgent, true);
  assert.equal(item.protocolState, 'ready');
  assert.equal(item.assignedAgent, 'codex-01');
  assert.equal(item.assignedHuman, 'alice');
  assert.equal(item.priority, 2);
  assert.equal(item.claim?.claimToken, 'clm_test_001');
  assert.equal(item.claim?.branchName, 'agent/101-scheduler-guardrails');
  assert.deepEqual(
    item.relations.map((relation) => [relation.type, relation.target.id]),
    [
      ['parent', '100'],
      ['child', '102'],
      ['blocked-by', '90'],
      ['blocks', '120'],
    ],
  );

  runner.assertSatisfied();
});

test('GitHubTrackerAdapter.getWorkItem unwraps gh GraphQL data envelope', async () => {
  const runner = new MockCommandRunner();

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'graphql' && args.includes('number=101'),
    {
      data: createIssueNode({
        id: 'ISSUE_101',
        number: 101,
        title: 'Envelope issue',
        labels: ['execution:agent', 'ready-for-agent', 'protocol:ready'],
      }),
    },
    { name: 'issue graph query envelope' },
  );

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'repos/octo/widgets/issues/101/comments',
    [],
    { name: 'issue comments query' },
  );

  const adapter = new GitHubTrackerAdapter({ owner: 'octo', repo: 'widgets', runner });
  const item = await adapter.getWorkItem({
    platform: 'github',
    project: 'octo',
    container: 'widgets',
    id: '101',
  });

  assert.equal(item.title, 'Envelope issue');
  assert.equal(item.protocolState, 'ready');

  runner.assertSatisfied();
});

test('GitHubTrackerAdapter.getWorkItem unwraps gh GraphQL errors envelope', async () => {
  const runner = new MockCommandRunner();

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'graphql' && args.includes('number=1'),
    { data: null, errors: [{ message: 'Could not resolve to a Repository' }] },
    { name: 'graphql error envelope' },
  );

  const adapter = new GitHubTrackerAdapter({ owner: 'octo', repo: 'widgets', runner });

  await assert.rejects(
    () => adapter.getWorkItem({ platform: 'github', project: 'octo', container: 'widgets', id: '1' }),
    /GitHub GraphQL query failed for octo\/widgets#1: Could not resolve to a Repository/,
  );

  runner.assertSatisfied();
});

test('GitHubTrackerAdapter.getWorkItem ignores historical claim comment without active claim label', async () => {
  const runner = new MockCommandRunner();

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'graphql' && args.includes('number=101'),
    createIssueNode({
      id: 'ISSUE_101',
      number: 101,
      title: 'Released claim issue',
      labels: ['execution:agent', 'ready-for-agent', 'protocol:ready'],
    }),
    { name: 'issue graph query' },
  );

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'repos/octo/widgets/issues/101/comments',
    [
      {
        body:
          '<!-- agentstack-protocol:claim {"agentId":"codex-01","claimToken":"clm_test_001","claimedAt":"2026-04-23T13:00:00.000Z"} -->\nAgent claim registered for autonomous execution.',
      },
      { body: 'Agent claim released.' },
    ],
    { name: 'issue comments query' },
  );

  const adapter = new GitHubTrackerAdapter({ owner: 'octo', repo: 'widgets', runner });
  const item = await adapter.getWorkItem({
    platform: 'github',
    project: 'octo',
    container: 'widgets',
    id: '101',
  });

  assert.equal(item.claim, undefined);

  runner.assertSatisfied();
});

test('GitHubTrackerAdapter.linkDependency maps "blocks" to addBlockedBy with target as blocked issue', async () => {
  const runner = new MockCommandRunner();

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'graphql' && args.includes('number=101'),
    createIssueNode({ id: 'ISSUE_101', number: 101, title: 'Source issue' }),
    { name: 'source issue graph query' },
  );

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'graphql' && args.includes('number=202'),
    createIssueNode({ id: 'ISSUE_202', number: 202, title: 'Target issue' }),
    { name: 'target issue graph query' },
  );

  runner.whenJson(
    'gh',
    (args) =>
      args[0] === 'api' &&
      args[1] === 'graphql' &&
      args.some((arg) => arg.includes('mutation AddBlockedBy')) &&
      args.includes('issueId=ISSUE_202') &&
      args.includes('blockingIssueId=ISSUE_101'),
    { addBlockedBy: { issue: { id: 'ISSUE_202' } } },
    { name: 'add blocked-by mutation' },
  );

  const adapter = new GitHubTrackerAdapter({ owner: 'octo', repo: 'widgets', runner });

  await adapter.linkDependency(
    { platform: 'github', project: 'octo', container: 'widgets', id: '101' },
    { platform: 'github', project: 'octo', container: 'widgets', id: '202' },
    'blocks',
  );

  runner.assertSatisfied();
  assert.equal(runner.calls.filter((call) => call.command === 'gh').length, 3);
});

test('GitHubTrackerAdapter.getWorkItem reports inaccessible repository response', async () => {
  const runner = new MockCommandRunner();

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'graphql' && args.includes('number=1'),
    { repository: null },
    { name: 'missing repository graph query' },
  );

  const adapter = new GitHubTrackerAdapter({ owner: 'octo', repo: 'private-widgets', runner });

  await assert.rejects(
    () => adapter.getWorkItem({ platform: 'github', project: 'octo', container: 'private-widgets', id: '1' }),
    /GitHub repository not found or inaccessible: octo\/private-widgets/,
  );

  runner.assertSatisfied();
});

test('GitHubTrackerAdapter.getWorkItem falls back when relation fields are unavailable', async () => {
  const runner = new MockCommandRunner();

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'graphql' && args.includes('number=1'),
    { errors: [{ message: 'Field blockedBy does not exist on type Issue' }] },
    { name: 'graphql error response' },
  );

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'graphql' && args.includes('number=1'),
    createIssueNode({ id: 'ISSUE_1', number: 1, title: 'Fallback issue' }),
    { name: 'fallback issue graph query' },
  );

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'repos/octo/widgets/issues/1/comments',
    [],
    { name: 'fallback issue comments query' },
  );

  const adapter = new GitHubTrackerAdapter({ owner: 'octo', repo: 'widgets', runner });

  const item = await adapter.getWorkItem({ platform: 'github', project: 'octo', container: 'widgets', id: '1' });

  assert.equal(item.title, 'Fallback issue');
  assert.deepEqual(item.relations, []);

  runner.assertSatisfied();
});

test('GitHubTrackerAdapter.getWorkItem reports non-relation GraphQL errors', async () => {
  const runner = new MockCommandRunner();

  runner.whenJson(
    'gh',
    (args) => args[0] === 'api' && args[1] === 'graphql' && args.includes('number=1'),
    { errors: [{ message: 'Could not resolve to a Repository' }] },
    { name: 'graphql error response' },
  );

  const adapter = new GitHubTrackerAdapter({ owner: 'octo', repo: 'widgets', runner });

  await assert.rejects(
    () => adapter.getWorkItem({ platform: 'github', project: 'octo', container: 'widgets', id: '1' }),
    /GitHub GraphQL query failed for octo\/widgets#1: Could not resolve to a Repository/,
  );

  runner.assertSatisfied();
});
