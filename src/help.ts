export interface HelpArgument {
  name: string;
  required: boolean;
  description: string;
}

export interface HelpFlag {
  name: string;
  valueName?: string;
  required?: boolean;
  description: string;
}

export interface HelpExample {
  command: string;
  description: string;
}

export interface HelpOutputField {
  name: string;
  description: string;
}

export interface HelpOutput {
  description: string;
  fields?: HelpOutputField[];
}

export interface HelpNode {
  name: string;
  summary: string;
  description: string;
  usage: string[];
  arguments?: HelpArgument[];
  flags?: HelpFlag[];
  policyEffects?: string[];
  notes?: string[];
  examples?: HelpExample[];
  output?: HelpOutput;
  aliases?: string[];
  subcommands?: HelpNode[];
}

export interface HelpJson {
  commandPath: string[];
  fullCommand: string;
  summary: string;
  description: string;
  usage: string[];
  arguments: HelpArgument[];
  flags: HelpFlag[];
  policyEffects: string[];
  notes: string[];
  examples: HelpExample[];
  output?: HelpOutput;
  subcommands: Array<{ name: string; summary: string }>;
}

const agentIdFlag: HelpFlag = {
  name: '--agent',
  valueName: '<agent-id>',
  description: 'Stable autonomous agent identifier used in claims and tracker updates. Defaults to local agent identity.',
};

const repoFlag: HelpFlag = {
  name: '--repo',
  valueName: '<repo>',
  description: 'Repository root that contains .agent-stack. Defaults to the current working directory.',
};

const topLevelHelp: HelpNode = {
  name: 'agentstack',
  summary: 'Canonical CLI for AgentStack Protocol workflow and tracker-backed execution.',
  description:
    'AgentStack exposes a canonical JSON interface over the active backlog tracker. Use `agentstack help <command> --json` when an agent needs the current command contract directly from the CLI.',
  usage: [
    'agentstack help [command...] [--json]',
    'agentstack <command> [subcommand] [flags]',
  ],
  notes: [
    'Use `agentstack help --json` for machine-readable command documentation.',
    'Use `agentstack <command> --help` or `agentstack <command> <subcommand> --help` for structured human help.',
    'All non-setup command output is JSON.',
  ],
  subcommands: [
    {
      name: 'setup',
      summary: 'Install AgentStack protocol assets into a repository.',
      description:
        'Creates or refreshes `.agent-stack`, `.agents/skills/agentstack-*`, and the managed AgentStack block in `AGENTS.md`. Deploys only the selected tracker profile.',
      usage: [
        'agentstack setup --tracker github --github-repository OWNER/REPO [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]',
        'agentstack setup --tracker azure-devops --azdo-organization <url> --azdo-project <project> [--azdo-team <team>] [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]',
      ],
      flags: [
        { name: '--tracker', valueName: 'github|azure-devops', required: true, description: 'Tracker profile to install.' },
        { name: '--github-repository', valueName: 'OWNER/REPO', description: 'GitHub repository slug. Required for GitHub unless setup can infer origin.' },
        { name: '--azdo-organization', valueName: '<url>', description: 'Azure DevOps organization URL. Required for Azure DevOps.' },
        { name: '--azdo-project', valueName: '<project>', description: 'Azure DevOps project name. Required for Azure DevOps.' },
        { name: '--azdo-team', valueName: '<team>', description: 'Optional Azure Boards team context.' },
        { name: '--target', valueName: '<repo>', description: 'Repository directory to initialize. Defaults to the current working directory.' },
        { name: '--agents', valueName: '<list>', description: 'Comma-separated agent shim targets such as `generic,claude,copilot,gemini`.' },
        { name: '--overwrite', description: 'Replace existing managed protocol files when present.' },
        { name: '--provision-tracker', description: 'Create or verify tracker-side configuration where supported.' },
      ],
      examples: [
        {
          command: 'agentstack setup --tracker github --github-repository OWNER/REPO --agents generic --provision-tracker --overwrite',
          description: 'Install the GitHub profile and provision default protocol labels.',
        },
      ],
      subcommands: [],
    },
    {
      name: 'doctor',
      summary: 'Validate repository-local AgentStack setup.',
      description:
        'Verifies that `.agent-stack` exists, the active tracker config is usable, and the language and mapping files validate.',
      usage: ['agentstack doctor [--repo <repo>]'],
      flags: [repoFlag],
      output: {
        description: 'JSON readiness report.',
        fields: [
          { name: 'ok', description: 'Overall validation result.' },
          { name: 'activeTracker', description: 'Selected tracker profile from `.agent-stack/active-tracker.json`.' },
          { name: 'language', description: 'Backlog language validation result.' },
          { name: 'mapping', description: 'Active tracker mapping validation result.' },
        ],
      },
      subcommands: [],
    },
    {
      name: 'language',
      summary: 'Language file operations.',
      description: 'Commands that validate or inspect canonical AgentStack backlog language assets.',
      usage: ['agentstack language <subcommand>'],
      subcommands: [
        {
          name: 'validate',
          summary: 'Validate `.agent-stack/language/backlog-language.yaml`.',
          description:
            'Parses the language YAML, normalizes field names, and verifies required canonical concepts are present.',
          usage: ['agentstack language validate [--repo <repo>]'],
          flags: [repoFlag],
          output: {
            description: 'JSON validation result.',
            fields: [
              { name: 'ok', description: 'Whether the file parsed and validated successfully.' },
              { name: 'issues', description: 'Validation problems with canonical paths and messages.' },
            ],
          },
          subcommands: [],
        },
      ],
    },
    {
      name: 'mapping',
      summary: 'Tracker mapping operations.',
      description: 'Commands that validate or inspect the active tracker mapping file.',
      usage: ['agentstack mapping <subcommand>'],
      subcommands: [
        {
          name: 'validate',
          summary: 'Validate the active `.agent-stack/trackers/<tracker>.mapping.yaml`.',
          description:
            'Parses the mapping YAML, normalizes field names, and verifies canonical type, state, relation, and readiness mappings.',
          usage: ['agentstack mapping validate [--repo <repo>]'],
          flags: [repoFlag],
          output: {
            description: 'JSON validation result.',
            fields: [
              { name: 'ok', description: 'Whether the mapping parsed and validated successfully.' },
              { name: 'issues', description: 'Validation problems with canonical paths and messages.' },
            ],
          },
          subcommands: [],
        },
      ],
    },
    {
      name: 'agent',
      summary: 'Local agent identity operations.',
      description:
        'Commands for creating and inspecting the repository-local agent identity used as the default claim agent id. Identity files are local runtime state and should not be committed.',
      usage: ['agentstack agent identity <init|show> [--agent <agent-id>] [--provider <name>] [--repo <repo>]'],
      subcommands: [
        {
          name: 'identity',
          summary: 'Create or inspect local agent identity.',
          description:
            'Initializes or displays `.agent-stack/local/agent-identity.json`. `claim` creates this identity automatically when `--agent` is omitted.',
          usage: [
            'agentstack agent identity init [--agent <agent-id>] [--provider <name>] [--repo <repo>]',
            'agentstack agent identity show [--repo <repo>]',
          ],
          flags: [
            { name: '--agent', valueName: '<agent-id>', description: 'Explicit agent id to persist locally.' },
            { name: '--provider', valueName: '<name>', description: 'Agent provider name used when generating an id. Defaults to environment detection or `agent`.' },
            repoFlag,
          ],
          output: {
            description: 'Local identity result.',
            fields: [
              { name: 'identity.agentId', description: 'Stable local agent id used by default for claims.' },
              { name: 'identity.provider', description: 'Provider label such as `codex`, `claude`, or `agent`.' },
              { name: 'path', description: 'Local identity file path.' },
            ],
          },
          subcommands: [],
        },
      ],
    },
    {
      name: 'work-item',
      summary: 'Canonical tracker-backed work item operations.',
      description: 'Commands that read, claim, update, and submit backlog items through the active tracker adapter.',
      usage: ['agentstack work-item <subcommand>'],
      subcommands: [
        {
          name: 'get',
          summary: 'Read one tracker item as a canonical `WorkItem`.',
          description:
            'Returns normalized protocol fields such as execution mode, readiness, protocol state, claim metadata, tags, and relations.',
          usage: ['agentstack work-item get <id> [--repo <repo>]'],
          arguments: [{ name: '<id>', required: true, description: 'Tracker work item id ending in a numeric identifier.' }],
          flags: [repoFlag],
          output: {
            description: 'Canonical work item payload.',
            fields: [
              { name: 'item.ref', description: 'Canonical work item reference for the active tracker.' },
              { name: 'item.protocolState', description: 'Normalized protocol state.' },
              { name: 'item.claim', description: 'Current active claim metadata when present.' },
            ],
          },
          subcommands: [],
        },
        {
          name: 'intake',
          summary: 'List work items that appear ready for autonomous execution.',
          description:
            'Queries the active tracker for open items that are mapped to agent execution, ready-for-agent, and ready-state conditions.',
          usage: ['agentstack work-item intake [--limit 10] [--agent <agent-id>] [--repo <repo>]'],
          flags: [
            { name: '--limit', valueName: '<n>', description: 'Maximum number of items to return. Defaults to 10.' },
            { name: '--agent', valueName: '<agent-id>', description: 'Restrict results to items assigned to a specific agent identifier.' },
            repoFlag,
          ],
          output: {
            description: 'List of canonical work item references.',
            fields: [{ name: 'items', description: 'Eligible work item references in priority/order returned by the tracker query.' }],
          },
          subcommands: [],
        },
        {
          name: 'graph',
          summary: 'Read one work item plus dependency and hierarchy status.',
          description:
            'Returns parent, children, blockers, blocked items, dependency status, and a `canStart` decision after applying policy gates.',
          usage: ['agentstack work-item graph <id> [--repo <repo>]'],
          arguments: [{ name: '<id>', required: true, description: 'Tracker work item id ending in a numeric identifier.' }],
          flags: [repoFlag],
          policyEffects: ['`requireAcceptanceCriteria` contributes `missing-acceptance-criteria` when no parsed acceptance criteria are available.'],
          output: {
            description: 'Graph and readiness decision.',
            fields: [
              { name: 'root', description: 'Canonical reference for the requested work item.' },
              { name: 'dependencyStatus', description: 'Open blockers and blocked items according to the active tracker.' },
              { name: 'canStart', description: 'Whether the work item is eligible for implementation right now.' },
              { name: 'reasons', description: 'Eligibility failure reasons such as `active-claim-exists` or `open-blocking-dependencies`.' },
            ],
          },
          subcommands: [],
        },
        {
          name: 'claim',
          summary: 'Register an exclusive autonomous execution claim.',
          description:
            'Checks eligibility, writes protocol state `claimed`, persists claim metadata through the active tracker, and records a local claim event.',
          usage: ['agentstack work-item claim <id> [--agent <agent-id>] [--branch <name>] [--workspace <path>] [--force] [--repo <repo>]'],
          arguments: [{ name: '<id>', required: true, description: 'Tracker work item id ending in a numeric identifier.' }],
          flags: [
            agentIdFlag,
            { name: '--branch', valueName: '<name>', description: 'Optional branch name recorded in claim metadata.' },
            { name: '--workspace', valueName: '<path>', description: 'Optional workspace identifier recorded in claim metadata.' },
            { name: '--force', description: 'Bypass eligibility failures for controlled smoke tests or explicit human-approved exceptions.' },
            repoFlag,
          ],
          policyEffects: ['`requireAcceptanceCriteria` can block the claim unless `--force` is used.'],
          notes: [
            'When `--agent` is omitted, the CLI uses `.agent-stack/local/agent-identity.json` or creates it automatically.',
            'The generated claim token is saved locally under `.agent-stack/runs/<id>/claim.json` for later release/resume operations.',
          ],
          output: {
            description: 'Claim result.',
            fields: [
              { name: 'claimed', description: 'Whether the claim succeeded.' },
              { name: 'claim.claimToken', description: 'Generated claim token for later release or auditing.' },
              { name: 'claim.claimedAt', description: 'ISO timestamp for the claim write.' },
            ],
          },
          subcommands: [],
        },
        {
          name: 'release',
          summary: 'Release an active claim marker from a work item.',
          description:
            'Removes the active claim marker through the tracker adapter and records a local claim-release event.',
          usage: ['agentstack work-item release <id> [--claim-token <token>] [--repo <repo>]'],
          arguments: [{ name: '<id>', required: true, description: 'Tracker work item id ending in a numeric identifier.' }],
          flags: [
            { name: '--claim-token', valueName: '<token>', description: 'Claim token associated with the claim being released. Defaults to the local claim file when present.' },
            repoFlag,
          ],
          notes: ['Local claim tokens are read from `.agent-stack/runs/<id>/claim.json` when `--claim-token` is omitted.'],
          output: {
            description: 'Release result.',
            fields: [
              { name: 'released', description: 'Whether the release command completed.' },
              { name: 'claimToken', description: 'Claim token provided by the caller.' },
            ],
          },
          subcommands: [],
        },
        {
          name: 'state',
          summary: 'Set a work item protocol state.',
          description:
            'Updates the tracker-native representation of the canonical protocol state defined by the active mapping.',
          usage: ['agentstack work-item state <id> --state <state> [--repo <repo>]'],
          arguments: [{ name: '<id>', required: true, description: 'Tracker work item id ending in a numeric identifier.' }],
          flags: [
            { name: '--state', valueName: '<state>', required: true, description: 'Canonical protocol state such as `ready`, `implementing`, `blocked`, or `pr-open`.' },
            repoFlag,
          ],
          output: {
            description: 'State change result.',
            fields: [
              { name: 'updated', description: 'Whether the state update completed.' },
              { name: 'state', description: 'Canonical protocol state written through the tracker mapping.' },
            ],
          },
          subcommands: [],
        },
        {
          name: 'progress',
          summary: 'Write a progress update comment.',
          description:
            'Adds a protocol-formatted progress update comment through the active tracker and records a local progress event.',
          usage: ['agentstack work-item progress <id> --message <text> [--repo <repo>]'],
          arguments: [{ name: '<id>', required: true, description: 'Tracker work item id ending in a numeric identifier.' }],
          flags: [
            { name: '--message', valueName: '<text>', required: true, description: 'Progress update text.' },
            { name: '--message-file', valueName: '<path>', description: 'Read progress update text from a file instead of inline.' },
            repoFlag,
          ],
          notes: ['Compatibility alias: `agentstack work-item heartbeat ...` currently routes to the same implementation.'],
          output: {
            description: 'Progress sync result.',
            fields: [
              { name: 'synced', description: 'Whether the tracker update completed.' },
              { name: 'event', description: 'Event kind recorded in the local protocol log. Always `progress`.' },
            ],
          },
          aliases: ['heartbeat'],
          subcommands: [],
        },
        {
          name: 'block',
          summary: 'Mark a work item as blocked and record the reason.',
          description:
            'Sets state `blocked`, adds a protocol-formatted blocker comment, and records a local blocker event.',
          usage: ['agentstack work-item block <id> --reason <text> [--repo <repo>]'],
          arguments: [{ name: '<id>', required: true, description: 'Tracker work item id ending in a numeric identifier.' }],
          flags: [
            { name: '--reason', valueName: '<text>', required: true, description: 'Blocker reason text.' },
            { name: '--reason-file', valueName: '<path>', description: 'Read blocker reason text from a file instead of inline.' },
            repoFlag,
          ],
          output: {
            description: 'Blocker result.',
            fields: [
              { name: 'blocked', description: 'Whether the blocker update completed.' },
              { name: 'needsHumanDecision', description: 'Current CLI behavior always reports `true` for blocker events.' },
            ],
          },
          subcommands: [],
        },
        {
          name: 'plan',
          summary: 'Publish an execution plan and move the item to implementation.',
          description:
            'Adds a protocol-formatted execution plan comment, sets state `implementing`, and records a local execution-plan event.',
          usage: [
            'agentstack work-item plan <id> --message <text> [--repo <repo>]',
            'agentstack work-item plan <id> --file <path> [--repo <repo>]',
          ],
          arguments: [{ name: '<id>', required: true, description: 'Tracker work item id ending in a numeric identifier.' }],
          flags: [
            { name: '--message', valueName: '<text>', description: 'Inline execution plan text.' },
            { name: '--file', valueName: '<path>', description: 'Read execution plan text from a file.' },
            repoFlag,
          ],
          output: {
            description: 'Execution plan result.',
            fields: [
              { name: 'logged', description: 'Whether the execution plan was recorded.' },
              { name: 'state', description: 'Protocol state after the command. Always `implementing`.' },
            ],
          },
          subcommands: [],
        },
        {
          name: 'submit-review',
          summary: 'Submit completed work for pull-request review.',
          description:
            'Links the PR, writes a review submission report, sets protocol state `pr-open`, and reports whether policy still requires human review.',
          usage: ['agentstack work-item submit-review <id> --pr <url> [--summary <text>|--summary-file <path>] [--repo <repo>]'],
          arguments: [{ name: '<id>', required: true, description: 'Tracker work item id ending in a numeric identifier.' }],
          flags: [
            { name: '--pr', valueName: '<url>', required: true, description: 'Pull request URL or review URL to attach to the work item.' },
            { name: '--summary', valueName: '<text>', description: 'Inline review submission summary.' },
            { name: '--summary-file', valueName: '<path>', description: 'Read review submission summary from a file.' },
            repoFlag,
          ],
          policyEffects: ['`requireHumanReviewBeforeMerge` is returned as `reviewRequired` in the command output.'],
          output: {
            description: 'Review submission result.',
            fields: [
              { name: 'submitted', description: 'Whether the submission command completed.' },
              { name: 'state', description: 'Protocol state after the command. Always `pr-open`.' },
              { name: 'reviewRequired', description: 'Whether repository policy still requires human review before merge.' },
            ],
          },
          subcommands: [],
        },
        {
          name: 'create-child',
          summary: 'Create a child work item under an existing parent.',
          description:
            'Creates the tracker item, applies supported protocol metadata, and links it to the parent through the active tracker adapter.',
          usage: ['agentstack work-item create-child <parent-id> --title <title> [--kind task] [--description <text>] [--execution-mode agent|human] [--ready-for-agent true|false] [--state <state>] [--repo <repo>]'],
          arguments: [
            { name: '<parent-id>', required: true, description: 'Parent tracker work item id ending in a numeric identifier.' },
          ],
          flags: [
            { name: '--title', valueName: '<title>', required: true, description: 'Child work item title.' },
            { name: '--kind', valueName: '<kind>', description: 'Canonical work item kind such as `task`, `bug`, `story`, or `spike`.' },
            { name: '--description', valueName: '<text>', description: 'Child work item description/body.' },
            { name: '--execution-mode', valueName: 'agent|human', description: 'Execution mode metadata for the new child item.' },
            { name: '--ready-for-agent', valueName: 'true|false', description: 'Ready-for-agent metadata for the new child item.' },
            { name: '--state', valueName: '<state>', description: 'Initial canonical protocol state. Defaults to `draft`.' },
            repoFlag,
          ],
          output: {
            description: 'Child creation result.',
            fields: [
              { name: 'created', description: 'Whether the child item was created.' },
              { name: 'child', description: 'Canonical reference for the created child work item.' },
            ],
          },
          subcommands: [],
        },
      ],
    },
  ],
};

export function findHelpNode(path: readonly string[]): HelpNode | undefined {
  let node: HelpNode | undefined = topLevelHelp;
  for (const segment of path) {
    if (!node) {
      return undefined;
    }
    const next: HelpNode | undefined = node.subcommands?.find(
      (candidate) => candidate.name === segment || candidate.aliases?.includes(segment),
    );
    if (!next) {
      return undefined;
    }
    node = next;
  }
  return node;
}

export function renderHelpJson(path: readonly string[] = []): HelpJson {
  const node = findHelpNode(path);
  if (!node) {
    throw new Error(`Unknown help topic: ${path.join(' ')}`);
  }

  return {
    commandPath: [...path],
    fullCommand: path.length === 0 ? 'agentstack' : `agentstack ${path.join(' ')}`,
    summary: node.summary,
    description: node.description,
    usage: [...node.usage],
    arguments: [...(node.arguments ?? [])],
    flags: [...(node.flags ?? [])],
    policyEffects: [...(node.policyEffects ?? [])],
    notes: [...(node.notes ?? [])],
    examples: [...(node.examples ?? [])],
    ...(node.output ? { output: node.output } : {}),
    subcommands: (node.subcommands ?? []).map((subcommand) => ({ name: subcommand.name, summary: subcommand.summary })),
  };
}

export function renderHelpText(path: readonly string[] = []): string {
  const help = renderHelpJson(path);
  const lines: string[] = [];

  lines.push(help.fullCommand === 'agentstack' ? 'AgentStack CLI Help' : `AgentStack Help: ${help.fullCommand}`);
  lines.push('');
  lines.push(help.summary);
  lines.push('');
  lines.push(help.description);

  appendBlock(lines, 'Usage', help.usage.map((entry) => `  ${entry}`));
  appendBlock(lines, 'Arguments', help.arguments.map((entry) => `  ${entry.name}${entry.required ? '' : ' (optional)'}  ${entry.description}`));
  appendBlock(lines, 'Flags', help.flags.map((flag) => {
    const renderedName = flag.valueName ? `${flag.name} ${flag.valueName}` : flag.name;
    const prefix = flag.required ? `${renderedName} (required)` : renderedName;
    return `  ${prefix}  ${flag.description}`;
  }));
  appendBlock(lines, 'Subcommands', help.subcommands.map((entry) => `  ${entry.name}  ${entry.summary}`));
  appendBlock(lines, 'Policy', help.policyEffects.map((entry) => `  ${entry}`));
  if (help.output) {
    const outputLines = [`  ${help.output.description}`];
    for (const field of help.output.fields ?? []) {
      outputLines.push(`  ${field.name}  ${field.description}`);
    }
    appendBlock(lines, 'Output', outputLines);
  }
  appendBlock(lines, 'Examples', help.examples.map((example) => `  ${example.command}\n    ${example.description}`));
  appendBlock(lines, 'Notes', help.notes.map((entry) => `  ${entry}`));

  return lines.join('\n').trimEnd();
}

function appendBlock(lines: string[], heading: string, blockLines: string[]): void {
  if (blockLines.length === 0) {
    return;
  }
  lines.push('');
  lines.push(`${heading}:`);
  lines.push(...blockLines);
}
