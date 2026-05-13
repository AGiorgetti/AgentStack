import type { ProtocolState, RelationType, WorkItemKind } from '../model.js';

export type CanonicalWorkItemType = WorkItemKind;

export type CanonicalReadinessTerm =
  | 'ready-for-planning'
  | 'ready-for-agent'
  | 'ready-for-review'
  | 'ready-for-merge';

export type CanonicalConcept =
  | 'work-item'
  | 'executable-work-item'
  | 'execution-mode'
  | 'ready-for-agent'
  | 'protocol-state'
  | 'claim'
  | 'blocker'
  | 'submit-review'
  | 'review';

export const canonicalWorkItemTypes = [
  'epic',
  'feature',
  'story',
  'task',
  'bug',
  'spike',
] as const satisfies readonly CanonicalWorkItemType[];

export const canonicalProtocolStates = [
  'draft',
  'ready',
  'claimed',
  'implementing',
  'blocked',
  'pr-open',
  'in-review',
  'done',
  'abandoned',
] as const satisfies readonly ProtocolState[];

export const canonicalRelationTypes = [
  'parent',
  'child',
  'blocks',
  'blocked-by',
  'related',
] as const satisfies readonly RelationType[];

export const relationInverses: Readonly<Record<RelationType, RelationType>> = {
  parent: 'child',
  child: 'parent',
  blocks: 'blocked-by',
  'blocked-by': 'blocks',
  related: 'related',
};
