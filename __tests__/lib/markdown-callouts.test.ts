import { describe, expect, it } from 'vitest';
import { CALLOUT_KINDS, CALLOUT_RE, lintCallouts } from '@/lib/markdown-callouts';

describe('lintCallouts', () => {
  it.each(CALLOUT_KINDS)('accepts [!%s] with and without a title', (kind) => {
    expect(lintCallouts(`> [!${kind}]\n> body`)).toEqual([]);
    expect(lintCallouts(`> [!${kind}] Interview inspiration\n> body`)).toEqual([]);
  });

  it.each([
    ['[!warn]', 'line 1: [!warn] won\'t render as a callout — use [!warning]'],
    ['[!caution]', 'line 1: [!caution] won\'t render as a callout — use [!warning]'],
    ['[!INFO]', 'line 1: [!INFO] won\'t render as a callout — use [!info]'],
    ['[!Warning]', 'line 1: [!Warning] won\'t render as a callout — use [!warning]'],
    ['[!banana]', 'line 1: unknown callout [!banana] — use one of [!tip], [!info], [!warning], [!note]'],
  ])('flags %s', (tag, message) => {
    expect(lintCallouts(`> ${tag} Title\n> body`)).toEqual([message]);
  });

  it.each(['>[!info] Title', '>  [!info] Title', '  > [!info] Title'])('flags bad spacing: %j', (line) => {
    expect(lintCallouts(line)).toEqual([
      'line 1: write it as "> [!info]" — exactly one space after ">", no indent',
    ]);
  });

  it('flags a title glued to the kind', () => {
    expect(lintCallouts('> [!tip]Title')).toEqual(['line 1: put a space between [!tip] and its title']);
  });

  it('reports the right line and ignores fenced code', () => {
    const md = ['Intro', '', '```markdown', '> [!warn] example in a code block', '```', '', '> [!warn] real one'].join('\n');
    expect(lintCallouts(md)).toEqual(["line 7: [!warn] won't render as a callout — use [!warning]"]);
  });

  it('ignores ordinary blockquotes and inline mentions', () => {
    expect(lintCallouts('> just a quote\n\nUse `[!info]` for notes.')).toEqual([]);
  });

  it('agrees with the renderer: every clean callout is one CALLOUT_RE matches', () => {
    for (const kind of CALLOUT_KINDS) {
      const md = `> [!${kind}] Title\n> body\n`;
      expect(lintCallouts(md)).toEqual([]);
      expect([...md.matchAll(CALLOUT_RE)]).toHaveLength(1);
    }
  });
});
