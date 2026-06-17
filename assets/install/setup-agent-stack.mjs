#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const supportedModules = new Set(['protocol', 'rules']);
const supportedTrackers = new Set(['github', 'azure-devops']);
const supportedAgents = new Set(['generic', 'claude', 'copilot', 'gemini']);
const protocolManagedStart = '<!-- agentstack-protocol:start -->';
const protocolManagedEnd = '<!-- agentstack-protocol:end -->';
const rulesManagedStart = '<!-- as:rules -->';
const rulesManagedEnd = '<!-- /as:rules -->';
const isWindows = process.platform === 'win32';
const skillMap = new Map([
  ['agentstack-backlog-language', 'agentstack-protocol-backlog-language'],
  ['agentstack-block', 'agentstack-protocol-block'],
  ['agentstack-orchestrator', 'agentstack-protocol-orchestrator'],
  ['agentstack-pr-complete', 'agentstack-protocol-pr-complete'],
  ['agentstack-pr-rework', 'agentstack-protocol-pr-rework'],
  ['agentstack-submit-review', 'agentstack-protocol-submit-review'],
  ['agentstack-tracker-claim', 'agentstack-protocol-tracker-claim'],
  ['agentstack-tracker-graph', 'agentstack-protocol-tracker-graph'],
  ['agentstack-tracker-intake', 'agentstack-protocol-tracker-intake'],
  ['agentstack-tracker-sync', 'agentstack-protocol-tracker-sync'],
  ['agentstack-work-bootstrap', 'agentstack-protocol-work-bootstrap'],
  ['agentstack-work-implement', 'agentstack-protocol-work-implement'],
  ['agentstack-work-plan', 'agentstack-protocol-work-plan'],
]);

function usage() {
  console.log(`Usage:
  agentstack setup protocol --tracker github --github-repository OWNER/REPO [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]
  agentstack setup protocol --tracker azure-devops --azdo-organization <url> --azdo-project <project> [--azdo-team <team>] [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]
  agentstack setup rules [--target <repo>]
  agentstack uninstall protocol [--target <repo>] [--purge-runtime]
  agentstack uninstall rules [--target <repo>]

Examples:
  agentstack setup protocol --tracker github --github-repository octo/widgets --provision-tracker
  agentstack setup rules --target /path/to/product-repo
  agentstack uninstall protocol --target /path/to/product-repo
  agentstack uninstall rules --target /path/to/product-repo
`);
}

function parseArgs(argv, action) {
  const selectedModule = argv[0];
  if (!selectedModule) throw new Error(`Missing module. Use: agentstack ${action} <module>`);
  if (!supportedModules.has(selectedModule)) throw new Error(`Unsupported module: ${selectedModule}`);

  const args = { module: selectedModule, agents: ['generic'], overwrite: false, provisionTracker: false, purgeRuntime: false, target: process.cwd() };
  for (let i = 1; i < argv.length; i += 1) {
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
    if (arg === '--purge-runtime') {
      args.purgeRuntime = true;
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
  if (args.module === 'rules') {
    if (args.overwrite) throw new Error('The rules module always refreshes its managed block; --overwrite is not supported.');
    const unsupported = argv.find((value) => value.startsWith('--') && !['--target', '--repo', '--help', '-h'].includes(value));
    if (unsupported) throw new Error(`Unknown argument for rules module: ${unsupported}`);
    if (action === 'uninstall') return args;
    return args;
  }
  if (action === 'uninstall') return args;
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
const sourceRoot = join(packageRoot, 'assets', 'root');
const sourceProtocolStack = join(packageRoot, 'assets', 'modules', 'protocol');
const sourceRules = join(packageRoot, 'assets', 'modules', 'rules', 'rules.md');
const sourceSkills = join(sourceProtocolStack, 'skills');
const rawArgs = process.argv.slice(2);
const action = rawArgs[0] === 'uninstall' ? 'uninstall' : 'setup';
const args = parseArgs(action === 'uninstall' ? rawArgs.slice(1) : rawArgs, action);
const targetRoot = resolve(args.target);
const targetStack = join(targetRoot, '.agent-stack');
const targetProtocolStack = join(targetStack, 'modules', 'protocol');
const targetSkills = join(targetRoot, '.agents', 'skills');
const targetStackGitignore = join(targetStack, '.gitignore');

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

function writeJsonForce(dest, value) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function readJson(dest, fallback) {
  return existsSync(dest) ? JSON.parse(readFileSync(dest, 'utf8')) : fallback;
}

function findManagedBlock(existing, startMarker, endMarker, strict = false) {
  const starts = existing.split(startMarker).length - 1;
  const ends = existing.split(endMarker).length - 1;
  if (starts === 0 && ends === 0) return undefined;
  const start = existing.indexOf(startMarker);
  const end = existing.indexOf(endMarker);
  if (starts !== 1 || ends !== 1 || end < start) {
    if (!strict) return start >= 0 && end > start ? { start, end: end + endMarker.length } : undefined;
    if (starts !== 1 || ends !== 1) throw new Error(`Malformed managed block: expected one ${startMarker} and one ${endMarker}.`);
    throw new Error(`Malformed managed block: ${endMarker} appears before ${startMarker}.`);
  }
  return { start, end: end + endMarker.length };
}

function mergeAgentsMd(dest, managedBlock, startMarker = protocolManagedStart, endMarker = protocolManagedEnd, position = 'end') {
  const block = `${startMarker}\n${managedBlock.trim()}\n${endMarker}`;
  if (!existsSync(dest)) {
    const content = position === 'start' ? `${block}\n` : `# Repository Agent Instructions\n\n${block}\n`;
    writeFileSync(dest, content, 'utf8');
    return;
  }
  const existing = readFileSync(dest, 'utf8');
  const range = findManagedBlock(existing, startMarker, endMarker, startMarker === rulesManagedStart);
  const before = range ? existing.slice(0, range.start).trimEnd() : '';
  const after = range ? existing.slice(range.end).trimStart() : existing;
  const withoutBlock = `${before}${before && after ? '\n\n' : ''}${after}`;
  const remaining = withoutBlock.trim();
  const content = position === 'start'
    ? `${block}${remaining ? `\n\n${remaining}` : ''}\n`
    : `${remaining}${remaining ? '\n\n' : ''}${block}\n`;
  writeFileSync(dest, content, 'utf8');
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
    mapping: `.agent-stack/modules/protocol/trackers/${args.tracker}.mapping.yaml`,
    config: `.agent-stack/modules/protocol/trackers/${args.tracker}.config.json`
  };
}

function modulesManifestPath() {
  return join(targetStack, 'modules.json');
}

function readPackageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return undefined;
  }
}

function writeInstalledModule(id, extra = {}) {
  const manifest = readJson(modulesManifestPath(), { modules: {} });
  manifest.modules ??= {};
  manifest.modules[id] = {
    installedAt: new Date().toISOString(),
    version: readPackageVersion() ?? '0.0.0',
    ...extra
  };
  writeJsonForce(modulesManifestPath(), manifest);
}

function removeInstalledModule(id) {
  const manifest = readJson(modulesManifestPath(), { modules: {} });
  if (manifest.modules) delete manifest.modules[id];
  writeJsonForce(modulesManifestPath(), manifest);
}

function removeAgentsMdBlock(dest, startMarker = protocolManagedStart, endMarker = protocolManagedEnd) {
  if (!existsSync(dest)) return;
  const existing = readFileSync(dest, 'utf8');
  const range = findManagedBlock(existing, startMarker, endMarker, startMarker === rulesManagedStart);
  if (!range) return;
  const before = existing.slice(0, range.start).trimEnd();
  const after = existing.slice(range.end).trimStart();
  const remaining = `${before}${before && after ? '\n\n' : ''}${after}`.trimEnd();
  writeFileSync(dest, remaining ? `${remaining}\n` : '', 'utf8');
}

function uninstallProtocol() {
  if (existsSync(targetProtocolStack)) rmSync(targetProtocolStack, { recursive: true, force: true });
  for (const name of skillMap.values()) {
    const skillPath = join(targetSkills, name);
    if (existsSync(skillPath)) rmSync(skillPath, { recursive: true, force: true });
  }
  removeAgentsMdBlock(join(targetRoot, 'AGENTS.md'));
  if (args.purgeRuntime) {
    rmSync(join(targetStack, 'local'), { recursive: true, force: true });
    rmSync(join(targetStack, 'runs'), { recursive: true, force: true });
  }
  removeInstalledModule('protocol');
  console.log(`AgentStack Protocol uninstalled from ${targetRoot}`);
}

function setupRules() {
  const rules = readFileSync(sourceRules, 'utf8');
  const agentsMd = join(targetRoot, 'AGENTS.md');
  mergeAgentsMd(agentsMd, rules, rulesManagedStart, rulesManagedEnd, 'start');
  writeInstalledModule('rules');
  console.log(`AgentStack Rules installed into ${targetRoot}`);
}

function uninstallRules() {
  const agentsMd = join(targetRoot, 'AGENTS.md');
  removeAgentsMdBlock(agentsMd, rulesManagedStart, rulesManagedEnd);
  removeInstalledModule('rules');
  console.log(`AgentStack Rules uninstalled from ${targetRoot}`);
}

if (action === 'uninstall') {
  if (args.module === 'rules') uninstallRules();
  else uninstallProtocol();
  process.exit(0);
}

if (args.module === 'rules') {
  setupRules();
  process.exit(0);
}

mkdirSync(targetStack, { recursive: true });

copyFileOrDir(join(sourceRoot, 'agent-stack.gitignore'), targetStackGitignore);

for (const rel of ['README.md', 'PROMPTS.md', 'workspace.json', 'templates', 'protocol', 'language', 'policy']) {
  copyFileOrDir(join(sourceProtocolStack, rel), join(targetProtocolStack, rel));
}

for (const targetName of skillMap.values()) {
  const targetSkill = join(targetSkills, targetName);
  copyFileOrDir(join(sourceSkills, targetName), targetSkill);
}
copyFileOrDir(join(sourceSkills, 'git-worktree-ops'), join(targetSkills, 'git-worktree-ops'));

const legacyStackSkills = join(targetStack, 'skills');
if (existsSync(legacyStackSkills)) rmSync(legacyStackSkills, { recursive: true, force: true });

mkdirSync(join(targetProtocolStack, 'trackers'), { recursive: true });
const trackerConfig = buildTrackerConfig();
copyFileOrDir(join(sourceProtocolStack, 'trackers', `${args.tracker}.mapping.yaml`), join(targetProtocolStack, 'trackers', `${args.tracker}.mapping.yaml`));
writeJson(join(targetProtocolStack, 'trackers', `${args.tracker}.config.json`), trackerConfig);
writeJson(join(targetProtocolStack, 'active-tracker.json'), activeTrackerFile());
writeInstalledModule('protocol', { activeTracker: args.tracker });

mergeAgentsMd(join(targetRoot, 'AGENTS.md'), `## AgentStack Protocol Instructions

This repository uses AgentStack Protocol.

Read in this order:

1. \`.agent-stack/modules/protocol/README.md\`
2. \`.agent-stack/modules/protocol/protocol/AGENT-PROTOCOL.md\`
3. \`.agent-stack/modules/protocol/language/backlog-language.yaml\`
4. \`.agent-stack/modules/protocol/policy/AGENT-POLICY.json\`
5. \`.agent-stack/modules/protocol/active-tracker.json\`
6. \`.agent-stack/modules/protocol/templates/markdown-style.md\`
7. the active tracker mapping/config in \`.agent-stack/modules/protocol/trackers/\`
8. \`.agents/skills/agentstack-protocol-*/SKILL.md\`
9. \`.agents/skills/git-worktree-ops/SKILL.md\`

Active tracker: \`${args.tracker}\`.

Use the \`agentstack\` CLI for tracker-backed work. Do not call tracker-native CLIs directly for normal protocol operations unless the AgentStack CLI cannot perform the required operation.

Do not process inactive tracker files. Write tracker comments, plans, blockers, review summaries, and child work item descriptions using the Markdown style template. Skills live only under \`.agents/skills\`. AgentStack protocol skills start with \`agentstack-protocol-\`; \`git-worktree-ops\` is the supporting skill for isolated git worktree operations.`);

const uses = new Set(args.agents);
if (uses.has('claude')) {
  write(join(targetRoot, 'CLAUDE.md'), `# Claude Instructions\n\n@AGENTS.md\n@.agent-stack/modules/protocol/README.md\n@.agent-stack/modules/protocol/protocol/AGENT-PROTOCOL.md\n@.agent-stack/modules/protocol/language/backlog-language.yaml\n@.agent-stack/modules/protocol/policy/AGENT-POLICY.json\n@.agents/skills/agentstack-protocol-orchestrator/SKILL.md\n\nActive tracker: ${args.tracker}. Read only its mapping/config in .agent-stack/modules/protocol/trackers/.\n`);
}
if (uses.has('copilot')) {
  write(join(targetRoot, '.github', 'copilot-instructions.md'), `# Copilot Repository Instructions\n\nThis repository uses AgentStack Protocol. Read AGENTS.md before autonomous backlog work.\n\nUse the agentstack CLI for tracker-backed work. Use AgentStack protocol skills under .agents/skills/agentstack-protocol-*/SKILL.md and git-worktree-ops for isolated worktree operations.\n\nActive tracker: ${args.tracker}. Do not load inactive tracker mappings.\n`);
  write(join(targetRoot, '.github', 'instructions', 'agent-workflow.instructions.md'), `---\napplyTo: "**"\n---\n# AgentStack Protocol Workflow\n\nUse AGENTS.md, .agent-stack/modules/protocol, .agents/skills/agentstack-protocol-*, and .agents/skills/git-worktree-ops as the source of truth. Active tracker: ${args.tracker}.\n`);
}
if (uses.has('gemini')) {
  write(join(targetRoot, 'GEMINI.md'), `# Gemini Instructions\n\nRead AGENTS.md first. Use .agent-stack/modules/protocol for protocol assets, .agents/skills/agentstack-protocol-* for protocol skills, and .agents/skills/git-worktree-ops for isolated worktree operations.\n\nActive tracker: ${args.tracker}.\n`);
}

provisionTracker(trackerConfig);

console.log(`AgentStack Protocol installed into ${targetRoot}`);
console.log(`Tracker profile: ${args.tracker}`);
console.log(`Agent shims: ${args.agents.join(', ')}`);
console.log('Configuration written without placeholders. If values are wrong, rerun setup with --overwrite and the correct tracker parameters.');
