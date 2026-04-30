import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadTrackerMappingFile,
  validateBacklogLanguageFile,
  validateTrackerMappingFile,
} from '../dist/language/validation.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('protocol language asset parses and validates through exported validator', () => {
  const result = validateBacklogLanguageFile(join(repoRoot, '.agent-stack/language/backlog-language.yaml'));

  assert.deepEqual(result, { ok: true, issues: [] });
});

test('agent-stack gitignore excludes local runtime state', () => {
  const content = readFileSync(join(repoRoot, '.agent-stack/.gitignore'), 'utf8');

  assert.match(content, /# AgentStack local runtime state/);
  assert.match(content, /^\.agent-stack\/local\/$/m);
  assert.match(content, /^\.agent-stack\/runs\/$/m);
});

test('tracker mapping assets parse, normalize, and validate through exported validators', () => {
  const githubPath = join(repoRoot, '.agent-stack/trackers/github.mapping.yaml');
  const azurePath = join(repoRoot, '.agent-stack/trackers/azure-devops.mapping.yaml');

  assert.deepEqual(validateTrackerMappingFile(githubPath, 'github'), { ok: true, issues: [] });
  assert.deepEqual(validateTrackerMappingFile(azurePath, 'azure-devops'), { ok: true, issues: [] });

  const githubMapping = loadTrackerMappingFile(githubPath);
  assert.equal(githubMapping.executionMode.agent.label, 'exec:agent');
  assert.equal(githubMapping.readiness.readyForAgent.label, 'ready:agent');
  assert.equal(githubMapping.relations['blocked-by']?.native, 'issue-dependencies');
});
