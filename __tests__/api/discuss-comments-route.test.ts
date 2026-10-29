import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const findUnique = vi.fn();
const create = vi.fn();
const requireUser = vi.fn();
const getEntitlementContext = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    discussionThread: { findUnique: (...args: unknown[]) => findUnique(...args) },
    discussionComment: { create: (...args: unknown[]) => create(...args) }
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

const thread = (status = 'ACTIVE', question: Record<string, unknown> = {}) => ({
  status,
  question: { id: 'q1', accessTier: 'PREMIUM', isPublished: true, ...question }
});

async function call(body: unknown = { threadId: 't1', body: 'Nice one' }) {
  const { POST } = await import('@/app/api/discuss/comments/route');
  const req = new NextRequest('http://localhost/api/discuss/comments', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return POST(req);
}

describe('POST /api/discuss/comments', () => {
  beforeEach(() => {
    findUnique.mockReset();
    create.mockReset().mockImplementation(({ data }) => Promise.resolve({ id: 'c1', ...data }));
    requireUser.mockReset().mockResolvedValue({ id: 'u1', email: 'me@example.com' });
    getEntitlementContext.mockReset().mockResolvedValue({ hasPro: false, unlockedPackQuestionIds: [] });
  });

  it('401 when signed out', async () => {
    requireUser.mockRejectedValue(new Error('UNAUTHENTICATED'));
    expect((await call()).status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('404 for a missing thread', async () => {
    findUnique.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('404 for a hidden thread', async () => {
    findUnique.mockResolvedValue(thread('HIDDEN', { accessTier: 'FREE' }));
    expect((await call()).status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('404 when the thread belongs to an unpublished question', async () => {
    findUnique.mockResolvedValue(thread('ACTIVE', { accessTier: 'FREE', isPublished: false }));
    expect((await call()).status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it('403 on a PREMIUM question without entitlement', async () => {
    findUnique.mockResolvedValue(thread());
    expect((await call()).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('403 on a locked thread', async () => {
    findUnique.mockResolvedValue(thread('LOCKED', { accessTier: 'FREE' }));
    expect((await call()).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('201 on a PREMIUM question unlocked by a pack', async () => {
    findUnique.mockResolvedValue(thread());
    getEntitlementContext.mockResolvedValue({ hasPro: false, unlockedPackQuestionIds: ['q1'] });
    expect((await call()).status).toBe(201);
  });

  it('201 on a FREE question without checking entitlements; response carries no email', async () => {
    findUnique.mockResolvedValue(thread('ACTIVE', { accessTier: 'FREE' }));
    const res = await call();
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith({
      data: { threadId: 't1', userId: 'u1', body: 'Nice one', parentId: undefined }
    });
    expect(JSON.stringify(await res.json())).not.toContain('@');
    expect(getEntitlementContext).not.toHaveBeenCalled();
  });
});
