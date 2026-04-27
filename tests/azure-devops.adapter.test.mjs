import test from 'node:test';
import assert from 'node:assert/strict';

import { AzureDevOpsTrackerAdapter } from '../dist/azure-devops.js';
import { MockCommandRunner } from '../dist/testing.js';

test('AzureDevOpsTrackerAdapter.getWorkItem parses tags, relation types, and embedded claim comment', async () => {
  const runner = new MockCommandRunner();

  runner.whenJson(
    'az',
    (args) => args[0] === 'boards' && args[1] === 'work-item' && args[2] === 'show' && args.includes('42'),
    {
      id: 42,
      url: 'https://dev.azure.com/example/Protocol/_workitems/edit/42',
      fields: {
        'System.Title': 'Implement tracker abstraction',
        'System.Description':
          '<p>Normalize GitHub and Azure DevOps trackers.</p><!-- agentstack-protocol:claim {"agentId":"azdo-agent","claimToken":"clm_az_001","claimedAt":"2026-04-23T12:00:00.000Z"} -->',
        'System.Tags':
          'execution:agent; ready-for-agent; protocol:ready; assigned-agent:azdo-agent; priority:1; area:tracker',
        'System.AssignedTo': { displayName: 'Alice Dev' },
        'System.State': 'Active',
      },
    },
    { name: 'work item show' },
  );

  runner.whenJson(
    'az',
    (args) => args[0] === 'boards' && args[1] === 'work-item' && args[2] === 'relation' && args[3] === 'show' && args.includes('42'),
    {
      id: 42,
      relations: [
        {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: 'https://dev.azure.com/example/_apis/wit/workItems/40',
          attributes: { name: 'Parent' },
        },
        {
          rel: 'System.LinkTypes.Dependency-Reverse',
          url: 'https://dev.azure.com/example/_apis/wit/workItems/10',
          attributes: { name: 'Dependency-Reverse' },
        },
      ],
    },
    { name: 'work item relation show' },
  );

  runner.whenJson(
    'az',
    (args) => args[0] === 'boards' && args[1] === 'work-item' && args[2] === 'relation' && args[3] === 'list-type',
    [
      { name: 'Parent' },
      { name: 'Child' },
      { name: 'Related' },
      { name: 'Dependency-Reverse' },
      { name: 'Dependency-Forward' },
    ],
    { name: 'relation type discovery' },
  );

  const adapter = new AzureDevOpsTrackerAdapter({
    organizationUrl: 'https://dev.azure.com/example',
    project: 'Protocol',
    runner,
    relationTypes: {
      child: 'System.LinkTypes.Hierarchy-Forward',
    },
  });

  const item = await adapter.getWorkItem({
    platform: 'azure-devops',
    project: 'Protocol',
    container: 'https://dev.azure.com/example',
    id: '42',
  });

  assert.equal(item.title, 'Implement tracker abstraction');
  assert.equal(item.executionMode, 'agent');
  assert.equal(item.readyForAgent, true);
  assert.equal(item.protocolState, 'ready');
  assert.equal(item.assignedAgent, 'azdo-agent');
  assert.equal(item.assignedHuman, 'Alice Dev');
  assert.equal(item.priority, 1);
  assert.equal(item.claim?.claimToken, 'clm_az_001');
  assert.deepEqual(
    item.relations.map((relation) => [relation.type, relation.target.id]),
    [
      ['parent', '40'],
      ['blocked-by', '10'],
    ],
  );

  runner.assertSatisfied();
});

test('AzureDevOpsTrackerAdapter.createChild creates the item and links it as a child', async () => {
  const runner = new MockCommandRunner();

  runner.whenJson(
    'az',
    (args) => args[0] === 'boards' && args[1] === 'work-item' && args[2] === 'create',
    {
      id: 84,
      url: 'https://dev.azure.com/example/Protocol/_workitems/edit/84',
    },
    { name: 'create child work item' },
  );

  runner.whenJson(
    'az',
    (args) => args[0] === 'boards' && args[1] === 'work-item' && args[2] === 'relation' && args[3] === 'list-type',
    [{ name: 'Child' }],
    { name: 'relation type discovery' },
  );

  runner.whenText(
    'az',
    (args) =>
      args[0] === 'boards' &&
      args[1] === 'work-item' &&
      args[2] === 'relation' &&
      args[3] === 'add' &&
      args.includes('--relation-type') &&
      args.includes('Child') &&
      args.includes('--target-id') &&
      args.includes('84'),
    '{}',
    { name: 'link child relation' },
  );

  const adapter = new AzureDevOpsTrackerAdapter({
    organizationUrl: 'https://dev.azure.com/example',
    project: 'Protocol',
    runner,
  });

  const child = await adapter.createChild(
    {
      platform: 'azure-devops',
      project: 'Protocol',
      container: 'https://dev.azure.com/example',
      id: '42',
    },
    {
      title: 'Add claim reconciliation tests',
      description: 'Cover resume and revoke scenarios.',
      executionMode: 'agent',
      readyForAgent: true,
      protocolState: 'ready',
      assignedAgent: 'agent-7',
      priority: 2,
      tags: ['area:tests'],
      kind: 'task',
    },
  );

  assert.equal(child.id, '84');
  assert.equal(child.platform, 'azure-devops');

  const createCall = runner.calls.find(
    (call) => call.command === 'az' && call.args[0] === 'boards' && call.args[1] === 'work-item' && call.args[2] === 'create',
  );

  assert.ok(createCall, 'expected create call to be recorded');
  const fields = createCall.args
    .map((arg, index, all) => (arg === '--fields' ? all[index + 1] : null))
    .filter((value) => typeof value === 'string');

  assert.ok(fields.includes('System.Tags=area:tests; execution:agent; ready-for-agent; protocol:ready; assigned-agent:agent-7; priority:2'));
  assert.ok(createCall.args.includes('--type'));
  assert.ok(createCall.args.includes('Task'));

  const relationCall = runner.calls.find(
    (call) => call.command === 'az' && call.args[0] === 'boards' && call.args[1] === 'work-item' && call.args[2] === 'relation' && call.args[3] === 'add',
  );
  assert.ok(relationCall, 'expected relation add call to be recorded');
  assert.ok(relationCall.args.includes('Child'));

  runner.assertSatisfied();
});

test('AzureDevOpsTrackerAdapter.queryEligibleWork accepts array query output', async () => {
  const runner = new MockCommandRunner();

  runner.whenJson(
    'az',
    (args) => args[0] === 'boards' && args[1] === 'query',
    [
      {
        id: 5732,
        url: 'https://sidsrl.visualstudio.com/_apis/wit/workItems/5732',
      },
    ],
    { name: 'query eligible work array response' },
  );

  const adapter = new AzureDevOpsTrackerAdapter({
    organizationUrl: 'https://dev.azure.com/sidsrl',
    project: 'agentstack-azdo-smoke',
    runner,
    tags: {
      executionAgentTag: 'exec:agent',
      readyForAgentTag: 'ready:agent',
      protocolStatePrefix: 'state:',
    },
  });

  const refs = await adapter.queryEligibleWork();

  assert.deepEqual(refs, [
    {
      platform: 'azure-devops',
      project: 'agentstack-azdo-smoke',
      container: 'https://dev.azure.com/sidsrl',
      id: '5732',
      url: 'https://sidsrl.visualstudio.com/_apis/wit/workItems/5732',
    },
  ]);

  runner.assertSatisfied();
});
