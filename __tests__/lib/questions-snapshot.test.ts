import { beforeEach, describe, expect, it, vi } from 'vitest';

const tagLinkFindMany = vi.fn();
const versionFindFirst = vi.fn();
const questionFindUnique = vi.fn();
const packLinkFindFirst = vi.fn();
const questionUpdate = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    questionTagOnQuestion: {
      findMany: (...a: unknown[]) => tagLinkFindMany(...a)
    },
    questionVersion: {
      findFirst: (...a: unknown[]) => versionFindFirst(...a)
    },
    question: {
      findUnique: (...a: unknown[]) => questionFindUnique(...a),
      update: (...a: unknown[]) => questionUpdate(...a)
    },
    contentPackQuestion: {
      findFirst: (...a: unknown[]) => packLinkFindFirst(...a)
    }
  }
}));

describe('buildQuestionRenderData', () => {
  beforeEach(() => {
    tagLinkFindMany.mockReset();
    versionFindFirst.mockReset();
    questionFindUnique.mockReset();
    packLinkFindFirst.mockReset();
    questionUpdate.mockReset();
  });

  it('aggregates tags + starter + description + publicTest + pack', async () => {
    tagLinkFindMany.mockResolvedValue([
      { tag: { name: 'arrays', kind: 'TOPIC' } },
      { tag: { name: 'two-pointer', kind: 'TOPIC' } },
      { tag: { name: 'Visa', kind: 'COMPANY' } }
    ]);
    versionFindFirst.mockResolvedValue({
      content: { description: 'Solve two sum' },
      starterCode: { js: 'function solve(){}', ts: 'function solve(): number {}' }
    });
    questionFindUnique.mockResolvedValue({ publicTestCode: 'expect(solve(1)).toBe(1)' });
    packLinkFindFirst.mockResolvedValue({ packId: 'pack_42' });

    const { buildQuestionRenderData } = await import('@/lib/questions-snapshot');
    const data = await buildQuestionRenderData('q1');

    expect(data).toEqual({
      description: 'Solve two sum',
      tags: ['arrays', 'two-pointer'],
      companies: ['Visa'],
      starterCode: { js: 'function solve(){}', ts: 'function solve(): number {}' },
      publicTestCode: 'expect(solve(1)).toBe(1)',
      packId: 'pack_42'
    });
  });

  it('null-safe defaults when version/question/pack missing', async () => {
    tagLinkFindMany.mockResolvedValue([]);
    versionFindFirst.mockResolvedValue(null);
    questionFindUnique.mockResolvedValue(null);
    packLinkFindFirst.mockResolvedValue(null);

    const { buildQuestionRenderData } = await import('@/lib/questions-snapshot');
    expect(await buildQuestionRenderData('q-missing')).toEqual({
      description: null,
      tags: [],
      companies: [],
      starterCode: {},
      publicTestCode: null,
      packId: null
    });
  });

  it('reads only the latest PUBLISHED version', async () => {
    tagLinkFindMany.mockResolvedValue([]);
    versionFindFirst.mockResolvedValue(null);
    questionFindUnique.mockResolvedValue(null);
    packLinkFindFirst.mockResolvedValue(null);

    const { buildQuestionRenderData } = await import('@/lib/questions-snapshot');
    await buildQuestionRenderData('q1');

    expect(versionFindFirst).toHaveBeenCalledWith({
      where: { questionId: 'q1', status: 'PUBLISHED' },
      orderBy: { version: 'desc' }
    });
  });
});

describe('refreshQuestionRenderData', () => {
  beforeEach(() => {
    tagLinkFindMany.mockReset();
    versionFindFirst.mockReset();
    questionFindUnique.mockReset();
    packLinkFindFirst.mockReset();
    questionUpdate.mockReset();
  });

  it('persists computed snapshot to question.renderData', async () => {
    tagLinkFindMany.mockResolvedValue([{ tag: { name: 'css' } }]);
    versionFindFirst.mockResolvedValue({
      content: { description: 'd' },
      starterCode: {}
    });
    questionFindUnique.mockResolvedValue({ publicTestCode: null });
    packLinkFindFirst.mockResolvedValue(null);
    questionUpdate.mockResolvedValue({});

    const { refreshQuestionRenderData } = await import('@/lib/questions-snapshot');
    const result = await refreshQuestionRenderData('q1');

    expect(questionUpdate).toHaveBeenCalledWith({
      where: { id: 'q1' },
      data: { renderData: result }
    });
    expect(result.tags).toEqual(['css']);
  });
});
