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
      isNew: isNewQuestion(question.publishedAt),
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

/**
 * A few published questions for the home-page hero: company-attributed
 * ones first, then the rest, capped at `limit`.
 */
export async function listHeroQuestions(limit = 4) {
  const questions = await prisma.question.findMany({
    where: { isPublished: true },
    orderBy: [{ difficulty: 'asc' }, { createdAt: 'desc' }],
    select: {
      slug: true, title: true, difficulty: true, type: true, accessTier: true,
      timeLimitMinutes: true, renderData: true,
    },
  });
  return questions
    .map(({ renderData, ...q }) => {
      const rd = renderData as QuestionRenderData | null;
      return { ...q, description: rd?.description ?? null, companies: rd?.companies ?? [] };
    })
    .sort((a, b) => Number(b.companies.length > 0) - Number(a.companies.length > 0))
    .slice(0, limit);
}

/** How long a question counts as "New" after it first goes live. */
export const NEW_QUESTION_DAYS = 60;

export function isNewQuestion(publishedAt: Date | null, now = new Date()): boolean {
  if (!publishedAt) return false;
  return now.getTime() - publishedAt.getTime() < NEW_QUESTION_DAYS * 24 * 60 * 60 * 1000;
}

export const WHATS_NEW_PAGE_SIZE = 12;

export interface WhatsNewItem {
  slug: string;
  title: string;
  description: string | null;
  companies: string[];
  isNew: boolean;
}

/**
 * Published questions that carry at least one company tag — /whats-new is a
 * marketing page, so untagged questions stay off it. Most recently published
 * first; questions from before `publishedAt` existed follow, newest-created
 * first. Offset-paged for the infinite scroll.
 */
export async function listWhatsNew(offset = 0, limit = WHATS_NEW_PAGE_SIZE) {
  const rows = await prisma.question.findMany({
    where: { isPublished: true, tags: { some: { tag: { kind: 'COMPANY' } } } },
    orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'asc' }],
    skip: offset,
    take: limit + 1,
    select: { slug: true, title: true, publishedAt: true, renderData: true },
  });

  const now = new Date();
  const items: WhatsNewItem[] = rows.slice(0, limit).map(({ renderData, publishedAt, ...q }) => {
    const rd = renderData as QuestionRenderData | null;
    return {
      ...q,
      description: rd?.description ?? null,
      companies: rd?.companies ?? [],
      isNew: isNewQuestion(publishedAt, now),
    };
  });

  return { items, nextOffset: rows.length > limit ? offset + limit : null };
}

/** The most recently published question, for the site-wide banner. */
export async function getLatestQuestion() {
  const question = await prisma.question.findFirst({
    where: { isPublished: true, publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    select: { slug: true, title: true, renderData: true },
  });
  if (!question) return null;
  const rd = question.renderData as QuestionRenderData | null;
  return { slug: question.slug, title: question.title, companies: rd?.companies ?? [] };
}
