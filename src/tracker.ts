import type {
  ClaimInfo,
  DependencyStatus,
  ProtocolState,
  Relation,
  WorkItem,
  WorkItemRef,
} from './model.js';

export interface EligibleWorkQuery {
  executionMode?: 'agent';
  readyForAgent?: true;
  assignedAgent?: string;
}

export interface TrackerAdapter {
  getWorkItem(ref: WorkItemRef): Promise<WorkItem>;
  queryEligibleWork(filters?: EligibleWorkQuery): Promise<WorkItemRef[]>;

  getRelations(ref: WorkItemRef): Promise<Relation[]>;
  getDependencyStatus(ref: WorkItemRef): Promise<DependencyStatus>;

  claim(ref: WorkItemRef, claim: ClaimInfo): Promise<void>;
  releaseClaim(ref: WorkItemRef, claimToken: string): Promise<void>;

  setProtocolState(ref: WorkItemRef, state: ProtocolState): Promise<void>;
  addComment(ref: WorkItemRef, body: string): Promise<void>;

  createChild(parent: WorkItemRef, draft: Partial<WorkItem>): Promise<WorkItemRef>;
  linkParentChild(parent: WorkItemRef, child: WorkItemRef): Promise<void>;
  linkDependency(source: WorkItemRef, target: WorkItemRef, kind: 'blocks' | 'blocked-by'): Promise<void>;

  attachPullRequest(ref: WorkItemRef, prUrl: string): Promise<void>;
}
