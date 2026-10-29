import { describe, expect, it, vi } from 'vitest';
import { syncOfficialSolutions } from '@/prisma/seeds/seed-questions';

function fakePrisma() {
  const officialSolution = {
    upsert: vi.fn<(args: unknown) => Promise<object>>(async () => ({})),
    deleteMany: vi.fn<(args: unknown) => Promise<{ count: number }>>(async () => ({ count: 0 })),
  };
  return { officialSolution } as unknown as Parameters<typeof syncOfficialSolutions>[0] & {
    officialSolution: typeof officialSolution;
  };
}

describe('syncOfficialSolutions', () => {
  it('upserts each solution by key and deletes only seeded rows whose key is gone', async () => {
    const prisma = fakePrisma();
    await syncOfficialSolutions(prisma, 'q1', [
      { key: 'python', language: 'python', title: 'Recursive', position: 0, code: 'a', explanation: 'A' },
      { key: 'python.iterative', language: 'python', title: 'Iterative', position: 1, code: 'b', explanation: 'B' },
    ]);

    expect(prisma.officialSolution.upsert.mock.calls.map(([arg]) => arg)).toEqual([
      expect.objectContaining({
        where: { id: 'q1-official-python' },
        create: expect.objectContaining({ id: 'q1-official-python', questionId: 'q1', language: 'python', title: 'Recursive', position: 0 }),
      }),
      expect.objectContaining({
        where: { id: 'q1-official-python.iterative' },
        update: expect.objectContaining({ title: 'Iterative', position: 1, code: 'b' }),
      }),
    ]);
    // A renamed approach (e.g. the old q1-official-python.stack) matches the
    // prefix but not the list; admin-UI rows (cuid ids) don't match the prefix.
    expect(prisma.officialSolution.deleteMany).toHaveBeenCalledWith({
      where: {
        questionId: 'q1',
        id: { startsWith: 'q1-official-', notIn: ['q1-official-python', 'q1-official-python.iterative'] },
      },
    });
  });

  it('keys solutions without an approach by language', async () => {
    const prisma = fakePrisma();
    await syncOfficialSolutions(prisma, 'q2', [{ language: 'javascript', code: 'c', explanation: 'C' }]);
    expect(prisma.officialSolution.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'q2-official-javascript' } })
    );
  });
});
