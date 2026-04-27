import type {
  ClaimInfo,
  DependencyStatus,
  ProtocolState,
  Relation,
  RelationType,
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

interface AzureWorkItemResponse {
  id: number;
  url?: string;
  fields?: Record<string, unknown>;
  relations?: AzureWorkItemRelation[];
}

interface AzureWorkItemRelation {
  rel?: string;
  url?: string;
  attributes?: Record<string, unknown>;
  targetId?: number;
  targetUrl?: string;
  id?: number;
  name?: string;
}

interface AzureQueryResponse {
  workItems?: Array<{ id: number; url?: string }>;
  workItemRelations?: Array<{ target?: { id?: number; url?: string } }>;
}

interface AzureQueryWorkItem {
  id: number;
  url?: string;
}

interface AzureRelationTypeInfo {
  name?: string;
  referenceName?: string;
}

export interface AzureDevOpsFieldMapping {
  executionModeField?: string;
  readyForAgentField?: string;
  protocolStateField?: string;
  assignedAgentField?: string;
  priorityField?: string;
  tagsField: string;
  stateField: string;
  titleField: string;
  descriptionField: string;
  assignedToField: string;
}

export interface AzureDevOpsTagMapping {
  executionAgentTag: string;
  executionHumanTag: string;
  readyForAgentTag: string;
  claimActiveTag: string;
  protocolStatePrefix: string;
  assignedAgentPrefix: string;
  priorityPrefix: string;
}

export interface AzureDevOpsRelationMapping {
  parent?: string;
  child?: string;
  related?: string;
  blockedBy?: string;
  blocks?: string;
}

export interface AzureDevOpsTrackerConfig {
  organizationUrl: string;
  project: string;
  runner?: CommandRunner;
  fields?: Partial<AzureDevOpsFieldMapping>;
  tags?: Partial<AzureDevOpsTagMapping>;
  relationTypes?: AzureDevOpsRelationMapping;
  workItemTypeByKind?: Partial<Record<WorkItem['kind'] extends infer K ? Extract<K, string> : never, string>>;
  defaultWorkItemType?: string;
}

const defaultFields: AzureDevOpsFieldMapping = {
  tagsField: 'System.Tags',
  stateField: 'System.State',
  titleField: 'System.Title',
  descriptionField: 'System.Description',
  assignedToField: 'System.AssignedTo',
};

const defaultTags: AzureDevOpsTagMapping = {
  executionAgentTag: 'execution:agent',
  executionHumanTag: 'execution:human',
  readyForAgentTag: 'ready-for-agent',
  claimActiveTag: 'claim:active',
  protocolStatePrefix: 'protocol:',
  assignedAgentPrefix: 'assigned-agent:',
  priorityPrefix: 'priority:',
};

const claimCommentPrefix = '<!-- agentstack-protocol:claim ';
const legacyClaimCommentPrefix = '<!-- agent-protocol:claim ';
const claimCommentSuffix = ' -->';

function parseBooleanField(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return undefined;
}

function parseTags(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return [];
  }

  return raw
    .split(';')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function stringifyTags(tags: readonly string[]): string {
  return [...new Set(tags)].join('; ');
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
      throw new Error(`Unsupported protocol state: ${state}`);
  }
}

function formatClaimComment(claim: ClaimInfo): string {
  return `${claimCommentPrefix}${JSON.stringify(claim)}${claimCommentSuffix}\nAgent claim registered for autonomous execution.`;
}

function parseClaimInfoFromDescription(description: string): ClaimInfo | undefined {
  for (const prefix of [claimCommentPrefix, legacyClaimCommentPrefix]) {
    const start = description.indexOf(prefix);
    const end = description.indexOf(claimCommentSuffix, start + prefix.length);
    if (start < 0 || end < 0) {
      continue;
    }

    try {
      return JSON.parse(description.slice(start + prefix.length, end)) as ClaimInfo;
    } catch {
      continue;
    }
  }

  return undefined;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function toWorkItemId(ref: WorkItemRef): number {
  const id = Number.parseInt(ref.id, 10);
  if (Number.isNaN(id)) {
    throw new Error(`Azure DevOps work item id must be numeric. Received: ${ref.id}`);
  }
  return id;
}

export class AzureDevOpsTrackerAdapter implements TrackerAdapter {
  private readonly config: AzureDevOpsTrackerConfig;
  private readonly runner: CommandRunner;
  private readonly fields: AzureDevOpsFieldMapping;
  private readonly tags: AzureDevOpsTagMapping;
  private relationTypeCache?: AzureDevOpsRelationMapping;

  public constructor(config: AzureDevOpsTrackerConfig) {
    this.config = config;
    this.runner = config.runner ?? createExecFileRunner();
    this.fields = { ...defaultFields, ...config.fields };
    this.tags = { ...defaultTags, ...config.tags };
  }

  public async getWorkItem(ref: WorkItemRef): Promise<WorkItem> {
    const item = await this.getRawWorkItem(toWorkItemId(ref));
    const relationDetails = await this.getRawRelations(toWorkItemId(ref));
    return this.toWorkItem(item, relationDetails.relations ?? item.relations ?? []);
  }

  public async queryEligibleWork(filters?: EligibleWorkQuery): Promise<WorkItemRef[]> {
    const clauses = [`[System.TeamProject] = '${escapeWiql(this.config.project)}'`];

    if (this.fields.executionModeField) {
      clauses.push(`[${this.fields.executionModeField}] = 'agent'`);
    } else {
      clauses.push(`[${this.fields.tagsField}] CONTAINS '${escapeWiql(this.tags.executionAgentTag)}'`);
    }

    if (this.fields.readyForAgentField) {
      clauses.push(`[${this.fields.readyForAgentField}] = 'true'`);
    } else {
      clauses.push(`[${this.fields.tagsField}] CONTAINS '${escapeWiql(this.tags.readyForAgentTag)}'`);
    }

    if (this.fields.protocolStateField) {
      clauses.push(`[${this.fields.protocolStateField}] = 'ready'`);
    } else {
      clauses.push(`[${this.fields.tagsField}] CONTAINS '${escapeWiql(`${this.tags.protocolStatePrefix}ready`)}'`);
      for (const state of ['draft', 'claimed', 'implementing', 'blocked', 'pr-open', 'in-review', 'done', 'abandoned']) {
        clauses.push(`[${this.fields.tagsField}] NOT CONTAINS '${escapeWiql(`${this.tags.protocolStatePrefix}${state}`)}'`);
      }
    }

    if (filters?.assignedAgent) {
      if (this.fields.assignedAgentField) {
        clauses.push(`[${this.fields.assignedAgentField}] = '${escapeWiql(filters.assignedAgent)}'`);
      } else {
        clauses.push(
          `[${this.fields.tagsField}] CONTAINS '${escapeWiql(`${this.tags.assignedAgentPrefix}${filters.assignedAgent}`)}'`,
        );
      }
    }

    const wiql = [
      'SELECT [System.Id]',
      'FROM WorkItems',
      `WHERE ${clauses.join(' AND ')}`,
      'ORDER BY [System.ChangedDate] ASC',
    ].join(' ');

    const result = await this.runAzJson<AzureQueryResponse | AzureQueryWorkItem[]>([
      'boards',
      'query',
      '--project',
      this.config.project,
      '--org',
      this.config.organizationUrl,
      '--wiql',
      wiql,
      '--output',
      'json',
    ]);

    const workItems = Array.isArray(result) ? result : result.workItems ?? [];
    return workItems.map((item) => this.createRef(String(item.id), item.url));
  }

  public async getRelations(ref: WorkItemRef): Promise<Relation[]> {
    return (await this.getWorkItem(ref)).relations;
  }

  public async getDependencyStatus(ref: WorkItemRef): Promise<DependencyStatus> {
    const item = await this.getWorkItem(ref);
    const blockedByRefs = item.relations.filter((relation) => relation.type === 'blocked-by').map((relation) => relation.target);
    const blocksRefs = item.relations.filter((relation) => relation.type === 'blocks').map((relation) => relation.target);

    const [blockedByOpen, blocksOpen] = await Promise.all([
      this.filterOpenWorkItems(blockedByRefs),
      this.filterOpenWorkItems(blocksRefs),
    ]);

    return {
      blockedByOpen,
      blocksOpen,
    };
  }

  public async claim(ref: WorkItemRef, claim: ClaimInfo): Promise<void> {
    const item = await this.getRawWorkItem(toWorkItemId(ref));
    const tags = parseTags(item.fields?.[this.fields.tagsField]).filter((tag) => !tag.startsWith(this.tags.protocolStatePrefix));
    const nextTags = [...tags, this.tags.claimActiveTag];
    if (!this.fields.protocolStateField) {
      nextTags.push(`${this.tags.protocolStatePrefix}claimed`);
    }

    await this.updateWorkItem(toWorkItemId(ref), {
      fields: {
        ...this.buildProtocolStateFieldUpdate('claimed'),
        [this.fields.tagsField]: stringifyTags(nextTags),
      },
      discussion: formatClaimComment(claim),
    });
  }

  public async releaseClaim(ref: WorkItemRef, _claimToken: string): Promise<void> {
    const item = await this.getRawWorkItem(toWorkItemId(ref));
    const tags = parseTags(item.fields?.[this.fields.tagsField]).filter((tag) => tag !== this.tags.claimActiveTag);

    await this.updateWorkItem(toWorkItemId(ref), {
      fields: {
        [this.fields.tagsField]: stringifyTags(tags),
      },
      discussion: 'Agent claim released.',
    });
  }

  public async setProtocolState(ref: WorkItemRef, state: ProtocolState): Promise<void> {
    const item = await this.getRawWorkItem(toWorkItemId(ref));
    const tags = parseTags(item.fields?.[this.fields.tagsField])
      .filter((tag) => !tag.startsWith(this.tags.protocolStatePrefix))
      .concat(this.fields.protocolStateField ? [] : [`${this.tags.protocolStatePrefix}${state}`]);

    await this.updateWorkItem(toWorkItemId(ref), {
      fields: {
        ...this.buildProtocolStateFieldUpdate(state),
        ...(this.fields.protocolStateField ? {} : { [this.fields.tagsField]: stringifyTags(tags) }),
      },
    });
  }

  public async addComment(ref: WorkItemRef, body: string): Promise<void> {
    await this.updateWorkItem(toWorkItemId(ref), {
      discussion: body,
    });
  }

  public async createChild(parent: WorkItemRef, draft: Partial<WorkItem>): Promise<WorkItemRef> {
    const workItemType = this.resolveWorkItemType(draft);
    const fields = this.buildDraftFields(draft);

    const args = [
      'boards',
      'work-item',
      'create',
      '--org',
      this.config.organizationUrl,
      '--project',
      this.config.project,
      '--type',
      workItemType,
      '--title',
      draft.title ?? 'Untitled child work item',
      '--output',
      'json',
    ];

    if (draft.description) {
      args.push('--description', draft.description);
    }

    for (const [fieldName, value] of Object.entries(fields)) {
      args.push('--fields', `${fieldName}=${value}`);
    }

    const created = await this.runAzJson<AzureWorkItemResponse>(args);
    const childRef = this.createRef(String(created.id), created.url);
    await this.linkParentChild(parent, childRef);
    return childRef;
  }

  public async linkParentChild(parent: WorkItemRef, child: WorkItemRef): Promise<void> {
    const relationTypes = await this.getRelationTypeMapping();
    const relationType = relationTypes.child ?? 'child';

    await this.runAz([
      'boards',
      'work-item',
      'relation',
      'add',
      '--org',
      this.config.organizationUrl,
      '--id',
      String(toWorkItemId(parent)),
      '--relation-type',
      relationType,
      '--target-id',
      String(toWorkItemId(child)),
      '--output',
      'json',
    ]);
  }

  public async linkDependency(
    source: WorkItemRef,
    target: WorkItemRef,
    kind: 'blocks' | 'blocked-by',
  ): Promise<void> {
    const relationTypes = await this.getRelationTypeMapping();
    const relationType = kind === 'blocks' ? relationTypes.blocks : relationTypes.blockedBy;

    if (!relationType) {
      throw new Error(
        'Azure DevOps dependency relation type could not be determined automatically. Provide relationTypes.blocks and relationTypes.blockedBy in adapter configuration.',
      );
    }

    const sourceId = toWorkItemId(source);
    const targetId = toWorkItemId(target);
    const originId = kind === 'blocks' ? sourceId : sourceId;
    const linkedId = kind === 'blocks' ? targetId : targetId;

    await this.runAz([
      'boards',
      'work-item',
      'relation',
      'add',
      '--org',
      this.config.organizationUrl,
      '--id',
      String(originId),
      '--relation-type',
      relationType,
      '--target-id',
      String(linkedId),
      '--output',
      'json',
    ]);
  }

  public async attachPullRequest(ref: WorkItemRef, prUrl: string): Promise<void> {
    await this.addComment(ref, `Linked pull request: ${prUrl}`);
  }

  private async filterOpenWorkItems(refs: readonly WorkItemRef[]): Promise<WorkItemRef[]> {
    const results: WorkItemRef[] = [];
    for (const ref of refs) {
      const item = await this.getRawWorkItem(toWorkItemId(ref));
      const state = String(item.fields?.[this.fields.stateField] ?? '');
      if (state.toLowerCase() !== 'closed' && state.toLowerCase() !== 'done' && state.toLowerCase() !== 'removed') {
        results.push(this.createRef(String(item.id), item.url));
      }
    }
    return results;
  }

  private async getRawWorkItem(id: number): Promise<AzureWorkItemResponse> {
    return this.runAzJson<AzureWorkItemResponse>([
      'boards',
      'work-item',
      'show',
      '--id',
      String(id),
      '--org',
      this.config.organizationUrl,
      '--output',
      'json',
    ]);
  }

  private async getRawRelations(id: number): Promise<AzureWorkItemResponse> {
    return this.runAzJson<AzureWorkItemResponse>([
      'boards',
      'work-item',
      'relation',
      'show',
      '--id',
      String(id),
      '--org',
      this.config.organizationUrl,
      '--output',
      'json',
    ]);
  }

  private async getRelationTypeMapping(): Promise<AzureDevOpsRelationMapping> {
    if (this.relationTypeCache) {
      return this.relationTypeCache;
    }

    const configured = this.config.relationTypes ?? {};
    const result = await this.runAzJson<AzureRelationTypeInfo[]>([
      'boards',
      'work-item',
      'relation',
      'list-type',
      '--org',
      this.config.organizationUrl,
      '--output',
      'json',
    ]);

    const findByKeywords = (keywords: readonly string[]): string | undefined => {
      const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
      const match = result.find((entry) => {
        const candidates = [entry.name, entry.referenceName]
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.toLowerCase());
        return normalizedKeywords.every((keyword) => candidates.some((candidate) => candidate.includes(keyword)));
      });

      return match?.name ?? match?.referenceName;
    };

    const resolveRelationName = (configuredValue: string | undefined, fallback: string | undefined): string | undefined => {
      if (!configuredValue) return fallback;
      const match = result.find((entry) => entry.name === configuredValue || entry.referenceName === configuredValue);
      return match?.name ?? configuredValue;
    };

    const discovered: AzureDevOpsRelationMapping = {
      parent: resolveRelationName(configured.parent, findByKeywords(['parent'])) ?? 'parent',
      child: resolveRelationName(configured.child, findByKeywords(['child'])) ?? 'child',
      related: resolveRelationName(configured.related, findByKeywords(['related'])) ?? 'related',
      ...(configured.blockedBy || findByKeywords(['dependency', 'reverse']) || findByKeywords(['predecessor']) || findByKeywords(['blocked'])
        ? {
            blockedBy: resolveRelationName(
              configured.blockedBy,
              findByKeywords(['dependency', 'reverse']) ?? findByKeywords(['predecessor']) ?? findByKeywords(['blocked']),
            )!,
          }
        : {}),
      ...(configured.blocks || findByKeywords(['dependency', 'forward']) || findByKeywords(['successor']) || findByKeywords(['block'])
        ? {
            blocks: resolveRelationName(
              configured.blocks,
              findByKeywords(['dependency', 'forward']) ?? findByKeywords(['successor']) ?? findByKeywords(['block']),
            )!,
          }
        : {}),
    };

    this.relationTypeCache = discovered;
    return discovered;
  }

  private async updateWorkItem(
    id: number,
    update: {
      fields?: Record<string, string>;
      discussion?: string;
    },
  ): Promise<void> {
    const args = [
      'boards',
      'work-item',
      'update',
      '--id',
      String(id),
      '--org',
      this.config.organizationUrl,
      '--output',
      'json',
    ];

    if (update.discussion) {
      args.push('--discussion', update.discussion);
    }

    for (const [fieldName, value] of Object.entries(update.fields ?? {})) {
      args.push('--fields', `${fieldName}=${value}`);
    }

    await this.runAz(args);
  }

  private buildDraftFields(draft: Partial<WorkItem>): Record<string, string> {
    const fields: Record<string, string> = {};
    const tags: string[] = [...(draft.tags ?? [])];

    if (draft.executionMode && this.fields.executionModeField) {
      fields[this.fields.executionModeField] = draft.executionMode;
    } else if (draft.executionMode === 'agent') {
      tags.push(this.tags.executionAgentTag);
    } else if (draft.executionMode === 'human') {
      tags.push(this.tags.executionHumanTag);
    }

    if (typeof draft.readyForAgent === 'boolean' && this.fields.readyForAgentField) {
      fields[this.fields.readyForAgentField] = String(draft.readyForAgent);
    } else if (draft.readyForAgent) {
      tags.push(this.tags.readyForAgentTag);
    }

    if (draft.protocolState && this.fields.protocolStateField) {
      fields[this.fields.protocolStateField] = draft.protocolState;
    } else if (draft.protocolState) {
      tags.push(`${this.tags.protocolStatePrefix}${draft.protocolState}`);
    }

    if (draft.assignedAgent && this.fields.assignedAgentField) {
      fields[this.fields.assignedAgentField] = draft.assignedAgent;
    } else if (draft.assignedAgent) {
      tags.push(`${this.tags.assignedAgentPrefix}${draft.assignedAgent}`);
    }

    if (typeof draft.priority === 'number' && this.fields.priorityField) {
      fields[this.fields.priorityField] = String(draft.priority);
    } else if (typeof draft.priority === 'number') {
      tags.push(`${this.tags.priorityPrefix}${draft.priority}`);
    }

    if (tags.length > 0) {
      fields[this.fields.tagsField] = stringifyTags(tags);
    }

    return fields;
  }

  private buildProtocolStateFieldUpdate(state: ProtocolState): Record<string, string> {
    if (this.fields.protocolStateField) {
      return { [this.fields.protocolStateField]: state };
    }
    return {};
  }

  private resolveWorkItemType(draft: Partial<WorkItem>): string {
    if (draft.kind && this.config.workItemTypeByKind?.[draft.kind]) {
      return this.config.workItemTypeByKind[draft.kind] ?? this.config.defaultWorkItemType ?? 'Task';
    }

    return this.config.defaultWorkItemType ?? 'Task';
  }

  private async toRelationType(raw: AzureWorkItemRelation): Promise<RelationType | undefined> {
    const relationTypes = await this.getRelationTypeMapping();
    const candidate = `${raw.rel ?? ''} ${raw.name ?? ''} ${String(raw.attributes?.['name'] ?? '')}`.toLowerCase();

    if (candidate.includes((relationTypes.parent ?? '').toLowerCase()) || candidate.includes('parent')) {
      return 'parent';
    }
    if (candidate.includes((relationTypes.child ?? '').toLowerCase()) || candidate.includes('child')) {
      return 'child';
    }
    if (relationTypes.blockedBy && candidate.includes(relationTypes.blockedBy.toLowerCase())) {
      return 'blocked-by';
    }
    if (relationTypes.blocks && candidate.includes(relationTypes.blocks.toLowerCase())) {
      return 'blocks';
    }
    if (candidate.includes((relationTypes.related ?? '').toLowerCase()) || candidate.includes('related')) {
      return 'related';
    }
    return undefined;
  }

  private async toWorkItem(item: AzureWorkItemResponse, rawRelations: readonly AzureWorkItemRelation[]): Promise<WorkItem> {
    const fields = item.fields ?? {};
    const title = String(fields[this.fields.titleField] ?? '');
    const descriptionHtml = String(fields[this.fields.descriptionField] ?? '');
    const description = stripHtml(descriptionHtml);
    const tags = parseTags(fields[this.fields.tagsField]);

    const executionMode = this.fields.executionModeField
      ? String(fields[this.fields.executionModeField] ?? 'human') === 'agent'
        ? 'agent'
        : 'human'
      : tags.includes(this.tags.executionAgentTag)
        ? 'agent'
        : 'human';

    const readyForAgent = this.fields.readyForAgentField
      ? parseBooleanField(fields[this.fields.readyForAgentField]) ?? false
      : tags.includes(this.tags.readyForAgentTag);

    const protocolState = this.fields.protocolStateField
      ? normalizeProtocolState(String(fields[this.fields.protocolStateField] ?? 'draft'))
      : (() => {
          const tag = tags.find((entry) => entry.startsWith(this.tags.protocolStatePrefix));
          return tag ? normalizeProtocolState(tag.slice(this.tags.protocolStatePrefix.length)) : 'draft';
        })();

    const assignedAgent = this.fields.assignedAgentField
      ? String(fields[this.fields.assignedAgentField] ?? '') || undefined
      : (() => {
          const tag = tags.find((entry) => entry.startsWith(this.tags.assignedAgentPrefix));
          return tag ? tag.slice(this.tags.assignedAgentPrefix.length) : undefined;
        })();

    const priority = this.fields.priorityField
      ? Number.parseInt(String(fields[this.fields.priorityField] ?? ''), 10)
      : (() => {
          const tag = tags.find((entry) => entry.startsWith(this.tags.priorityPrefix));
          return tag ? Number.parseInt(tag.slice(this.tags.priorityPrefix.length), 10) : Number.NaN;
        })();

    const relations: Relation[] = [];
    for (const rawRelation of rawRelations) {
      const relationType = await this.toRelationType(rawRelation);
      if (!relationType) {
        continue;
      }

      const targetId =
        rawRelation.targetId ??
        rawRelation.id ??
        extractIdFromUrl(rawRelation.targetUrl ?? rawRelation.url ?? '');

      if (!targetId) {
        continue;
      }

      relations.push({
        type: relationType,
        target: this.createRef(String(targetId), rawRelation.targetUrl ?? rawRelation.url),
      });
    }

    const claim = parseClaimInfoFromDescription(descriptionHtml);
    const assignedHuman = stringifyAssignedTo(fields[this.fields.assignedToField]);
    const normalizedPriority = Number.isNaN(priority) ? undefined : priority;

    return {
      ref: this.createRef(String(item.id), item.url),
      title,
      description,
      ...(typeof normalizedPriority === 'number' ? { priority: normalizedPriority } : {}),
      executionMode,
      readyForAgent,
      protocolState,
      ...(claim ? { claim } : {}),
      ...(assignedHuman ? { assignedHuman } : {}),
      ...(assignedAgent ? { assignedAgent } : {}),
      tags,
      relations,
    };
  }

  private createRef(id: string, url?: string): WorkItemRef {
    return {
      platform: 'azure-devops',
      project: this.config.project,
      container: this.config.organizationUrl,
      id,
      ...(url ? { url } : {}),
    };
  }

  private async runAzJson<T>(args: string[]): Promise<T> {
    const result = await this.runAz(args);
    return parseJsonOutput<T>(result.stdout);
  }

  private async runAz(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await this.runner.run('az', args);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        throw new Error(`Azure DevOps CLI call failed: ${error.message}`);
      }
      throw error;
    }
  }
}

function stringifyAssignedTo(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const displayName = record.displayName;
    const uniqueName = record.uniqueName;
    if (typeof displayName === 'string' && displayName.trim() !== '') {
      return displayName;
    }
    if (typeof uniqueName === 'string' && uniqueName.trim() !== '') {
      return uniqueName;
    }
  }

  return undefined;
}

function escapeWiql(value: string): string {
  return value.replace(/'/g, "''");
}

function extractIdFromUrl(url: string): number | undefined {
  const match = url.match(/\/(\d+)(?:$|\?)/) ?? url.match(/\/(\d+)$/);
  if (!match) {
    return undefined;
  }

  const rawId = match[1];
  if (!rawId) {
    return undefined;
  }

  const id = Number.parseInt(rawId, 10);
  return Number.isNaN(id) ? undefined : id;
}
