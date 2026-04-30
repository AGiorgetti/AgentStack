const sectionNames = [
  'acceptance criteria',
  'acceptance criterion',
  'acceptance',
  'done when',
  'definition of done',
] as const;

const sectionPattern = sectionNames.map(escapeRegExp).join('|');
const headingPattern = new RegExp(
  `^\\s{0,3}(?:#{1,6}\\s*)?(?:\\*\\*)?\\s*(?:${sectionPattern})\\s*(?:\\*\\*)?\\s*:?\\s*$`,
  'i',
);
const inlinePattern = new RegExp(
  `^\\s{0,3}(?:#{1,6}\\s*)?(?:\\*\\*)?\\s*(?:${sectionPattern})\\s*(?:\\*\\*)?\\s*:\\s*(.+?)\\s*$`,
  'i',
);

export function parseAcceptanceCriteria(description: string): string[] {
  const lines = normalizeDescription(description).split('\n');
  const criteria: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const inline = line.match(inlinePattern);
    if (inline?.[1]) {
      criteria.push(...splitCriterionText(inline[1]));
      continue;
    }

    if (!headingPattern.test(line)) {
      continue;
    }

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor] ?? '';
      if (isSectionBoundary(candidate)) {
        break;
      }

      const parsed = parseCriterionLine(candidate);
      if (parsed) {
        criteria.push(parsed);
      }
    }
  }

  return [...new Set(criteria.map(cleanCriterion).filter(Boolean))];
}

export function htmlToPlainText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(?:p|div|h[1-6]|li|ul|ol|br|blockquote|pre|tr)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeDescription(description: string): string {
  return htmlToPlainText(description)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
}

function parseCriterionLine(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }

  const bullet = trimmed.match(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.+)$/);
  if (bullet?.[1]) {
    return cleanCriterion(bullet[1]);
  }

  const checkbox = trimmed.match(/^\[[ xX]\]\s+(.+)$/);
  if (checkbox?.[1]) {
    return cleanCriterion(checkbox[1]);
  }

  return cleanCriterion(trimmed);
}

function splitCriterionText(text: string): string[] {
  return text
    .split(/\s*(?:;|\n)\s*/)
    .map(cleanCriterion)
    .filter(Boolean);
}

function cleanCriterion(text: string): string {
  return text
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^\*\*(.+)\*\*$/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSectionBoundary(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  if (headingPattern.test(trimmed)) {
    return false;
  }
  if (/^#{1,6}\s+\S/.test(trimmed)) {
    return true;
  }
  return /^[A-Z][A-Za-z0-9 /&()-]{1,60}:\s*$/.test(trimmed);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
