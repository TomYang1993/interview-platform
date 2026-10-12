import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const findUnique = vi.fn();
const questionUpdate = vi.fn();
const versionUpdate = vi.fn();

vi.mock('@/lib/db/prisma', () => {
  const tx = {
    question: { update: (...a: unknown[]) => questionUpdate(...a) },
    questionVersion: { update: (...a: unknown[]) => versionUpdate(...a) },
    questionTagOnQuestion: { deleteMany: vi.fn(), createMany: vi.fn() }
  };
  return {
    prisma: {
      question: { findUnique: (...a: unknown[]) => findUnique(...a) },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)
    }
  };
});
vi.mock('@/lib/auth/current-user', () => ({ authorizeAdmin: vi.fn().mockResolvedValue({ id: 'admin1' }) }));
vi.mock('@/lib/questions-snapshot', () => ({ refreshQuestionRenderData: vi.fn() }));
vi.mock('@/lib/question-tags', () => ({ ensureTagIds: vi.fn().mockResolvedValue([]) }));

const draft = {
  id: 'q1',
  slug: 'largest-tree-root',
  isPublished: false,
  publishedAt: null as Date | null,
  versions: [{ id: 'v1', publishedAt: null }]
};

async function patch(body: unknown) {
  const { PATCH } = await import('@/app/api/admin/questions/[id]/route');
  const req = new NextRequest('http://localhost/api/admin/questions/q1', {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
  return PATCH(req, { params: Promise.resolve({ id: 'q1' }) });
}

describe('PATCH /api/admin/questions/[id] publishedAt', () => {
  beforeEach(() => {
    findUnique.mockReset();
    questionUpdate.mockReset();
    versionUpdate.mockReset();
  });

  it('stamps publishedAt on first publish', async () => {
    findUnique.mockResolvedValue(draft);
    expect((await patch({ isPublished: true })).status).toBe(200);
    const { data } = questionUpdate.mock.calls[0][0];
    expect(data.isPublished).toBe(true);
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it('keeps the original date when re-publishing', async () => {
    findUnique.mockResolvedValue({ ...draft, publishedAt: new Date('2026-10-12T00:00:00Z') });
    await patch({ isPublished: true });
    expect(questionUpdate.mock.calls[0][0].data).not.toHaveProperty('publishedAt');
  });

  it('keeps publishedAt when unpublishing', async () => {
    findUnique.mockResolvedValue({ ...draft, isPublished: true, publishedAt: new Date('2026-10-12T00:00:00Z') });
    await patch({ isPublished: false });
    expect(questionUpdate.mock.calls[0][0].data).toEqual({ isPublished: false });
  });

  it('leaves publishedAt alone on edits that do not publish', async () => {
    findUnique.mockResolvedValue(draft);
    await patch({ title: 'Largest Tree Root' });
    expect(questionUpdate.mock.calls[0][0].data).toEqual({ title: 'Largest Tree Root' });
  });
});
