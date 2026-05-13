import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureMarkdownSection, normalizeMarkdown } from '../dist/markdown.js';

test('normalizeMarkdown converts semicolon-separated inline text to bullets', () => {
  assert.equal(
    normalizeMarkdown('Smoke claim works; Smoke progress works; Smoke submit-review works'),
    '- Smoke claim works\n- Smoke progress works\n- Smoke submit-review works',
  );
});

test('normalizeMarkdown preserves existing markdown structure', () => {
  assert.equal(
    normalizeMarkdown('## Summary\n\n- One\n- Two'),
    '## Summary\n\n- One\n- Two',
  );
});

test('ensureMarkdownSection wraps normalized markdown in protocol heading', () => {
  assert.equal(
    ensureMarkdownSection('progress', 'Parser done; tests pass'),
    '<!-- agentstack-protocol:progress -->\n## AgentStack Protocol: progress\n\n- Parser done\n- tests pass\n',
  );
});

test('normalizeMarkdown converts label-prefixed prose to sections', () => {
  assert.equal(
    normalizeMarkdown('Outcome: complete smoke workflow. Steps: claim; plan; submit review. Validation: doctor passes.'),
    '### Outcome\n\ncomplete smoke workflow.\n\n### Steps\n\n- claim\n- plan\n- submit review.\n\n### Validation\n\ndoctor passes.',
  );
});
