export type Platform = 'github' | 'azure-devops';

export type WorkItemKind =
  | 'epic'
  | 'feature'
  | 'story'
  | 'task'
  | 'bug'
  | 'spike';

export type ExecutionMode = 'human' | 'agent';

export type ProtocolState =
  | 'draft'
  | 'ready'
  | 'claimed'
  | 'implementing'
  | 'blocked'
  | 'pr-open'
  | 'in-review'
  | 'done'
  | 'abandoned';

export type RelationType =
  | 'parent'
  | 'child'
  | 'blocks'
  | 'blocked-by'
  | 'related';

export interface WorkItemRef {
  platform: Platform;
  project: string;
  container: string;
  id: string;
  url?: string;
}

export interface Relation {
  type: RelationType;
  target: WorkItemRef;
}

export interface ClaimInfo {
  agentId: string;
  claimToken: string;
  claimedAt: string;
  branchName?: string;
  workspaceId?: string;
}

export interface WorkItem {
  ref: WorkItemRef;
  kind?: WorkItemKind;
  title: string;
  description: string;
  priority?: number;
  executionMode: ExecutionMode;
  readyForAgent: boolean;
  protocolState: ProtocolState;
  claim?: ClaimInfo;
  assignedHuman?: string;
  assignedAgent?: string;
  acceptanceCriteria?: string[];
  tags?: string[];
  relations: Relation[];
}

export interface DependencyStatus {
  blockedByOpen: WorkItemRef[];
  blocksOpen: WorkItemRef[];
}
