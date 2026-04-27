import type { Platform, ProtocolState, RelationType, WorkItemKind } from '../model.js';

export type LabelMapping = {
  label: string;
};

export type FieldMapping = {
  field: string;
  value?: string | number | boolean;
  fallbackTag?: string;
};

export type TrackerTypeMapping =
  | LabelMapping
  | { workItemType: string | string[] }
  | { tag: string };

export type TrackerStateMapping =
  | LabelMapping
  | { field: string; value?: string; fallbackTagPrefix?: string };

export type TrackerRelationMapping =
  | { native: string }
  | { relationType: string };

export interface TrackerMapping {
  version: number;
  tracker: Platform;
  workItem: {
    nativeEntity: string;
  };
  types: Partial<Record<WorkItemKind, TrackerTypeMapping>>;
  executionMode: {
    agent: LabelMapping | FieldMapping;
    human: LabelMapping | FieldMapping;
  };
  readiness: {
    readyForAgent: LabelMapping | FieldMapping;
  };
  protocolStates: Partial<Record<ProtocolState, TrackerStateMapping>> | {
    field: string;
    fallbackTagPrefix?: string;
  };
  priority?: Record<string, unknown>;
  relations: Partial<Record<RelationType, TrackerRelationMapping>> & Record<string, unknown>;
  agentAssignment?: Record<string, unknown>;
  claim?: Record<string, unknown>;
}

export interface BacklogLanguage {
  version: number;
  language: Record<string, { description: string }>;
  canonicalTypes: Partial<Record<WorkItemKind, { description: string }>>;
  canonicalStates: Partial<Record<ProtocolState, { description: string }>>;
  canonicalRelations: Partial<Record<RelationType, { inverse: RelationType }>>;
  readinessTerms?: Record<string, { description: string }>;
}
