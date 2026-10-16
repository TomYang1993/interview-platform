import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const findUnique = vi.fn();
const getCurrentUserFromRequest = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: { question: { findUnique: (...args: unknown[]) => findUnique(...args) } }
}));
vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUserFromRequest: (...args: unknown[]) => getCurrentUserFromRequest(...args)
}));
vi.mock('@/lib/auth/entitlement', async () => {
  const { canAccessQuestion } = await import('@/lib/entitlements/can-access');
  return { canAccessQuestion, getEntitlementContext: vi.fn() };
});

const thread = (id: string, user: Record<string, unknown>) => ({
  id,
  title: 'My approach',
  body: 'Use a heap',
  createdAt: new Date('2026-01-01'),
  user,
  _count: { comments: 0, likes: 0 }
});

async function call(slug = 'two-sum') {
  const { GET } = await import('@/app/api/questions/[slug]/route');
  const req = new NextRequest(`http://localhost/api/questions/${slug}`);
  return GET(req, { params: Promise.resolve({ slug }) });
}

describe('GET /api/questions/[slug] discussions', () => {
  beforeEach(() => {
    getCurrentUserFromRequest.mockReset().mockResolvedValue(null);
    findUnique.mockReset().mockResolvedValue({
      id: 'q1',
      slug: 'two-sum',
      title: 'Two Sum',
      prompt: '',
      difficulty: 'EASY',
      type: 'BACKEND',
      accessTier: 'FREE',
      isPublished: true,
      publicTestCode: null,
      tags: [],
      versions: [],
      officialSolutions: [],
      threads: [
        thread('t1', { profile: { displayName: 'Ada' } }),
        thread('t2', { profile: null, email: 'leak@example.com' })
      ]
    });
  });

  it('uses display names, falls back to Anonymous, and never exposes emails', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.question.discussions.map((d: { author: string }) => d.author)).toEqual(['Ada', 'Anonymous']);
    expect(JSON.stringify(body)).not.toContain('leak@example.com');
    expect(findUnique.mock.calls[0][0].include.threads.include.user).toEqual({
      select: { profile: { select: { displayName: true } } }
    });
  });
});
