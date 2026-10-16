/**
 * Obsidian-style callouts supported in question prompts and solution
 * explanations: `> [!tip] Optional title`. Rendered by
 * components/markdown-prose.tsx and linted by the content importer, so both
 * read the kinds from here.
 */
export const CALLOUT_KINDS = ['tip', 'info', 'warning', 'note'] as const;

export type CalloutKind = (typeof CALLOUT_KINDS)[number];

/** Matches a whole callout block: kind, optional title, then `>`-prefixed body lines. */
export const CALLOUT_RE = new RegExp(
  `^> \\[!(${CALLOUT_KINDS.join('|')})\\](?: (.+))?\\n((?:^> ?.*(?:\\n|$))*)`,
  'gm'
);

/** Common names from other markdown flavours, mapped to the closest supported kind. */
const ALIASES: Record<string, CalloutKind> = {
  warn: 'warning',
  caution: 'warning',
  danger: 'warning',
  important: 'note',
  hint: 'tip',
};

/**
 * Find callout-looking lines that the renderer won't treat as callouts —
 * they'd show up on the page as a plain quote with the raw `[!…]` text.
 * Lines inside fenced code blocks are skipped. Returns one message per
 * problem, prefixed with its 1-based line number.
 */
export function lintCallouts(markdown: string): string[] {
  const problems: string[] = [];
  let inFence = false;

  markdown.split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) return;

    const m = /^(\s*)>(\s*)\[!([^\]\s]*)\](.*)$/.exec(line);
    if (!m) return;
    const [, indent, gap, rawKind, rest] = m;
    const at = `line ${i + 1}`;
    const kind = rawKind.toLowerCase();
    const suggested: CalloutKind | undefined = (CALLOUT_KINDS as readonly string[]).includes(kind)
      ? (kind as CalloutKind)
      : ALIASES[kind];

    if (!suggested) {
      problems.push(`${at}: unknown callout [!${rawKind}] — use one of ${CALLOUT_KINDS.map((k) => `[!${k}]`).join(', ')}`);
      return;
    }
    if (rawKind !== suggested) {
      problems.push(`${at}: [!${rawKind}] won't render as a callout — use [!${suggested}]`);
      return;
    }
    if (indent || gap !== ' ') {
      problems.push(`${at}: write it as "> [!${suggested}]" — exactly one space after ">", no indent`);
      return;
    }
    if (rest && !rest.startsWith(' ')) {
      problems.push(`${at}: put a space between [!${suggested}] and its title`);
    }
  });

  return problems;
}
