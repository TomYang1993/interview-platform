import { beforeEach, describe, expect, it, vi } from 'vitest';

const findMany = vi.fn();
const findFirst = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    question: {
      findMany: (...a: unknown[]) => findMany(...a),
      findFirst: (...a: unknown[]) => findFirst(...a)
    }
  }
}));
vi.mock('@/lib/auth/entitlement', () => ({ canAccessQuestion: vi.fn(), getEntitlementContext: vi.fn() }));

import { getLatestQuestion, isNewQuestion, listWhatsNew, NEW_QUESTION_DAYS } from '@/lib/questions';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-12T12:00:00Z');

const row = (slug: string, publishedAt: Date | null, companies: string[] = []) => ({
  slug,
  title: slug.toUpperCase(),
  publishedAt,
  renderData: { description: `About ${slug}`, companies, tags: [] }
});

describe('isNewQuestion', () => {
  it('is new inside the window and not at or after it', () => {
    expect(isNewQuestion(new Date(now.getTime() - DAY), now)).toBe(true);
    expect(isNewQuestion(new Date(now.getTime() - (NEW_QUESTION_DAYS * DAY - 1)), now)).toBe(true);
    expect(isNewQuestion(new Date(now.getTime() - NEW_QUESTION_DAYS * DAY), now)).toBe(false);
  });

  it('undated questions are never new', () => {
    expect(isNewQuestion(null, now)).toBe(false);
  });
});

describe('listWhatsNew', () => {
  beforeEach(() => {
    findMany.mockReset();
    vi.useFakeTimers().setSystemTime(now);
  });

  it('orders by publishedAt desc with undated questions last, and pages by offset', async () => {
    findMany.mockResolvedValue([row('a', new Date(now.getTime() - DAY)), row('b', null), row('c', null)]);
    const page = await listWhatsNew(4, 2);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      // Marketing page: only questions with at least one company tag.
      where: { isPublished: true, tags: { some: { tag: { kind: 'COMPANY' } } } },
      orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }],
      skip: 4,
      take: 3
    }));
    // Fetched one extra row, so there is another page.
    expect(page.nextOffset).toBe(6);
    expect(page.items.map((i) => i.slug)).toEqual(['a', 'b']);
  });

  it('maps description, companies and isNew; last page has no nextOffset', async () => {
    findMany.mockResolvedValue([
      row('largest-tree-root', new Date(now.getTime() - DAY), ['Microsoft', 'Google', 'Goldman Sachs']),
      row('old', null)
    ]);
    const page = await listWhatsNew(0, 12);
    expect(page.nextOffset).toBeNull();
    expect(page.items).toEqual([
      {
        slug: 'largest-tree-root',
        title: 'LARGEST-TREE-ROOT',
        description: 'About largest-tree-root',
        companies: ['Microsoft', 'Google', 'Goldman Sachs'],
        isNew: true
      },
      { slug: 'old', title: 'OLD', description: 'About old', companies: [], isNew: false }
    ]);
  });
});

describe('getLatestQuestion', () => {
  beforeEach(() => findFirst.mockReset());

  it('returns the most recently published dated question', async () => {
    findFirst.mockResolvedValue(row('largest-tree-root', now, ['Microsoft']));
    expect(await getLatestQuestion()).toEqual({
      slug: 'largest-tree-root',
      title: 'LARGEST-TREE-ROOT',
      companies: ['Microsoft']
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { isPublished: true, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' }
    }));
  });

  it('returns null when nothing has a publish date yet', async () => {
    findFirst.mockResolvedValue(null);
    expect(await getLatestQuestion()).toBeNull();
  });
});
