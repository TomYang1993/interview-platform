import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

/**
 * The shape stored in Question.renderData.
 * Contains everything needed to render the question list row
 * and the full detail page — zero joins at read time.
 */
export interface QuestionRenderData {
  description: string | null;
  /** Topic tags (kind TOPIC). */
  tags: string[];
  /** Companies the question was asked at (kind COMPANY). */
  companies: string[];
  starterCode: Record<string, string>;
  publicTestCode: string | null;
  packId: string | null;
}

/**
 * Compute the denormalized render payload for a single question.
 * Called on admin create/update — never on the read path.
 */
export async function buildQuestionRenderData(questionId: string): Promise<QuestionRenderData> {
  const [tagLinks, latestVersion, question, packLink] = await Promise.all([
    prisma.questionTagOnQuestion.findMany({
      where: { questionId },
      include: { tag: true },
    }),
    prisma.questionVersion.findFirst({
      where: { questionId, status: 'PUBLISHED' },
      orderBy: { version: 'desc' },
    }),
    prisma.question.findUnique({
      where: { id: questionId },
      select: { publicTestCode: true },
    }),
    prisma.contentPackQuestion.findFirst({
      where: { questionId },
    }),
  ]);

  const versionContent = latestVersion?.content as { description?: string } | null;

  return {
    description: versionContent?.description ?? null,
    tags: tagLinks.filter((l) => l.tag.kind !== 'COMPANY').map((l) => l.tag.name),
    companies: tagLinks.filter((l) => l.tag.kind === 'COMPANY').map((l) => l.tag.name),
    starterCode: (latestVersion?.starterCode ?? {}) as Record<string, string>,
    publicTestCode: question?.publicTestCode ?? null,
    packId: packLink?.packId ?? null,
  };
}

/**
 * Recompute and persist renderData for a question.
 * Call this after any admin mutation that changes question content.
 */
export async function refreshQuestionRenderData(questionId: string) {
  const data = await buildQuestionRenderData(questionId);
  await prisma.question.update({
    where: { id: questionId },
    data: { renderData: data as unknown as Prisma.InputJsonValue },
  });
  return data;
}
