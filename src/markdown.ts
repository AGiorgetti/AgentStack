export function normalizeMarkdown(value: string): string {
  const trimmed = value.replace(/\r\n?/g, '\n').trim();
  if (!trimmed) {
    return '';
  }

  const labeledSections = parseLabeledSections(trimmed);
  if (labeledSections) {
    return labeledSections;
  }

  const lines = trimmed.split('\n').map((line) => line.trimEnd());
  if (lines.length > 1 || looksLikeMarkdown(trimmed)) {
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const sentences = splitInlineItems(trimmed);
  if (sentences.length <= 1) {
    return trimmed;
  }

  return sentences.map((entry) => `- ${entry}`).join('\n');
}

export function ensureMarkdownSection(title: string, body: string): string {
  const normalized = normalizeMarkdown(body);
  return `<!-- agentstack-protocol:${title} -->\n## AgentStack Protocol: ${title}\n\n${normalized}\n`;
}

function looksLikeMarkdown(value: string): boolean {
  return /(^|\n)\s{0,3}#{1,6}\s+\S/.test(value) ||
    /(^|\n)\s*(?:[-*+]|\d+[.)])\s+\S/.test(value) ||
    /(^|\n)\s*>\s+\S/.test(value) ||
    /(^|\n)\s*```/.test(value) ||
    /\[[^\]]+\]\([^)]+\)/.test(value);
}

function splitInlineItems(value: string): string[] {
  return value
    .split(/\s*;\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseLabeledSections(value: string): string | undefined {
  if (value.includes('\n')) {
    return undefined;
  }

  const matches = [...value.matchAll(/(?:^|\s)([A-Z][A-Za-z /-]{1,40}?):\s/g)];
  if (matches.length < 2 || matches[0]?.index !== 0) {
    return undefined;
  }

  const sections = matches.map((match, index) => {
    const title = match[1] ?? '';
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = matches[index + 1]?.index ?? value.length;
    return {
      title: title.trim(),
      content: value.slice(contentStart, contentEnd).trim(),
    };
  }).filter((section) => section.title && section.content);

  if (sections.length < 2) {
    return undefined;
  }

  return sections
    .map((section) => `### ${section.title}\n\n${formatSectionContent(section.content)}`)
    .join('\n\n');
}

function formatSectionContent(value: string): string {
  const items = splitInlineItems(value);
  if (items.length > 1) {
    return items.map((entry) => `- ${entry}`).join('\n');
  }
  return value;
}
