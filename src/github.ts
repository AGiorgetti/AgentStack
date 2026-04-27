import type {
  ClaimInfo,
  DependencyStatus,
  ProtocolState,
  Relation,
  WorkItem,
  WorkItemRef,
} from './model.js';
import type { EligibleWorkQuery, TrackerAdapter } from './tracker.js';
import {
  CommandExecutionError,
  type CommandRunner,
  createExecFileRunner,
  parseJsonOutput,
} from './cli.js';

interface GitHubIssueListRow {
  number: number;
  url: string;
}

interface GitHubIssueComment {
  body?: string;
}

interface GitHubGraphIssueNode {
  id: string;
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: 'OPEN' | 'CLOSED';
  labels: { nodes: Array<{ name: string }> };
  assignees: { nodes: Array<{ login: string }> };
  parent: null | { number: number; url: string };
  subIssues: { nodes: Array<{ number: number; url: string; state: 'OPEN' | 'CLOSED' }> };
  blockedBy: { nodes: Array<{ number: number; url: string; state: 'OPEN' | 'CLOSED' }> };
  blocking: { nodes: Array<{ number: number; url: string; state: 'OPEN' | 'CLOSED' }> };
}

interface GitHubGraphIssueResponse {
  repository?: {
    issue: GitHubGraphIssueNode | null;
  } | null;
  errors?: Array<{ message?: string }>;
}

interface GitHubCreateIssueResponse {
  number: number;
  html_url: string;
}

interface GitHubGraphQlEnvelope<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

export interface GitHubLabelMapping {
  executionAgentLabel: string;
  executionHumanLabel: string;
  readyForAgentLabel: string;
  claimActiveLabel: string;
  protocolStatePrefix: string;
  assignedAgentPrefix: string;
  priorityPrefix: string;
}

export interface GitHubTrackerConfig {
  owner: string;
  repo: string;
  runner?: CommandRunner;
  labels?: Partial<GitHubLabelMapping>;
}

const defaultLabels: GitHubLabelMapping = {
  executionAgentLabel: 'execution:agent',
  executionHumanLabel: 'execution:human',
  readyForAgentLabel: 'ready-for-agent',
  claimActiveLabel: 'claim:active',
  protocolStatePrefix: 'protocol:',
  assignedAgentPrefix: 'assigned-agent:',
  priorityPrefix: 'priority:',
};

const claimCommentPrefix = '<!-- agentstack-protocol:claim ';
const legacyClaimCommentPrefix = '<!-- agent-protocol:claim ';
const claimCommentSuffix = ' -->';
const relationGraphQlFields = ['parent', 'subIssues', 'blockedBy', 'blocking'];

class RelationFieldGraphQlError extends Error {}

function isRelationFieldGraphQlError(details: string): boolean {
  return relationGraphQlFields.some((field) => details.includes(field));
}

function normalizeProtocolState(state: string): ProtocolState {
  switch (state) {
    case 'draft':
    case 'ready':
    case 'claimed':
    case 'implementing':
    case 'blocked':
    case 'pr-open':
    case 'in-review':
    case 'done':
    case 'abandoned':
      return state;
    default:
      throw new Error(`Unsupported protocol state label: ${state}`);
  }
}

function toProtocolState(labels: readonly string[], mapping: GitHubLabelMapping, issueState: 'OPEN' | 'CLOSED'): ProtocolState {
  const stateLabel = labels.find((label) => label.startsWith(mapping.protocolStatePrefix));
  if (stateLabel) {
    return normalizeProtocolState(stateLabel.slice(mapping.protocolStatePrefix.length));
  }

  return issueState === 'CLOSED' ? 'done' : 'draft';
}

function parseAssignedAgent(labels: readonly string[], mapping: GitHubLabelMapping): string | undefined {
  const label = labels.find((candidate) => candidate.startsWith(mapping.assignedAgentPrefix));
  return label ? label.slice(mapping.assignedAgentPrefix.length) : undefined;
}

function parsePriority(labels: readonly string[], mapping: GitHubLabelMapping): number | undefined {
  const label = labels.find((candidate) => candidate.startsWith(mapping.priorityPrefix));
  if (!label) {
    return undefined;
  }

  const raw = Number.parseInt(label.slice(mapping.priorityPrefix.length), 10);
  return Number.isNaN(raw) ? undefined : raw;
}

function parseClaimInfo(comments: readonly GitHubIssueComment[]): ClaimInfo | undefined {
  for (const comment of [...comments].reverse()) {
    const body = comment.body ?? '';
    for (const prefix of [claimCommentPrefix, legacyClaimCommentPrefix]) {
      const start = body.indexOf(prefix);
      const end = body.indexOf(claimCommentSuffix, start + prefix.length);
      if (start < 0 || end < 0) {
        continue;
      }

      const jsonPayload = body.slice(start + prefix.length, end);
      try {
        return JSON.parse(jsonPayload) as ClaimInfo;
      } catch {
        continue;
      }
    }
  }

  return undefined;
}

function formatClaimComment(claim: ClaimInfo): string {
  return `${claimCommentPrefix}${JSON.stringify(claim)}${claimCommentSuffix}\nAgent claim registered for autonomous execution.`;
}

function toIssueNumber(ref: WorkItemRef): number {
  const issueNumber = Number.parseInt(ref.id, 10);
  if (Number.isNaN(issueNumber)) {
    throw new Error(`GitHub work item id must be numeric. Received: ${ref.id}`);
  }
  return issueNumber;
}

export class GitHubTrackerAdapter implements TrackerAdapter {
  private readonly config: GitHubTrackerConfig;
  private readonly runner: CommandRunner;
  private readonly labels: GitHubLabelMapping;

  public constructor(config: GitHubTrackerConfig) {
    this.config = config;
    this.runner = config.runner ?? createExecFileRunner();
    this.labels = { ...defaultLabels, ...config.labels };
  }

  public async getWorkItem(ref: WorkItemRef): Promise<WorkItem> {
    const issue = await this.getIssueNode(toIssueNumber(ref), { allowRelationFallback: true });
    const comments = await this.getIssueComments(issue.number);
    return this.toWorkItem(issue, comments);
  }

  public async queryEligibleWork(filters?: EligibleWorkQuery): Promise<WorkItemRef[]> {
    const searchClauses = [
      `label:\"${this.labels.executionAgentLabel}\"`,
      `label:\"${this.labels.readyForAgentLabel}\"`,
      `label:\"${this.labels.protocolStatePrefix}ready\"`,
      'state:open',
    ];

    if (filters?.assignedAgent) {
      searchClauses.push(`label:\"${this.labels.assignedAgentPrefix}${filters.assignedAgent}\"`);
    }

    const result = await this.runGhJson<GitHubIssueListRow[]>([
      'issue',
      'list',
      '--repo',
      this.getRepositorySlug(),
      '--limit',
      '100',
      '--search',
      searchClauses.join(' '),
      '--json',
      'number,url',
    ]);

    return result.map((row) => this.createRef(String(row.number), row.url));
  }

  public async getRelations(ref: WorkItemRef): Promise<Relation[]> {
    return (await this.getWorkItem(ref)).relations;
  }

  public async getDependencyStatus(ref: WorkItemRef): Promise<DependencyStatus> {
    const issue = await this.getIssueNode(toIssueNumber(ref));

    return {
      blockedByOpen: issue.blockedBy.nodes
        .filter((node) => node.state === 'OPEN')
        .map((node) => this.createRef(String(node.number), node.url)),
      blocksOpen: issue.blocking.nodes
        .filter((node) => node.state === 'OPEN')
        .map((node) => this.createRef(String(node.number), node.url)),
    };
  }

  public async claim(ref: WorkItemRef, claim: ClaimInfo): Promise<void> {
    await this.setProtocolState(ref, 'claimed');
    await this.ensureLabelPresent(ref, this.labels.claimActiveLabel);
    await this.addComment(ref, formatClaimComment(claim));
  }

  public async releaseClaim(ref: WorkItemRef, _claimToken: string): Promise<void> {
    await this.ensureLabelAbsent(ref, this.labels.claimActiveLabel);
    await this.addComment(ref, 'Agent claim released.');
  }

  public async setProtocolState(ref: WorkItemRef, state: ProtocolState): Promise<void> {
    const issue = await this.getIssueNode(toIssueNumber(ref));
    const currentLabels = issue.labels.nodes.map((node) => node.name);
    const protocolLabels = currentLabels.filter((label) => label.startsWith(this.labels.protocolStatePrefix));

    const args = [
      'issue',
      'edit',
      String(issue.number),
      '--repo',
      this.getRepositorySlug(),
      '--add-label',
      `${this.labels.protocolStatePrefix}${state}`,
    ];

    if (protocolLabels.length > 0) {
      args.push('--remove-label', protocolLabels.join(','));
    }

    await this.runGh(args);
  }

  public async addComment(ref: WorkItemRef, body: string): Promise<void> {
    await this.runGh([
      'api',
      `repos/${this.config.owner}/${this.config.repo}/issues/${toIssueNumber(ref)}/comments`,
      '--method',
      'POST',
      '--raw-field',
      `body=${body}`,
    ]);
  }

  public async createChild(parent: WorkItemRef, draft: Partial<WorkItem>): Promise<WorkItemRef> {
    const response = await this.runGhJson<GitHubCreateIssueResponse>([
      'api',
      `repos/${this.config.owner}/${this.config.repo}/issues`,
      '--method',
      'POST',
      '--raw-field',
      `title=${draft.title ?? 'Untitled child work item'}`,
      '--raw-field',
      `body=${draft.description ?? ''}`,
    ]);

    const childRef = this.createRef(String(response.number), response.html_url);
    await this.applyDraftMetadata(childRef, draft);
    await this.linkParentChild(parent, childRef);
    return childRef;
  }

  public async linkParentChild(parent: WorkItemRef, child: WorkItemRef): Promise<void> {
    const [parentIssue, childIssue] = await Promise.all([
      this.getIssueNode(toIssueNumber(parent)),
      this.getIssueNode(toIssueNumber(child)),
    ]);

    await this.runGraphQl(
      `mutation AddSubIssue($issueId: ID!, $subIssueId: ID!) {
        addSubIssue(input: { issueId: $issueId, subIssueId: $subIssueId, replaceParent: false }) {
          issue { id }
        }
      }`,
      {
        issueId: parentIssue.id,
        subIssueId: childIssue.id,
      },
    );
  }

  public async linkDependency(
    source: WorkItemRef,
    target: WorkItemRef,
    kind: 'blocks' | 'blocked-by',
  ): Promise<void> {
    const [sourceIssue, targetIssue] = await Promise.all([
      this.getIssueNode(toIssueNumber(source)),
      this.getIssueNode(toIssueNumber(target)),
    ]);

    const blockedIssueId = kind === 'blocks' ? targetIssue.id : sourceIssue.id;
    const blockingIssueId = kind === 'blocks' ? sourceIssue.id : targetIssue.id;

    await this.runGraphQl(
      `mutation AddBlockedBy($issueId: ID!, $blockingIssueId: ID!) {
        addBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) {
          issue { id }
        }
      }`,
      {
        issueId: blockedIssueId,
        blockingIssueId,
      },
    );
  }

  public async attachPullRequest(ref: WorkItemRef, prUrl: string): Promise<void> {
    await this.addComment(ref, `Linked pull request: ${prUrl}`);
  }

  private async applyDraftMetadata(ref: WorkItemRef, draft: Partial<WorkItem>): Promise<void> {
    const labelsToAdd: string[] = [];

    if (draft.executionMode === 'agent') {
      labelsToAdd.push(this.labels.executionAgentLabel);
    }
    if (draft.executionMode === 'human') {
      labelsToAdd.push(this.labels.executionHumanLabel);
    }
    if (draft.readyForAgent) {
      labelsToAdd.push(this.labels.readyForAgentLabel);
    }
    if (draft.protocolState) {
      labelsToAdd.push(`${this.labels.protocolStatePrefix}${draft.protocolState}`);
    }
    if (draft.assignedAgent) {
      labelsToAdd.push(`${this.labels.assignedAgentPrefix}${draft.assignedAgent}`);
    }
    if (typeof draft.priority === 'number') {
      labelsToAdd.push(`${this.labels.priorityPrefix}${draft.priority}`);
    }
    if (draft.tags) {
      labelsToAdd.push(...draft.tags);
    }

    if (labelsToAdd.length === 0) {
      return;
    }

    await this.runGh([
      'issue',
      'edit',
      String(toIssueNumber(ref)),
      '--repo',
      this.getRepositorySlug(),
      '--add-label',
      labelsToAdd.join(','),
    ]);
  }

  private toWorkItem(issue: GitHubGraphIssueNode, comments: readonly GitHubIssueComment[]): WorkItem {
    const labels = issue.labels.nodes.map((node) => node.name);
    const relations: Relation[] = [];

    if (issue.parent) {
      relations.push({
        type: 'parent',
        target: this.createRef(String(issue.parent.number), issue.parent.url),
      });
    }

    for (const child of issue.subIssues.nodes) {
      relations.push({
        type: 'child',
        target: this.createRef(String(child.number), child.url),
      });
    }

    for (const blocker of issue.blockedBy.nodes) {
      relations.push({
        type: 'blocked-by',
        target: this.createRef(String(blocker.number), blocker.url),
      });
    }

    for (const blocked of issue.blocking.nodes) {
      relations.push({
        type: 'blocks',
        target: this.createRef(String(blocked.number), blocked.url),
      });
    }

    const priority = parsePriority(labels, this.labels);
    const claim = labels.includes(this.labels.claimActiveLabel) ? parseClaimInfo(comments) : undefined;
    const assignedHuman = issue.assignees.nodes[0]?.login;
    const assignedAgent = parseAssignedAgent(labels, this.labels);

    return {
      ref: this.createRef(String(issue.number), issue.url),
      title: issue.title,
      description: issue.body ?? '',
      ...(typeof priority === 'number' ? { priority } : {}),
      executionMode: labels.includes(this.labels.executionAgentLabel) ? 'agent' : 'human',
      readyForAgent: labels.includes(this.labels.readyForAgentLabel),
      protocolState: toProtocolState(labels, this.labels, issue.state),
      ...(claim ? { claim } : {}),
      ...(assignedHuman ? { assignedHuman } : {}),
      ...(assignedAgent ? { assignedAgent } : {}),
      tags: labels,
      relations,
    };
  }

  private createRef(id: string, url?: string): WorkItemRef {
    return {
      platform: 'github',
      project: this.config.owner,
      container: this.config.repo,
      id,
      ...(url ? { url } : {}),
    };
  }

  private getRepositorySlug(): string {
    return `${this.config.owner}/${this.config.repo}`;
  }

  private async ensureLabelPresent(ref: WorkItemRef, label: string): Promise<void> {
    const issue = await this.getIssueNode(toIssueNumber(ref));
    const currentLabels = issue.labels.nodes.map((node) => node.name);
    if (currentLabels.includes(label)) {
      return;
    }

    await this.runGh([
      'issue',
      'edit',
      String(issue.number),
      '--repo',
      this.getRepositorySlug(),
      '--add-label',
      label,
    ]);
  }

  private async ensureLabelAbsent(ref: WorkItemRef, label: string): Promise<void> {
    const issue = await this.getIssueNode(toIssueNumber(ref));
    const currentLabels = issue.labels.nodes.map((node) => node.name);
    if (!currentLabels.includes(label)) {
      return;
    }

    await this.runGh([
      'issue',
      'edit',
      String(issue.number),
      '--repo',
      this.getRepositorySlug(),
      '--remove-label',
      label,
    ]);
  }

  private async getIssueComments(issueNumber: number): Promise<GitHubIssueComment[]> {
    return this.runGhJson<GitHubIssueComment[]>([
      'api',
      `repos/${this.config.owner}/${this.config.repo}/issues/${issueNumber}/comments`,
    ]);
  }

  private async getIssueNode(issueNumber: number, options?: { allowRelationFallback?: boolean }): Promise<GitHubGraphIssueNode> {
    try {
      return this.readIssueNode(
        issueNumber,
        await this.runGraphQl<GitHubGraphIssueResponse>(
          `query GetIssue($owner: String!, $name: String!, $number: Int!) {
            repository(owner: $owner, name: $name) {
              issue(number: $number) {
                id
                number
                title
                body
                url
                state
                labels(first: 100) {
                  nodes { name }
                }
                assignees(first: 10) {
                  nodes { login }
                }
                parent {
                  number
                  url
                }
                subIssues(first: 100) {
                  nodes {
                    number
                    url
                    state
                  }
                }
                blockedBy(first: 100) {
                  nodes {
                    number
                    url
                    state
                  }
                }
                blocking(first: 100) {
                  nodes {
                    number
                    url
                    state
                  }
                }
              }
            }
          }`,
          {
            owner: this.config.owner,
            name: this.config.repo,
            number: issueNumber,
          },
        ),
        options,
      );
    } catch (error) {
      if (error instanceof RelationFieldGraphQlError) {
        return this.getIssueNodeWithoutRelations(issueNumber);
      }
      throw error;
    }
  }

  private async getIssueNodeWithoutRelations(issueNumber: number): Promise<GitHubGraphIssueNode> {
    const issue = this.readIssueNode(
      issueNumber,
      await this.runGraphQl<GitHubGraphIssueResponse>(
        `query GetIssue($owner: String!, $name: String!, $number: Int!) {
          repository(owner: $owner, name: $name) {
            issue(number: $number) {
              id
              number
              title
              body
              url
              state
              labels(first: 100) {
                nodes { name }
              }
              assignees(first: 10) {
                nodes { login }
              }
            }
          }
        }`,
        {
          owner: this.config.owner,
          name: this.config.repo,
          number: issueNumber,
        },
      ),
    );

    return {
      ...issue,
      parent: null,
      subIssues: { nodes: [] },
      blockedBy: { nodes: [] },
      blocking: { nodes: [] },
    };
  }

  private readIssueNode(
    issueNumber: number,
    data: GitHubGraphIssueResponse,
    options?: { allowRelationFallback?: boolean },
  ): GitHubGraphIssueNode {
    if (data.errors?.length) {
      const details = data.errors.map((error) => error.message).filter(Boolean).join('; ');
      if (options?.allowRelationFallback && isRelationFieldGraphQlError(details)) {
        throw new RelationFieldGraphQlError();
      }
      throw new Error(`GitHub GraphQL query failed for ${this.getRepositorySlug()}#${issueNumber}: ${details || 'unknown error'}`);
    }

    if (!data.repository) {
      throw new Error(`GitHub repository not found or inaccessible: ${this.getRepositorySlug()}`);
    }

    const issue = data.repository.issue;
    if (!issue) {
      throw new Error(`GitHub issue not found: ${this.getRepositorySlug()}#${issueNumber}`);
    }

    return issue;
  }

  private async runGraphQl<T>(query: string, variables: Record<string, string | number | boolean>): Promise<T> {
    const args = ['api', 'graphql', '--raw-field', `query=${query}`];
    for (const [key, value] of Object.entries(variables)) {
      args.push('-F', `${key}=${String(value)}`);
    }

    const response = await this.runGhJson<T | GitHubGraphQlEnvelope<T>>(args);
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const envelope = response as GitHubGraphQlEnvelope<T>;
      return {
        ...(typeof envelope.data === 'object' && envelope.data !== null ? envelope.data : {}),
        ...(envelope.errors ? { errors: envelope.errors } : {}),
      } as T;
    }
    return response as T;
  }

  private async runGhJson<T>(args: string[]): Promise<T> {
    const output = await this.runGh([...args, '--jq', '.']);
    return parseJsonOutput<T>(output.stdout);
  }

  private async runGh(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await this.runner.run('gh', args);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        throw new Error(`GitHub CLI call failed: ${error.message}`);
      }
      throw error;
    }
  }
}
