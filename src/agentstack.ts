#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { AzureDevOpsTrackerAdapter, type AzureDevOpsTrackerConfig } from './azure-devops.js';
import { GitHubTrackerAdapter, type GitHubTrackerConfig } from './github.js';
import { type ClaimInfo, type Platform, type ProtocolState, type WorkItem, type WorkItemKind, type WorkItemRef } from './model.js';
import { recommendedPolicy, type ExecutionPolicy } from './policy.js';
import { createClaimInfo, isEligibleForExecution } from './protocol.js';
import { canonicalProtocolStates, canonicalWorkItemTypes } from './language/canonical.js';
import { validateBacklogLanguageFile, validateTrackerMappingFile } from './language/validation.js';
import type { ProtocolEvent, ProtocolEventKind, ProtocolEventPayload } from './events.js';
import type { TrackerAdapter } from './tracker.js';

interface ActiveTrackerFile {
  tracker: 'github' | 'azure-devops' | string;
  mapping?: string;
  config?: string;
}

interface CliContext {
  repoRoot: string;
  activeTracker: ActiveTrackerFile;
  tracker: TrackerAdapter;
  policy: ExecutionPolicy;
  platform: Platform;
  config: Record<string, unknown>;
}

type ParsedArgs = {
  positionals: string[];
  flags: Record<string, string | boolean>;
};

const protocolStates = new Set<string>(canonicalProtocolStates);
const workItemKinds = new Set<string>(canonicalWorkItemTypes);

async function main(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv);
  const [command, subcommand, ...rest] = parsed.positionals;

  if (!command || command === 'help' || parsed.flags.help || parsed.flags.h) {
    printUsage();
    return;
  }

  if (command === 'setup') {
    runSetup(argv.slice(1));
    return;
  }

  if (command === 'doctor') {
    const context = await loadContext(parsed);
    await printJson(await runDoctor(context));
    return;
  }

  if (command === 'language' && subcommand === 'validate') {
    const repoRoot = getRepoRoot(parsed);
    printJson(validateBacklogLanguageFile(join(repoRoot, '.agent-stack', 'language', 'backlog-language.yaml')));
    return;
  }

  if (command === 'mapping' && subcommand === 'validate') {
    const context = await loadContext(parsed);
    const mappingFile = context.activeTracker.mapping ? resolveRepoPath(context.repoRoot, context.activeTracker.mapping) : join(context.repoRoot, '.agent-stack', 'trackers', `${context.activeTracker.tracker}.mapping.yaml`);
    printJson(validateTrackerMappingFile(mappingFile, context.activeTracker.tracker));
    return;
  }

  if (command !== 'work-item') {
    throw new Error(`Unknown command: ${command}`);
  }

  if (!subcommand) {
    throw new Error('Missing work-item subcommand.');
  }

  await handleWorkItemCommand(subcommand, rest, parsed);
}

async function handleWorkItemCommand(subcommand: string, rest: string[], parsed: ParsedArgs): Promise<void> {
  const context = await loadContext(parsed);

  switch (subcommand) {
    case 'get': {
      const id = requireArg(rest[0], 'work item id');
      const item = await context.tracker.getWorkItem(makeRef(context, id));
      await printJson({ item });
      return;
    }

    case 'intake': {
      const limit = parsePositiveInteger(getStringFlag(parsed, 'limit') ?? '10', '--limit');
      const assignedAgent = getStringFlag(parsed, 'agent');
      const refs = await context.tracker.queryEligibleWork(assignedAgent ? { assignedAgent } : undefined);
      await printJson({ items: refs.slice(0, limit) });
      return;
    }

    case 'graph': {
      const id = requireArg(rest[0], 'work item id');
      const ref = makeRef(context, id);
      const item = await context.tracker.getWorkItem(ref);
      const dependencies = await context.tracker.getDependencyStatus(ref);
      const eligibility = isEligibleForExecution(item, {
        blockedByOpen: dependencies.blockedByOpen,
        activeClaimExists: Boolean(item.claim),
        requireAcceptanceCriteria: context.policy.requireAcceptanceCriteria,
      });
      await printJson({
        root: item.ref,
        parent: item.relations.find((relation) => relation.type === 'parent')?.target ?? null,
        children: item.relations.filter((relation) => relation.type === 'child').map((relation) => relation.target),
        blockedBy: item.relations.filter((relation) => relation.type === 'blocked-by').map((relation) => relation.target),
        blocks: item.relations.filter((relation) => relation.type === 'blocks').map((relation) => relation.target),
        dependencyStatus: dependencies,
        canStart: eligibility.ok,
        reasons: eligibility.ok ? [] : eligibility.reasons,
      });
      return;
    }

    case 'claim': {
      const id = requireArg(rest[0], 'work item id');
      const agentId = requireFlag(parsed, 'agent');
      const ref = makeRef(context, id);
      const item = await context.tracker.getWorkItem(ref);
      const dependencies = await context.tracker.getDependencyStatus(ref);
      const eligibility = isEligibleForExecution(item, {
        blockedByOpen: dependencies.blockedByOpen,
        activeClaimExists: Boolean(item.claim),
        requireAcceptanceCriteria: context.policy.requireAcceptanceCriteria,
      });
      if (!eligibility.ok && !parsed.flags.force) {
        throw new Error(`Work item is not eligible for claim: ${eligibility.reasons.join('; ')}`);
      }

      const claimOptions: { branchName?: string; workspaceId?: string } = {};
      const branchName = getStringFlag(parsed, 'branch');
      const workspaceId = getStringFlag(parsed, 'workspace');
      if (branchName) claimOptions.branchName = branchName;
      if (workspaceId) claimOptions.workspaceId = workspaceId;
      const claim = createClaimInfo(agentId, claimOptions);
      await context.tracker.claim(ref, claim);
      appendRuntimeEvent(context.repoRoot, ref, 'claim', { agentId, claim });
      await printJson({ claimed: true, ref, claim });
      return;
    }

    case 'release': {
      const id = requireArg(rest[0], 'work item id');
      const claimToken = requireFlag(parsed, 'claim-token');
      const ref = makeRef(context, id);
      await context.tracker.releaseClaim(ref, claimToken);
      appendRuntimeEvent(context.repoRoot, ref, 'claim-release', { claimToken });
      await printJson({ released: true, ref, claimToken });
      return;
    }

    case 'state': {
      const id = requireArg(rest[0], 'work item id');
      const state = requireProtocolState(requireFlag(parsed, 'state'));
      const ref = makeRef(context, id);
      await context.tracker.setProtocolState(ref, state);
      appendRuntimeEvent(context.repoRoot, ref, 'state-change', { state });
      await printJson({ updated: true, ref, state });
      return;
    }

    case 'heartbeat': {
      const id = requireArg(rest[0], 'work item id');
      const message = readMessage(parsed, 'message', 'message-file');
      const ref = makeRef(context, id);
      const body = formatProtocolComment('heartbeat', message);
      await context.tracker.addComment(ref, body);
      appendRuntimeEvent(context.repoRoot, ref, 'heartbeat', { message });
      await printJson({ synced: true, ref, event: 'heartbeat' });
      return;
    }

    case 'block': {
      const id = requireArg(rest[0], 'work item id');
      const reason = readMessage(parsed, 'reason', 'reason-file');
      const ref = makeRef(context, id);
      await context.tracker.setProtocolState(ref, 'blocked');
      await context.tracker.addComment(ref, formatProtocolComment('blocker', reason));
      appendRuntimeEvent(context.repoRoot, ref, 'blocker', { reason, needsHumanDecision: true });
      await printJson({ blocked: true, ref, state: 'blocked', needsHumanDecision: true });
      return;
    }

    case 'plan': {
      const id = requireArg(rest[0], 'work item id');
      const plan = readMessage(parsed, 'message', 'file');
      const ref = makeRef(context, id);
      await context.tracker.addComment(ref, formatProtocolComment('execution-plan', plan));
      await context.tracker.setProtocolState(ref, 'implementing');
      appendRuntimeEvent(context.repoRoot, ref, 'execution-plan', { plan });
      await printJson({ logged: true, ref, state: 'implementing', event: 'execution-plan' });
      return;
    }

    case 'handoff': {
      const id = requireArg(rest[0], 'work item id');
      const prUrl = requireFlag(parsed, 'pr');
      const summary = getStringFlag(parsed, 'summary-file')
        ? readFileSync(resolve(context.repoRoot, getStringFlag(parsed, 'summary-file')!), 'utf8')
        : getStringFlag(parsed, 'summary') ?? `Pull request ready for human review: ${prUrl}`;
      const ref = makeRef(context, id);
      await context.tracker.attachPullRequest(ref, prUrl);
      await context.tracker.addComment(ref, formatProtocolComment('completion-report', summary));
      await context.tracker.setProtocolState(ref, 'pr-open');
      appendRuntimeEvent(context.repoRoot, ref, 'completion-report', { prUrl, summary });
      await printJson({ handoff: true, ref, state: 'pr-open', pr: prUrl, reviewRequired: context.policy.requireHumanReviewBeforeMerge });
      return;
    }

    case 'create-child': {
      const id = requireArg(rest[0], 'parent work item id');
      const title = requireFlag(parsed, 'title');
      const kind = getStringFlag(parsed, 'kind');
      if (kind && !workItemKinds.has(kind)) {
        throw new Error(`Unsupported work item kind: ${kind}`);
      }
      const ref = makeRef(context, id);
      const draft: Partial<WorkItem> = {
        title,
        description: getStringFlag(parsed, 'description') ?? '',
        executionMode: getStringFlag(parsed, 'execution-mode') === 'agent' ? 'agent' : 'human',
        readyForAgent: getStringFlag(parsed, 'ready-for-agent') === 'true',
        protocolState: (getStringFlag(parsed, 'state') as ProtocolState | undefined) ?? 'draft',
      };
      if (kind) draft.kind = kind as WorkItemKind;
      const child = await context.tracker.createChild(ref, draft);
      appendRuntimeEvent(context.repoRoot, ref, 'create-child', { child });
      await printJson({ created: true, parent: ref, child });
      return;
    }

    default:
      throw new Error(`Unknown work-item subcommand: ${subcommand}`);
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (!arg.startsWith('-')) {
      positionals.push(arg);
      continue;
    }

    const name = arg.replace(/^--?/, '');
    const next = argv[i + 1];
    if (!next || next.startsWith('-')) {
      flags[name] = true;
      continue;
    }
    flags[name] = next;
    i += 1;
  }

  return { positionals, flags };
}

async function loadContext(parsed: ParsedArgs): Promise<CliContext> {
  const repoRoot = getRepoRoot(parsed);
  const activeTracker = readJson<ActiveTrackerFile>(join(repoRoot, '.agent-stack', 'active-tracker.json'));
  const configFile = activeTracker.config
    ? resolveRepoPath(repoRoot, activeTracker.config)
    : join(repoRoot, '.agent-stack', 'trackers', `${activeTracker.tracker}.config.json`);
  const rawConfig = readJson<Record<string, unknown>>(configFile);
  const policy = existsSync(join(repoRoot, '.agent-stack', 'policy', 'AGENT-POLICY.json'))
    ? { ...recommendedPolicy, ...readJson<Partial<ExecutionPolicy>>(join(repoRoot, '.agent-stack', 'policy', 'AGENT-POLICY.json')) }
    : recommendedPolicy;

  if (activeTracker.tracker === 'github') {
    const config = normalizeGitHubConfig(rawConfig, configFile);
    return {
      repoRoot,
      activeTracker,
      config: config as unknown as Record<string, unknown>,
      policy,
      platform: 'github',
      tracker: new GitHubTrackerAdapter(config),
    };
  }

  if (activeTracker.tracker === 'azure-devops') {
    const config = normalizeAzureDevOpsConfig(rawConfig, configFile);
    return {
      repoRoot,
      activeTracker,
      config: config as unknown as Record<string, unknown>,
      policy,
      platform: 'azure-devops',
      tracker: new AzureDevOpsTrackerAdapter(config),
    };
  }

  throw new Error(`Unsupported active tracker: ${activeTracker.tracker}`);
}

function getRepoRoot(parsed: ParsedArgs): string {
  return resolve(String(parsed.flags.repo ?? parsed.flags.cwd ?? process.cwd()));
}

function makeRef(context: CliContext, rawId: string): WorkItemRef {
  const id = normalizeWorkItemId(rawId);

  if (context.platform === 'github') {
    const owner = String(context.config.owner ?? '');
    const repo = String(context.config.repo ?? '');
    return { platform: 'github', project: owner, container: repo, id };
  }

  if (context.platform === 'azure-devops') {
    const project = String(context.config.project ?? '');
    const organizationUrl = String(context.config.organizationUrl ?? '');
    return { platform: 'azure-devops', project, container: organizationUrl, id };
  }

  throw new Error(`Unsupported platform: ${context.platform}`);
}

function normalizeWorkItemId(rawId: string): string {
  const match = rawId.match(/(\d+)$/);
  if (!match?.[1]) {
    throw new Error(`Work item id must end with a numeric id. Received: ${rawId}`);
  }
  return match[1];
}

function readJson<T>(path: string): T {
  if (!existsSync(path)) {
    throw new Error(`Required file not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function resolveRepoPath(repoRoot: string, path: string): string {
  return path.startsWith('/') ? path : resolve(repoRoot, path);
}

function normalizeGitHubConfig(raw: Record<string, unknown>, configFile: string): GitHubTrackerConfig {
  const repository = typeof raw.repository === 'string' ? raw.repository.trim() : undefined;
  const repositoryParts = repository?.match(/^([^\s/]+)\/([^\s/]+)$/);
  const owner = typeof raw.owner === 'string' && raw.owner.trim() ? raw.owner.trim() : repositoryParts?.[1];
  const repo = typeof raw.repo === 'string' && raw.repo.trim() ? raw.repo.trim() : repositoryParts?.[2];

  if (!owner || !repo || isPlaceholder(owner) || isPlaceholder(repo)) {
    throw new Error(
      `GitHub tracker config is incomplete or still contains placeholders in ${configFile}. ` +
      'Run: agentstack setup --tracker github --github-repository OWNER/REPO --overwrite'
    );
  }

  const labels = typeof raw.labels === 'object' && raw.labels !== null ? raw.labels as GitHubTrackerConfig['labels'] : undefined;
  const config: GitHubTrackerConfig = { owner, repo };
  if (labels) config.labels = labels;
  return config;
}

function normalizeAzureDevOpsConfig(raw: Record<string, unknown>, configFile: string): AzureDevOpsTrackerConfig {
  const organizationUrl = firstString(raw.organizationUrl, raw.organization, raw.org);
  const project = firstString(raw.project);

  if (!organizationUrl || !project || isPlaceholder(organizationUrl) || isPlaceholder(project)) {
    throw new Error(
      `Azure DevOps tracker config is incomplete or still contains placeholders in ${configFile}. ` +
      'Run: agentstack setup --tracker azure-devops --azdo-organization https://dev.azure.com/ORG --azdo-project PROJECT --overwrite'
    );
  }

  const config: AzureDevOpsTrackerConfig = { organizationUrl, project };
  const fields = optionalObject<AzureDevOpsTrackerConfig['fields']>(raw.fields);
  const tags = optionalObject<AzureDevOpsTrackerConfig['tags']>(raw.tags);
  const relationTypes = optionalObject<AzureDevOpsTrackerConfig['relationTypes']>(raw.relationTypes);
  const workItemTypeByKind = optionalObject<AzureDevOpsTrackerConfig['workItemTypeByKind']>(raw.workItemTypeByKind);
  const defaultWorkItemType = firstString(raw.defaultWorkItemType);
  if (fields) config.fields = fields;
  if (tags) config.tags = tags;
  if (relationTypes) config.relationTypes = relationTypes;
  if (workItemTypeByKind) config.workItemTypeByKind = workItemTypeByKind;
  if (defaultWorkItemType) config.defaultWorkItemType = defaultWorkItemType;
  return config;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function optionalObject<T>(value: unknown): T | undefined {
  return typeof value === 'object' && value !== null ? value as T : undefined;
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'owner' ||
    normalized === 'repo' ||
    normalized === 'owner/repo' ||
    normalized === 'project' ||
    normalized === 'org' ||
    normalized === 'organization' ||
    normalized.includes('owner/repo') ||
    normalized.includes('owner') && normalized.includes('repo') ||
    normalized.includes('<') ||
    normalized.includes('>') ||
    normalized.includes('replace-me') ||
    normalized.includes('__');
}

function getStringFlag(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.flags[name];
  return typeof value === 'string' ? value : undefined;
}

function requireFlag(parsed: ParsedArgs, name: string): string {
  const value = getStringFlag(parsed, name);
  if (!value) {
    throw new Error(`Missing required --${name}`);
  }
  return value;
}

function requireArg(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function readMessage(parsed: ParsedArgs, inlineFlag: string, fileFlag: string): string {
  const inline = getStringFlag(parsed, inlineFlag);
  const file = getStringFlag(parsed, fileFlag);
  if (inline && file) {
    throw new Error(`Use either --${inlineFlag} or --${fileFlag}, not both.`);
  }
  if (inline) {
    return inline;
  }
  if (file) {
    return readFileSync(resolve(getRepoRoot(parsed), file), 'utf8');
  }
  throw new Error(`Missing --${inlineFlag} or --${fileFlag}.`);
}

function requireProtocolState(raw: string): ProtocolState {
  if (!protocolStates.has(raw)) {
    throw new Error(`Unsupported protocol state: ${raw}`);
  }
  return raw as ProtocolState;
}

function parsePositiveInteger(raw: string, flagName: string): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
  return value;
}

function formatProtocolComment(kind: string, body: string): string {
  return `<!-- agentstack-protocol:${kind} -->\n## AgentStack Protocol: ${kind}\n\n${body.trim()}\n`;
}

function appendRuntimeEvent<K extends ProtocolEventKind>(
  repoRoot: string,
  ref: WorkItemRef,
  kind: K,
  payload: ProtocolEventPayload<K>,
): void {
  const runDir = join(repoRoot, '.agent-stack', 'runs', ref.id);
  mkdirSync(runDir, { recursive: true });
  const event = {
    kind,
    workItem: ref,
    timestamp: new Date().toISOString(),
    ...payload,
  } as Extract<ProtocolEvent, { kind: K }>;
  appendFileSync(join(runDir, 'protocol-log.jsonl'), `${JSON.stringify(event)}\n`, 'utf8');
}

async function runDoctor(context: CliContext): Promise<Record<string, unknown>> {
  const languageValidation = validateBacklogLanguageFile(join(context.repoRoot, '.agent-stack', 'language', 'backlog-language.yaml'));
  const mappingValidation = validateTrackerMappingFile(
    context.activeTracker.mapping ? resolveRepoPath(context.repoRoot, context.activeTracker.mapping) : join(context.repoRoot, '.agent-stack', 'trackers', `${context.activeTracker.tracker}.mapping.yaml`),
    context.activeTracker.tracker,
  );
  return {
    ok: languageValidation.ok && mappingValidation.ok,
    repoRoot: context.repoRoot,
    activeTracker: context.activeTracker.tracker,
    files: {
      agentStack: existsSync(join(context.repoRoot, '.agent-stack')),
      agentsMd: existsSync(join(context.repoRoot, 'AGENTS.md')),
      skills: existsSync(join(context.repoRoot, '.agents', 'skills')),
    },
    language: languageValidation,
    mapping: mappingValidation,
  };
}

function runSetup(args: string[]): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const script = resolve(here, '../.agent-stack/install/setup-agent-stack.mjs');
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

async function printJson(value: unknown): Promise<void> {
  console.log(JSON.stringify(value, null, 2));
}

function printUsage(): void {
  console.log(`AgentStack Protocol CLI

AgentStack gives agents a canonical JSON interface over the active backlog tracker.
Run commands from a configured repository, or pass --repo <repo> to target one.

Usage:
  agentstack setup --tracker github --github-repository OWNER/REPO [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]
  agentstack setup --tracker azure-devops --azdo-organization <url> --azdo-project <project> [--azdo-team <team>] [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]
  agentstack doctor [--repo <repo>]
  agentstack language validate [--repo <repo>]
  agentstack mapping validate [--repo <repo>]

Work item commands:
  agentstack work-item get <id> [--repo <repo>]
  agentstack work-item intake [--limit 10] [--agent <agent-id>] [--repo <repo>]
  agentstack work-item graph <id> [--repo <repo>]
  agentstack work-item claim <id> --agent <agent-id> [--branch <name>] [--workspace <path>] [--force] [--repo <repo>]
  agentstack work-item release <id> --claim-token <token> [--repo <repo>]
  agentstack work-item state <id> --state <state> [--repo <repo>]
  agentstack work-item heartbeat <id> --message <text> [--repo <repo>]
  agentstack work-item block <id> --reason <text> [--repo <repo>]
  agentstack work-item plan <id> (--message <text>|--file <path>) [--repo <repo>]
  agentstack work-item handoff <id> --pr <url> [--summary <text>|--summary-file <path>] [--repo <repo>]
  agentstack work-item create-child <parent-id> --title <title> [--kind task] [--description <text>] [--execution-mode agent|human] [--ready-for-agent true|false] [--state <state>] [--repo <repo>]

Command details:
  setup
    Installs repository-local protocol assets, tracker mapping/config, AgentStack skills,
    and the managed AGENTS.md block. Deploys only the selected tracker profile.
    --provision-tracker creates/updates GitHub labels; for Azure DevOps it verifies
    CLI authentication and access to the configured project.

  doctor
    Verifies that .agent-stack exists, active tracker config is usable, and language and
    mapping files validate. Use before starting agent work or after setup changes.

  language validate
    Validates .agent-stack/language/backlog-language.yaml. Use after changing canonical
    backlog vocabulary or protocol language.

  mapping validate
    Validates the active .agent-stack/trackers/<tracker>.mapping.yaml. Use after changing
    tracker labels, tags, fields, states, relation mappings, or work item type mappings.

  work-item get
    Reads one tracker item and returns a canonical WorkItem with normalized protocol fields:
    executionMode, readyForAgent, protocolState, claim, tags, and relations.

  work-item intake
    Lists open items that appear ready for agent execution. --agent narrows results to
    items assigned to a specific agent identifier.

  work-item graph
    Returns parent, children, blocked-by, blocks, dependency status, and a canStart decision
    with policy reasons. Use this before claiming work.

  work-item claim
    Registers an active agent claim, sets protocol state claimed, writes claim metadata, and
    records a local claim event. --force bypasses eligibility checks for controlled exceptions.

  work-item release
    Removes the active claim marker and records a release comment. Historical claim comments
    remain for audit but are not reported as active once the active marker is gone.

  work-item state
    Sets a protocol state such as draft, ready, claimed, implementing, blocked, pr-open,
    in-review, done, or abandoned using the active tracker mapping.

  work-item heartbeat
    Adds a protocol-formatted progress comment and records a local heartbeat event.

  work-item block
    Sets state blocked, comments with the blocker reason, and records a local blocker event.

  work-item plan
    Publishes an execution plan from --message or --file, sets state implementing, and records
    a local execution-plan event.

  work-item handoff
    Links a pull request, writes a completion report, sets state pr-open, and reports whether
    policy requires human review.

  work-item create-child
    Creates a child issue/work item, applies supported protocol metadata, and links it to the
    parent through the active tracker.

Tracker setup parameters:
  GitHub:      --github-repository OWNER/REPO
  Azure DevOps: --azdo-organization https://dev.azure.com/ORG --azdo-project PROJECT [--azdo-team TEAM]
  Optional:    --provision-tracker creates or verifies tracker-side protocol configuration where supported

All command output is JSON, except setup and help.
`);
}


main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});
