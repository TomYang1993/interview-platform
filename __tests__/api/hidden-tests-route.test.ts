import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const findUnique = vi.fn();
const requireUser = vi.fn();
const getEntitlementContext = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: { question: { findUnique: (...args: unknown[]) => findUnique(...args) } }
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

const pythonQuestion = {
  id: 'q1',
  accessTier: 'PREMIUM',
  isPublished: true,
  hiddenTestCode: null,
  hiddenTestCases: [{ name: 'secret', args: [1], expected: 2 }],
  language: 'python',
  functionName: 'solve'
};

async function call(id = 'q1') {
  const { GET } = await import('@/app/api/questions/[slug]/hidden-tests/route');
  const req = new NextRequest(`http://localhost/api/questions/${id}/hidden-tests`);
  return GET(req, { params: Promise.resolve({ slug: id }) });
}

describe('GET /api/questions/[id]/hidden-tests', () => {
  beforeEach(() => {
    findUnique.mockReset();
    requireUser.mockReset().mockResolvedValue({ id: 'u1' });
    getEntitlementContext.mockReset().mockResolvedValue({ hasPro: false, unlockedPackQuestionIds: [] });
  });

  it('401 when signed out', async () => {
    requireUser.mockRejectedValue(new Error('unauthenticated'));
    expect((await call()).status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('404 for a missing question', async () => {
    findUnique.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });

  it('404 for an unpublished question', async () => {
    findUnique.mockResolvedValue({ ...pythonQuestion, accessTier: 'FREE', isPublished: false });
    expect((await call()).status).toBe(404);
  });

  it('403 for a PREMIUM question without entitlement — no test data in body', async () => {
    findUnique.mockResolvedValue(pythonQuestion);
    const res = await call();
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });

  it('200 for a PREMIUM question with Pro', async () => {
    findUnique.mockResolvedValue(pythonQuestion);
    getEntitlementContext.mockResolvedValue({ hasPro: true, unlockedPackQuestionIds: [] });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      language: 'python',
      functionName: 'solve',
      testCases: pythonQuestion.hiddenTestCases
    });
  });

  it('200 for a PREMIUM question unlocked by a pack', async () => {
    findUnique.mockResolvedValue(pythonQuestion);
    getEntitlementContext.mockResolvedValue({ hasPro: false, unlockedPackQuestionIds: ['q1'] });
    expect((await call()).status).toBe(200);
  });

  it('200 for a FREE question without checking entitlements', async () => {
    findUnique.mockResolvedValue({
      ...pythonQuestion,
      accessTier: 'FREE',
      language: null,
      hiddenTestCode: 'test("x", () => {})'
    });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ testCode: 'test("x", () => {})' });
    expect(getEntitlementContext).not.toHaveBeenCalled();
  });
});
