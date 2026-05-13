import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { canonicalProtocolStates, canonicalRelationTypes, canonicalWorkItemTypes } from './canonical.js';
import type { BacklogLanguage, TrackerMapping } from './mapping.js';
import type { Platform } from '../model.js';

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export function loadBacklogLanguageFile(path: string): BacklogLanguage {
  return normalizeYamlDocument(parseYamlFile(path)) as BacklogLanguage;
}

export function loadTrackerMappingFile(path: string): TrackerMapping {
  return normalizeYamlDocument(parseYamlFile(path)) as TrackerMapping;
}

export function validateBacklogLanguageFile(path: string): ValidationResult {
  if (!existsSync(path)) {
    return { ok: false, issues: [{ path, message: 'Backlog language file is missing.' }] };
  }

  try {
    return validateBacklogLanguage(loadBacklogLanguageFile(path));
  } catch (error) {
    return {
      ok: false,
      issues: [{ path, message: `Failed to parse backlog language YAML: ${formatError(error)}` }],
    };
  }
}

export function validateTrackerMappingFile(path: string, expectedTracker?: Platform | string): ValidationResult {
  if (!existsSync(path)) {
    return { ok: false, issues: [{ path, message: 'Tracker mapping file is missing.' }] };
  }

  try {
    return validateTrackerMapping(loadTrackerMappingFile(path), expectedTracker);
  } catch (error) {
    return {
      ok: false,
      issues: [{ path, message: `Failed to parse tracker mapping YAML: ${formatError(error)}` }],
    };
  }
}

export function validateBacklogLanguage(language: BacklogLanguage): ValidationResult {
  const issues: ValidationIssue[] = [];
  const document = asRecord(language);

  requireRecord(document, 'language', issues);
  const canonicalTypes = requireRecord(document, 'canonicalTypes', issues);
  const canonicalStates = requireRecord(document, 'canonicalStates', issues);
  const canonicalRelations = requireRecord(document, 'canonicalRelations', issues);

  for (const kind of canonicalWorkItemTypes) {
    if (!isRecord(canonicalTypes[kind])) {
      issues.push({ path: `canonicalTypes.${kind}`, message: 'Missing canonical work item type definition.' });
    }
  }

  for (const state of canonicalProtocolStates) {
    if (!isRecord(canonicalStates[state])) {
      issues.push({ path: `canonicalStates.${state}`, message: 'Missing canonical protocol state definition.' });
    }
  }

  for (const relation of canonicalRelationTypes) {
    if (!isRecord(canonicalRelations[relation])) {
      issues.push({ path: `canonicalRelations.${relation}`, message: 'Missing canonical relation definition.' });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function validateTrackerMapping(mapping: TrackerMapping, expectedTracker?: Platform | string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const document = asRecord(mapping);

  if (expectedTracker && document.tracker !== expectedTracker) {
    issues.push({ path: 'tracker', message: `Mapping tracker must be ${expectedTracker}.` });
  }

  if (document.tracker !== 'github' && document.tracker !== 'azure-devops') {
    issues.push({ path: 'tracker', message: 'Tracker must be github or azure-devops.' });
  }

  const workItem = requireRecord(document, 'workItem', issues);
  if (typeof workItem.nativeEntity !== 'string' || workItem.nativeEntity.trim() === '') {
    issues.push({ path: 'workItem.nativeEntity', message: 'Missing native work item entity name.' });
  }

  const types = requireRecord(document, 'types', issues);
  const executionMode = requireRecord(document, 'executionMode', issues);
  const readiness = requireRecord(document, 'readiness', issues);
  const protocolStates = requireRecord(document, 'protocolStates', issues);
  const relations = requireRecord(document, 'relations', issues);

  for (const kind of canonicalWorkItemTypes) {
    if (!isRecord(types[kind])) {
      issues.push({ path: `types.${kind}`, message: 'Missing tracker type mapping.' });
    }
  }

  if (!isRecord(executionMode.agent)) {
    issues.push({ path: 'executionMode.agent', message: 'Missing agent execution mode mapping.' });
  }

  if (!isRecord(executionMode.human)) {
    issues.push({ path: 'executionMode.human', message: 'Missing human execution mode mapping.' });
  }

  if (!isRecord(readiness.readyForAgent)) {
    issues.push({ path: 'readiness.readyForAgent', message: 'Missing ready-for-agent mapping.' });
  }

  if (typeof protocolStates.field === 'string') {
    if (protocolStates.field.trim() === '') {
      issues.push({ path: 'protocolStates.field', message: 'Protocol state field mapping is empty.' });
    }
  } else {
    for (const state of canonicalProtocolStates) {
      if (!isRecord(protocolStates[state])) {
        issues.push({ path: `protocolStates.${state}`, message: 'Missing protocol state mapping.' });
      }
    }
  }

  for (const relation of canonicalRelationTypes) {
    if (!isRecord(relations[relation])) {
      issues.push({ path: `relations.${relation}`, message: 'Missing relation mapping.' });
    }
  }

  return { ok: issues.length === 0, issues };
}

function parseYamlFile(path: string): unknown {
  return parse(readFileSync(path, 'utf8')) as unknown;
}

function normalizeYamlDocument(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeYamlDocument(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    normalized[toCamelKey(key)] = normalizeYamlDocument(entry);
  }
  return normalized;
}

function toCamelKey(key: string): string {
  return key.replace(/_([a-zA-Z0-9])/g, (_match, character: string) => character.toUpperCase());
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function requireRecord(
  parent: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
): Record<string, unknown> {
  const value = parent[key];
  if (!isRecord(value)) {
    issues.push({ path: key, message: `Missing ${key}.` });
    return {};
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
