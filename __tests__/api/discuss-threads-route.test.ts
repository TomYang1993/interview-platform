import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const findUnique = vi.fn();
const create = vi.fn();
const requireUser = vi.fn();
const getEntitlementContext = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    question: { findUnique: (...args: unknown[]) => findUnique(...args) },
    discussionThread: { create: (...args: unknown[]) => create(...args) }
  }
}));
vi.mock('@/lib/auth/current-user', () => ({
  requireUser: (...args: unknown[]) => requireUser(...args)
}));
vi.mock('@/lib/auth/entitlement', async () => {
  const { canAccessQuestion } = await import('@/lib/entitlements/can-access');
  return {
    canAccessQuestion,
    getEntitlementContext: (...args: unknown[]) => getEntitlementContext(...args)
  };
});

const premiumQuestion = { id: 'q1', accessTier: 'PREMIUM', isPublished: true };
const payload = { questionId: 'q1', title: 'My approach', body: 'Use a heap here' };

async function call(body: unknown = payload) {
  const { POST } = await import('@/app/api/discuss/threads/route');
  const req = new NextRequest('http://localhost/api/discuss/threads', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return POST(req);
}

describe('POST /api/discuss/threads', () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset().mockImplementation(({ data }) => Promise.resolve({ id: 't1', ...data }));
    requireUser.mockReset().mockResolvedValue({ id: 'u1', email: 'me@example.com' });
    getEntitlementContext.mockReset().mockResolvedValue({ hasPro: false, unlockedPackQuestionIds: [] });
  });

  it('401 when signed out', async () => {
    requireUser.mockRejectedValue(new Error('UNAUTHENTICATED'));
    expect((await call()).status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it('404 for a missing question', async () => {
    findUnique.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('404 for an unpublished question', async () => {
    findUnique.mockResolvedValue({ ...premiumQuestion, accessTier: 'FREE', isPublished: false });
    expect((await call()).status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('403 for a PREMIUM question without entitlement', async () => {
    findUnique.mockResolvedValue(premiumQuestion);
    expect((await call()).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('201 for a PREMIUM question with Pro', async () => {
    findUnique.mockResolvedValue(premiumQuestion);
    getEntitlementContext.mockResolvedValue({ hasPro: true, unlockedPackQuestionIds: [] });
    expect((await call()).status).toBe(201);
  });

  it('201 for a FREE question without checking entitlements; response carries no email', async () => {
    findUnique.mockResolvedValue({ ...premiumQuestion, accessTier: 'FREE' });
    const res = await call();
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith({
      data: { questionId: 'q1', userId: 'u1', title: 'My approach', body: 'Use a heap here' }
    });
    expect(JSON.stringify(await res.json())).not.toContain('@');
    expect(getEntitlementContext).not.toHaveBeenCalled();
  });
});
