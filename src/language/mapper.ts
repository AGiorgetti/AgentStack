import type { ProtocolState, WorkItemKind } from '../model.js';
import type { TrackerMapping, TrackerStateMapping, TrackerTypeMapping } from './mapping.js';

export function mapLabelsToWorkItemKind(labels: readonly string[], mapping: TrackerMapping): WorkItemKind | undefined {
  const labelSet = new Set(labels);
  for (const [kind, entry] of Object.entries(mapping.types) as [WorkItemKind, TrackerTypeMapping][]) {
    if ('label' in entry && labelSet.has(entry.label)) {
      return kind;
    }
    if ('tag' in entry && labelSet.has(entry.tag)) {
      return kind;
    }
  }
  return undefined;
}

export function mapLabelsToProtocolState(labels: readonly string[], mapping: TrackerMapping): ProtocolState | undefined {
  const stateMapping = mapping.protocolStates;
  const labelSet = new Set(labels);
  if ('field' in stateMapping) {
    const prefix = stateMapping.fallbackTagPrefix;
    if (!prefix) return undefined;
    for (const label of labelSet) {
      if (label.startsWith(prefix)) {
        return label.slice(prefix.length) as ProtocolState;
      }
    }
    return undefined;
  }
  for (const [state, entry] of Object.entries(stateMapping) as [ProtocolState, TrackerStateMapping][]) {
    if ('label' in entry && labelSet.has(entry.label)) {
      return state;
    }
  }
  return undefined;
}

export function hasReadyForAgent(labels: readonly string[], mapping: TrackerMapping): boolean | undefined {
  const readiness = mapping.readiness.readyForAgent;
  if ('label' in readiness) {
    return labels.includes(readiness.label);
  }
  if ('fallbackTag' in readiness && readiness.fallbackTag) {
    return labels.includes(readiness.fallbackTag);
  }
  return undefined;
}
