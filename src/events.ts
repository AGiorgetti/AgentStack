import type { ClaimInfo, ProtocolState, WorkItemRef } from './model.js';

export interface BaseProtocolEvent<K extends string = string> {
  kind: K;
  workItem: WorkItemRef;
  timestamp: string;
}

export interface ClaimEvent extends BaseProtocolEvent<'claim'> {
  agentId: string;
  claim: ClaimInfo;
}

export interface ClaimReleaseEvent extends BaseProtocolEvent<'claim-release'> {
  claimToken: string;
}

export interface StateChangeEvent extends BaseProtocolEvent<'state-change'> {
  state: ProtocolState;
}

export interface ExecutionPlanEvent extends BaseProtocolEvent<'execution-plan'> {
  plan: string;
}

export interface ProgressEvent extends BaseProtocolEvent<'progress'> {
  message: string;
}

export interface BlockerEvent extends BaseProtocolEvent<'blocker'> {
  reason: string;
  needsHumanDecision: boolean;
}

export interface SubmitReviewEvent extends BaseProtocolEvent<'submit-review'> {
  prUrl: string;
  summary: string;
}

export interface CreateChildEvent extends BaseProtocolEvent<'create-child'> {
  child: WorkItemRef;
}

export type ProtocolEvent =
  | ClaimEvent
  | ClaimReleaseEvent
  | StateChangeEvent
  | ExecutionPlanEvent
  | ProgressEvent
  | BlockerEvent
  | SubmitReviewEvent
  | CreateChildEvent;

export type ProtocolEventKind = ProtocolEvent['kind'];

export type ProtocolEventPayload<K extends ProtocolEventKind> = Omit<
  Extract<ProtocolEvent, { kind: K }>,
  keyof BaseProtocolEvent
>;
