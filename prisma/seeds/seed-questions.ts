import { PrismaClient, Prisma, QuestionVersionStatus } from '@prisma/client';
import type { SeedQuestion, SeedSolution } from './types';
import { refreshQuestionRenderData } from '../../lib/questions-snapshot';
import { ensureTagIds } from '../../lib/question-tags';

/**
 * Seed a single question with all related data:
 * tags, version (starter code), test code, and solutions.
 *
 * Fully self-contained — resolves its own tags.
 * Safe to call repeatedly (all operations are upserts).
 *
 * `options.isPublished` controls visibility. When omitted, new questions are
 * created published (seed behaviour) and existing ones keep their current
 * state; when set, it is applied to the question and its version on both
 * create and update.
 */
export async function seedQuestion(
  prisma: PrismaClient,
  question: SeedQuestion,
  createdById: string,
  options: { isPublished?: boolean } = {},
) {
  const { isPublished } = options;
  const createPublished = isPublished ?? true;
  const desiredTagIds = [
    ...(await ensureTagIds(prisma, question.tags, 'TOPIC')),
    ...(await ensureTagIds(prisma, question.companies ?? [], 'COMPANY')),
  ];

  const q = await prisma.question.upsert({
    where: { slug: question.slug },
    update: {
      title: question.title,
      prompt: question.prompt,
      type: question.type,
      difficulty: question.difficulty,
      accessTier: question.accessTier,
      timeLimitMinutes: question.timeLimitMinutes,
      publicTestCode: question.publicTestCode ?? null,
      hiddenTestCode: question.hiddenTestCode ?? null,
      language: question.language ?? null,
      functionName: question.functionName ?? null,
      argTypes: question.argTypes ?? [],
      publicTestCases: (question.publicTestCases ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      hiddenTestCases: (question.hiddenTestCases ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      ...(isPublished !== undefined && { isPublished }),
    },
    create: {
      slug: question.slug,
      title: question.title,
      prompt: question.prompt,
      type: question.type,
      difficulty: question.difficulty,
      accessTier: question.accessTier,
      timeLimitMinutes: question.timeLimitMinutes,
      isPublished: createPublished,
      createdById,
      publicTestCode: question.publicTestCode ?? null,
      hiddenTestCode: question.hiddenTestCode ?? null,
      language: question.language ?? null,
      functionName: question.functionName ?? null,
      argTypes: question.argTypes ?? [],
      publicTestCases: (question.publicTestCases ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      hiddenTestCases: (question.hiddenTestCases ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
    },
  });

  // Link tags — reconcile so removed tags actually disappear (seed is source of truth)
  await prisma.questionTagOnQuestion.deleteMany({
    where: { questionId: q.id, tagId: { notIn: desiredTagIds } },
  });
  for (const tagId of desiredTagIds) {
    await prisma.questionTagOnQuestion.upsert({
      where: { questionId_tagId: { questionId: q.id, tagId } },
      update: {},
      create: { questionId: q.id, tagId },
    });
  }

  // Version with starter code
  await prisma.questionVersion.upsert({
    where: { questionId_version: { questionId: q.id, version: 1 } },
    update: {
      content: { description: question.description },
      starterCode: question.starterCode,
      ...(isPublished === true && { status: QuestionVersionStatus.PUBLISHED }),
      ...(isPublished === false && { status: QuestionVersionStatus.DRAFT, publishedAt: null }),
    },
    create: {
      questionId: q.id,
      version: 1,
      status: createPublished ? QuestionVersionStatus.PUBLISHED : QuestionVersionStatus.DRAFT,
      content: { description: question.description },
      starterCode: question.starterCode,
      publishedAt: createPublished ? new Date() : null,
    },
  });

  // First publish of an existing draft — stamp publishedAt, keep it on re-imports.
  // Question.publishedAt (the "what's new" date) is only set on an explicit
  // publish, so the plain seed leaves dev fixtures undated.
  if (isPublished === true) {
    await prisma.question.updateMany({
      where: { id: q.id, publishedAt: null },
      data: { publishedAt: new Date() },
    });
    await prisma.questionVersion.updateMany({
      where: { questionId: q.id, version: 1, publishedAt: null },
      data: { publishedAt: new Date() },
    });
  }

  // Refresh denormalized renderData so the read path (lib/questions.ts)
  // sees the latest starterCode, tags, description, and publicTestCode.
  // Without this, edits to QuestionVersion are invisible to the editor.
  await refreshQuestionRenderData(q.id);

  // Official solutions
  if (question.solutions) await syncOfficialSolutions(prisma, q.id, question.solutions);

  return q;
}

/**
 * Seed all questions. Returns a slug → Question record map
 * so the caller can reference questions for packs, submissions, etc.
 */
export async function seedAllQuestions(
  prisma: PrismaClient,
  questions: SeedQuestion[],
  createdById: string,
) {
  const questionMap = new Map<string, { id: string }>();

  for (const q of questions) {
    const record = await seedQuestion(prisma, q, createdById);
    questionMap.set(q.slug, record);
  }

  return questionMap;
}

/**
 * Upsert each seeded solution by its stable id, then delete seeded rows whose
 * key is gone (a renamed or removed approach), so a re-import leaves exactly
 * the content repo's solutions. Rows added in the admin UI have cuid ids,
 * not the seeded prefix, and are never touched.
 */
export async function syncOfficialSolutions(
  prisma: Pick<PrismaClient, 'officialSolution'>,
  questionId: string,
  solutions: SeedSolution[],
) {
  const ids: string[] = [];
  for (const sol of solutions) {
    const id = officialSolutionId(questionId, sol.key ?? sol.language);
    ids.push(id);
    const fields = {
      title: sol.title ?? null,
      position: sol.position ?? 0,
      explanation: sol.explanation,
      code: sol.code,
      complexity: sol.complexity ?? null,
    };
    await prisma.officialSolution.upsert({
      where: { id },
      update: fields,
      create: { id, questionId, language: sol.language, ...fields },
    });
  }
  await prisma.officialSolution.deleteMany({
    where: { questionId, id: { startsWith: officialSolutionId(questionId, ''), notIn: ids } },
  });
}

/** Stable id for a seeded solution, e.g. `<questionId>-official-python.iterative`. */
export function officialSolutionId(questionId: string, key: string): string {
  return `${questionId}-official-${key}`;
}
