export const BLOCK_BEGIN = "<!-- TEMPLATE:BEGIN";
export const BLOCK_END = "<!-- TEMPLATE:END";

export function applyManagedBlock(
  original: string,
  blockId: string,
  blockContent: string,
): { content: string; changed: boolean; malformed: boolean } {
  const beginTag = `${BLOCK_BEGIN} ${blockId} -->`;
  const endTag = `${BLOCK_END} ${blockId} -->`;
  const block = `${beginTag}\n${blockContent.trimEnd()}\n${endTag}`;

  const beginIndex = original.indexOf(beginTag);
  const endIndex = original.indexOf(endTag);

  if (beginIndex === -1 && endIndex === -1) {
    const trimmed = original.trimEnd();
    const separator = trimmed.length > 0 ? "\n\n" : "";
    return {
      content: `${trimmed}${separator}${block}\n`,
      changed: true,
      malformed: false,
    };
  }

  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
    return { content: original, changed: false, malformed: true };
  }

  const before = original.slice(0, beginIndex).trimEnd();
  const after = original.slice(endIndex + endTag.length).trimStart();
  const updated = `${before}\n\n${block}\n\n${after}`.trimEnd() + "\n";
  return { content: updated, changed: updated !== original, malformed: false };
}

export function detectMalformedBlocks(content: string): boolean {
  const beginMatches = content.match(/<!-- TEMPLATE:BEGIN /g)?.length ?? 0;
  const endMatches = content.match(/<!-- TEMPLATE:END /g)?.length ?? 0;
  if (beginMatches !== endMatches) {
    return true;
  }

  const beginIndices = content.split(BLOCK_BEGIN).length - 1;
  const endIndices = content.split(BLOCK_END).length - 1;
  return beginIndices !== endIndices;
}
