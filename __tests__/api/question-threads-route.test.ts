import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const findUnique = vi.fn();
const findMany = vi.fn();
const getCurrentUserFromRequest = vi.fn();
const getEntitlementContext = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    question: { findUnique: (...args: unknown[]) => findUnique(...args) },
    discussionThread: { findMany: (...args: unknown[]) => findMany(...args) }
  }
}));
vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUserFromRequest: (...args: unknown[]) => getCurrentUserFromRequest(...args)
}));
vi.mock('@/lib/auth/entitlement', async () => {
  const { canAccessQuestion } = await import('@/lib/entitlements/can-access');
  return {
    canAccessQuestion,
    getEntitlementContext: (...args: unknown[]) => getEntitlementContext(...args)
  };
});

const premiumQuestion = { id: 'q1', accessTier: 'PREMIUM', isPublished: true };

const threadRow = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  title: 'My approach',
  body: 'secret solution',
  _count: { comments: 2, likes: 3 },
  user: { profile: { displayName: 'Ada' } },
  ...overrides
});

async function call(id = 'q1') {
  const { GET } = await import('@/app/api/questions/[slug]/threads/route');
  const req = new NextRequest(`http://localhost/api/questions/${id}/threads`);
  return GET(req, { params: Promise.resolve({ slug: id }) });
}

describe('GET /api/questions/[id]/threads', () => {
  beforeEach(() => {
    findUnique.mockReset();
    findMany.mockReset().mockResolvedValue([threadRow()]);
    getCurrentUserFromRequest.mockReset().mockResolvedValue({ id: 'u1' });
    getEntitlementContext.mockReset().mockResolvedValue({ hasPro: false, unlockedPackQuestionIds: [] });
  });

  it('404 for a missing question', async () => {
    findUnique.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('404 for an unpublished question', async () => {
    findUnique.mockResolvedValue({ ...premiumQuestion, accessTier: 'FREE', isPublished: false });
    expect((await call()).status).toBe(404);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('403 for a PREMIUM question when signed out — no thread data in body', async () => {
    findUnique.mockResolvedValue(premiumQuestion);
    getCurrentUserFromRequest.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('403 for a PREMIUM question without entitlement', async () => {
    findUnique.mockResolvedValue(premiumQuestion);
    expect((await call()).status).toBe(403);
    expect(getEntitlementContext).toHaveBeenCalledWith('u1');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('200 for a PREMIUM question with Pro', async () => {
    findUnique.mockResolvedValue(premiumQuestion);
    getEntitlementContext.mockResolvedValue({ hasPro: true, unlockedPackQuestionIds: [] });
    expect((await call()).status).toBe(200);
  });

  it('200 for a PREMIUM question unlocked by a pack', async () => {
    findUnique.mockResolvedValue(premiumQuestion);
    getEntitlementContext.mockResolvedValue({ hasPro: false, unlockedPackQuestionIds: ['q1'] });
    expect((await call()).status).toBe(200);
  });

  it('200 for a FREE question while signed out, without resolving the session', async () => {
    findUnique.mockResolvedValue({ ...premiumQuestion, accessTier: 'FREE' });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: 't1', title: 'My approach', body: 'secret solution', author: 'Ada', commentsCount: 2, likesCount: 3 }
    ]);
    expect(getCurrentUserFromRequest).not.toHaveBeenCalled();
    expect(getEntitlementContext).not.toHaveBeenCalled();
  });

  it('never selects or returns the author email; falls back to Anonymous', async () => {
    findUnique.mockResolvedValue({ ...premiumQuestion, accessTier: 'FREE' });
    findMany.mockResolvedValue([
      threadRow({ user: { profile: null, email: 'leak@example.com' } }),
      threadRow({ id: 't2', user: { profile: { displayName: '  ' }, email: 'leak@example.com' } })
    ]);
    const res = await call();
    const body = await res.json();
    expect(body.map((t: { author: string }) => t.author)).toEqual(['Anonymous', 'Anonymous']);
    expect(JSON.stringify(body)).not.toContain('@');
    expect(findMany.mock.calls[0][0].include.user).toEqual({
      select: { profile: { select: { displayName: true } } }
    });
  });
});
