import { prisma } from '@/lib/db/prisma';
import { canAccessQuestion, getEntitlementContext } from '@/lib/auth/entitlement';
import type { QuestionRenderData } from '@/lib/questions-snapshot';

export async function listPublishedQuestions(userId?: string) {
  // Single query — tags come from renderData, no joins needed
  const [questions, entitlement] = await Promise.all([
    prisma.question.findMany({
      where: { isPublished: true },
      orderBy: [{ difficulty: 'asc' }, { createdAt: 'desc' }]
    }),
    userId ? getEntitlementContext(userId) : Promise.resolve(null),
  ]);

  return questions.map((question) => {
    const rd = question.renderData as QuestionRenderData | null;
    return {
      ...question,
      description: rd?.description ?? null,
      tags: rd?.tags ?? [],
      companies: rd?.companies ?? [],
      locked: !canAccessQuestion(question.accessTier, question.id, entitlement)
    };
  });
}

export async function getQuestionDetailBySlug(slug: string, userId?: string) {
  // Single SELECT — all render data is in the renderData JSON column
  const [question, entitlement] = await Promise.all([
    prisma.question.findUnique({ where: { slug } }),
    userId ? getEntitlementContext(userId) : Promise.resolve(null),
  ]);

  if (!question || !question.isPublished) {
    return null;
  }

  const rd = question.renderData as QuestionRenderData | null;
  const locked = !canAccessQuestion(question.accessTier, question.id, entitlement);

  return {
    ...question,
    tags: rd?.tags ?? [],
    companies: rd?.companies ?? [],
    starterCode: rd?.starterCode,
    publicTestCode: question.publicTestCode ?? rd?.publicTestCode ?? null,
    packId: rd?.packId ?? null,
    locked
  };
}
