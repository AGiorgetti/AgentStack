#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const supportedTrackers = new Set(['github', 'azure-devops']);
const supportedAgents = new Set(['generic', 'claude', 'copilot', 'gemini']);
const managedStart = '<!-- agentstack-protocol:start -->';
const managedEnd = '<!-- agentstack-protocol:end -->';
const isWindows = process.platform === 'win32';

function usage() {
  console.log(`Usage:
  agentstack setup --tracker github --github-repository OWNER/REPO [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]
  agentstack setup --tracker azure-devops --azdo-organization <url> --azdo-project <project> [--azdo-team <team>] [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]

Examples:
  agentstack setup --tracker github --github-repository octo/widgets --provision-tracker
  agentstack setup --tracker azure-devops --azdo-organization https://dev.azure.com/acme --azdo-project Widgets --agents generic,copilot --provision-tracker
`);
}

function parseArgs(argv) {
  const args = { agents: ['generic'], overwrite: false, provisionTracker: false, target: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--overwrite') {
      args.overwrite = true;
      continue;
    }
    if (arg === '--provision-tracker') {
      args.provisionTracker = true;
      continue;
    }
    const readValue = () => {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case '--target':
      case '--repo':
        args.target = readValue();
        break;
      case '--tracker':
        args.tracker = readValue();
        break;
      case '--agents':
        args.agents = readValue().split(',').map((x) => x.trim()).filter(Boolean);
        break;
      case '--github-repository':
        args.githubRepository = readValue();
        break;
      case '--github-owner':
        args.githubOwner = readValue();
        break;
      case '--github-repo':
      case '--github-name':
        args.githubRepo = readValue();
        break;
      case '--azdo-organization':
      case '--azure-devops-organization':
        args.azdoOrganization = readValue();
        break;
      case '--azdo-project':
      case '--azure-devops-project':
        args.azdoProject = readValue();
        break;
      case '--azdo-team':
      case '--azure-devops-team':
        args.azdoTeam = readValue();
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.tracker) throw new Error('Missing --tracker');
  if (!supportedTrackers.has(args.tracker)) throw new Error(`Unsupported tracker: ${args.tracker}`);
  if (!args.agents.includes('generic')) args.agents.unshift('generic');
  for (const agent of args.agents) {
    if (!supportedAgents.has(agent)) throw new Error(`Unsupported agent target: ${agent}`);
  }
  return args;
}

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '../..');
const sourceStack = join(packageRoot, '.agent-stack');
const sourceSkills = join(packageRoot, '.agents', 'skills');
const args = parseArgs(process.argv.slice(2));
const targetRoot = resolve(args.target);
const targetStack = join(targetRoot, '.agent-stack');
const targetSkills = join(targetRoot, '.agents', 'skills');

function copyFileOrDir(src, dest) {
  if (!existsSync(src)) throw new Error(`Missing source asset: ${src}`);
  if (existsSync(dest)) {
    if (!args.overwrite) throw new Error(`Refusing to overwrite existing path without --overwrite: ${dest}`);
    rmSync(dest, { recursive: true, force: true });
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

function write(dest, content) {
  if (existsSync(dest) && !args.overwrite) throw new Error(`Refusing to overwrite existing path without --overwrite: ${dest}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content, 'utf8');
}

function writeJson(dest, value) {
  write(dest, JSON.stringify(value, null, 2) + '\n');
}

function mergeAgentsMd(dest, managedBlock) {
  const block = `${managedStart}\n${managedBlock.trim()}\n${managedEnd}`;
  if (!existsSync(dest)) {
    writeFileSync(dest, `# Repository Agent Instructions\n\n${block}\n`, 'utf8');
    return;
  }
  const existing = readFileSync(dest, 'utf8');
  const start = existing.indexOf(managedStart);
  const end = existing.indexOf(managedEnd);
  if (start >= 0 && end > start) {
    const before = existing.slice(0, start).trimEnd();
    const after = existing.slice(end + managedEnd.length).trimStart();
    writeFileSync(dest, `${before}\n\n${block}\n${after ? `\n${after}` : ''}`, 'utf8');
    return;
  }
  writeFileSync(dest, `${existing.trimEnd()}\n\n${block}\n`, 'utf8');
}

function parseGitHubRepository(value) {
  const match = String(value ?? '').trim().match(/^([^\s/]+)\/([^\s/]+)$/);
  if (!match) return undefined;
  return { owner: match[1], repo: match[2] };
}

function inferGitHubRepositoryFromOrigin(repoRoot) {
  const invocation = resolveInvocation('git', ['-C', repoRoot, 'remote', 'get-url', 'origin']);
  const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8' });
  if (result.status !== 0) return undefined;
  const remote = result.stdout.trim();
  const match = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (!match) return undefined;
  return { owner: match[1], repo: match[2] };
}

function buildGitHubConfig() {
  const explicit = args.githubRepository ? parseGitHubRepository(args.githubRepository) : undefined;
  const split = args.githubOwner && args.githubRepo ? { owner: args.githubOwner, repo: args.githubRepo } : undefined;
  const inferred = inferGitHubRepositoryFromOrigin(targetRoot);
  const selected = explicit ?? split ?? inferred;
  if (!selected) {
    throw new Error('GitHub setup requires --github-repository OWNER/REPO, or --github-owner OWNER --github-repo REPO. Could not infer GitHub repository from git origin.');
  }
  return {
    platform: 'github',
    owner: selected.owner,
    repo: selected.repo,
    labels: {
      executionAgentLabel: 'exec:agent',
      executionHumanLabel: 'exec:human',
      readyForAgentLabel: 'ready:agent',
      claimActiveLabel: 'claim:active',
      protocolStatePrefix: 'state:',
      assignedAgentPrefix: 'agent:',
      priorityPrefix: 'priority:p'
    }
  };
}

function buildAzureDevOpsConfig() {
  if (!args.azdoOrganization) {
    throw new Error('Azure DevOps setup requires --azdo-organization https://dev.azure.com/ORG.');
  }
  if (!args.azdoProject) {
    throw new Error('Azure DevOps setup requires --azdo-project PROJECT.');
  }
  return {
    platform: 'azure-devops',
    organizationUrl: args.azdoOrganization,
    project: args.azdoProject,
    ...(args.azdoTeam ? { team: args.azdoTeam } : {}),
    tags: {
      executionAgentTag: 'exec:agent',
      executionHumanTag: 'exec:human',
      readyForAgentTag: 'ready:agent',
      claimActiveTag: 'claim:active',
      protocolStatePrefix: 'state:',
      assignedAgentPrefix: 'agent:',
      priorityPrefix: 'priority:p'
    },
    relationTypes: {
      parent: 'System.LinkTypes.Hierarchy-Reverse',
      child: 'System.LinkTypes.Hierarchy-Forward',
      blockedBy: 'System.LinkTypes.Dependency-Reverse',
      blocks: 'System.LinkTypes.Dependency-Forward',
      related: 'System.LinkTypes.Related'
    },
    workItemTypeByKind: {
      epic: 'Epic',
      feature: 'Feature',
      story: 'User Story',
      task: 'Task',
      bug: 'Bug',
      spike: 'Task'
    },
    defaultWorkItemType: 'Task'
  };
}

function buildTrackerConfig() {
  return args.tracker === 'github' ? buildGitHubConfig() : buildAzureDevOpsConfig();
}

function githubProtocolLabels(config) {
  const labels = config.labels;
  return [
    { name: labels.executionAgentLabel, color: '0e8a16', description: 'AgentStack execution mode: agent' },
    { name: labels.executionHumanLabel, color: '5319e7', description: 'AgentStack execution mode: human' },
    { name: labels.readyForAgentLabel, color: '1d76db', description: 'AgentStack readiness: ready for agent' },
    { name: labels.claimActiveLabel, color: 'fbca04', description: 'AgentStack active claim marker' },
    ...['epic', 'feature', 'story', 'task', 'bug', 'spike'].map((kind) => ({
      name: `type:${kind}`,
      color: 'cfd3d7',
      description: `AgentStack work item type: ${kind}`
    })),
    ...['draft', 'ready', 'claimed', 'implementing', 'blocked', 'pr-open', 'in-review', 'done', 'abandoned'].map((state) => ({
      name: `${labels.protocolStatePrefix}${state}`,
      color: state === 'blocked' ? 'd73a4a' : state === 'done' ? '0e8a16' : '1d76db',
      description: `AgentStack protocol state: ${state}`
    })),
    ...['0', '1', '2', '3'].map((priority) => ({
      name: `${labels.priorityPrefix}${priority}`,
      color: priority === '0' ? 'b60205' : priority === '1' ? 'd93f0b' : priority === '2' ? 'fbca04' : 'cfd3d7',
      description: `AgentStack priority P${priority}`
    }))
  ];
}

function runRequired(command, commandArgs, help) {
  const invocation = resolveInvocation(command, commandArgs);
  const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8' });
  if (result.error) {
    throw new Error(`${help}\nCommand failed: ${command} ${commandArgs.join(' ')}\n${result.error.message}`.trim());
  }
  if (result.status !== 0) {
    throw new Error(`${help}\nCommand failed: ${command} ${commandArgs.join(' ')}\n${result.stderr || result.stdout || ''}`.trim());
  }
  return result;
}

function runOptional(command, commandArgs) {
  const invocation = resolveInvocation(command, commandArgs);
  return spawnSync(invocation.command, invocation.args, { encoding: 'utf8' });
}

function resolveInvocation(command, args) {
  if (isWindows && command === 'az') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'az', ...args] };
  }
  return { command: resolveCommand(command), args };
}

function resolveCommand(command) {
  if (!isWindows) return command;
  if (command === 'gh') return 'gh.exe';
  if (command === 'git') return 'git.exe';
  return command;
}

function createOrUpdateGitHubLabel(repository, label) {
  const create = runOptional('gh', [
    'label',
    'create',
    label.name,
    '--repo',
    repository,
    '--color',
    label.color,
    '--description',
    label.description
  ]);
  if (create.status === 0) return 'created';

  runRequired('gh', [
    'label',
    'edit',
    label.name,
    '--repo',
    repository,
    '--color',
    label.color,
    '--description',
    label.description
  ], `Could not create or update GitHub label "${label.name}". Verify gh is authenticated and has access to ${repository}.`);
  return 'updated';
}

function provisionGitHubTracker(config) {
  const repository = `${config.owner}/${config.repo}`;
  runRequired('gh', ['auth', 'status'], 'GitHub tracker provisioning requires an authenticated gh CLI.');
  runRequired('gh', ['repo', 'view', repository, '--json', 'nameWithOwner'], `GitHub repository is not accessible: ${repository}`);

  let created = 0;
  let updated = 0;
  for (const label of githubProtocolLabels(config)) {
    const result = createOrUpdateGitHubLabel(repository, label);
    if (result === 'created') created += 1;
    if (result === 'updated') updated += 1;
  }

  console.log(`GitHub tracker labels provisioned for ${repository}: ${created} created, ${updated} updated.`);
}

function provisionAzureDevOpsTracker(config) {
  runRequired('az', [
    'devops',
    'project',
    'show',
    '--organization',
    config.organizationUrl,
    '--project',
    config.project,
    '--output',
    'json'
  ], `Azure DevOps project is not accessible: ${config.organizationUrl} / ${config.project}. Verify the Azure CLI is installed, the azure-devops extension is installed, az is authenticated, and the account has access to the project.`);
  console.log(`Azure DevOps tracker project checked for ${config.organizationUrl} / ${config.project}.`);
  console.log('The default AgentStack Azure DevOps profile uses tags and built-in relation types, so there are no labels or fields to pre-create.');
}

function provisionTracker(config) {
  if (!args.provisionTracker) return;
  if (args.tracker === 'github') {
    provisionGitHubTracker(config);
    return;
  }
  provisionAzureDevOpsTracker(config);
}

function activeTrackerFile() {
  return {
    tracker: args.tracker,
    mapping: `.agent-stack/trackers/${args.tracker}.mapping.yaml`,
    config: `.agent-stack/trackers/${args.tracker}.config.json`
  };
}

mkdirSync(targetStack, { recursive: true });

for (const rel of ['README.md', 'protocol', 'language', 'policy']) {
  copyFileOrDir(join(sourceStack, rel), join(targetStack, rel));
}

copyFileOrDir(sourceSkills, targetSkills);

const legacyStackSkills = join(targetStack, 'skills');
if (existsSync(legacyStackSkills)) rmSync(legacyStackSkills, { recursive: true, force: true });

mkdirSync(join(targetStack, 'trackers'), { recursive: true });
const trackerConfig = buildTrackerConfig();
copyFileOrDir(join(sourceStack, 'trackers', `${args.tracker}.mapping.yaml`), join(targetStack, 'trackers', `${args.tracker}.mapping.yaml`));
writeJson(join(targetStack, 'trackers', `${args.tracker}.config.json`), trackerConfig);
writeJson(join(targetStack, 'active-tracker.json'), activeTrackerFile());

mergeAgentsMd(join(targetRoot, 'AGENTS.md'), `## AgentStack Protocol Instructions

This repository uses AgentStack Protocol.

Read in this order:

1. \`.agent-stack/README.md\`
2. \`.agent-stack/protocol/AGENT-PROTOCOL.md\`
3. \`.agent-stack/language/backlog-language.yaml\`
4. \`.agent-stack/policy/AGENT-POLICY.json\`
5. \`.agent-stack/active-tracker.json\`
6. the active tracker mapping/config in \`.agent-stack/trackers/\`
7. \`.agents/skills/agentstack-*/SKILL.md\`

Active tracker: \`${args.tracker}\`.

Use the \`agentstack\` CLI for tracker-backed work. Do not call tracker-native CLIs directly for normal protocol operations unless the AgentStack CLI cannot perform the required operation.

Do not process inactive tracker files. Skills live only under \`.agents/skills\` and every AgentStack skill starts with \`agentstack-\`.`);

const uses = new Set(args.agents);
if (uses.has('claude')) {
  write(join(targetRoot, 'CLAUDE.md'), `# Claude Instructions\n\n@AGENTS.md\n@.agent-stack/README.md\n@.agent-stack/protocol/AGENT-PROTOCOL.md\n@.agent-stack/language/backlog-language.yaml\n@.agent-stack/policy/AGENT-POLICY.json\n@.agents/skills/agentstack-orchestrator/SKILL.md\n\nActive tracker: ${args.tracker}. Read only its mapping/config in .agent-stack/trackers/.\n`);
}
if (uses.has('copilot')) {
  write(join(targetRoot, '.github', 'copilot-instructions.md'), `# Copilot Repository Instructions\n\nThis repository uses AgentStack Protocol. Read AGENTS.md before autonomous backlog work.\n\nUse the agentstack CLI for tracker-backed work. Use only AgentStack skills under .agents/skills/agentstack-*/SKILL.md.\n\nActive tracker: ${args.tracker}. Do not load inactive tracker mappings.\n`);
  write(join(targetRoot, '.github', 'instructions', 'agent-workflow.instructions.md'), `---\napplyTo: "**"\n---\n# AgentStack Protocol Workflow\n\nUse AGENTS.md, .agent-stack, and .agents/skills/agentstack-* as the source of truth. Active tracker: ${args.tracker}.\n`);
}
if (uses.has('gemini')) {
  write(join(targetRoot, 'GEMINI.md'), `# Gemini Instructions\n\nRead AGENTS.md first. Use .agent-stack for protocol assets and .agents/skills/agentstack-* for skills.\n\nActive tracker: ${args.tracker}.\n`);
}

provisionTracker(trackerConfig);

console.log(`AgentStack Protocol installed into ${targetRoot}`);
console.log(`Tracker profile: ${args.tracker}`);
console.log(`Agent shims: ${args.agents.join(', ')}`);
console.log('Configuration written without placeholders. If values are wrong, rerun setup with --overwrite and the correct tracker parameters.');
