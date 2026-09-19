import { Suspense } from 'react';
import { QuestionsListClient } from '@/components/questions-list-client';
import { QuestionsStatsBar } from '@/components/questions-stats-bar';
import { type QuestionRow } from '@/components/questions-table';
import { getCurrentServerUser } from '@/lib/auth/current-user-server';
import { listPublishedQuestions } from '@/lib/questions';
import { prisma } from '@/lib/db/prisma';
import { createTimer } from '@/lib/server-timing';
import { getUserStreak } from '@/lib/streak';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function QuestionsPage({ searchParams: searchParamsPromise }: PageProps) {
  const searchParams = await searchParamsPromise;
  const t = createTimer('GET /questions');
  const user = await t.time('auth', getCurrentServerUser());

  const [allQuestions, submissionStatsByQuestion, streak] = await Promise.all([
    t.time('questions', listPublishedQuestions(user?.id)),
    t.time('submissions', getSubmissionStats(user?.id)),
    t.time('streak', user ? getUserStreak(user.id) : Promise.resolve(0)),
  ]);
  t.summary();

  // Build question rows with computed fields
  const questionRows: QuestionRow[] = allQuestions.map((q) => {
    const stat = submissionStatsByQuestion[q.id];
    return {
      id: q.id,
      slug: q.slug,
      title: q.title,
      description: q.description,
      difficulty: q.difficulty,
      type: q.type,
      accessTier: q.accessTier,
      tags: q.tags,
      companies: q.companies,
      locked: q.locked,
      status: stat?.status ?? 'unattempted',
      passedCount: stat?.passedCount ?? 0,
    };
  });

  // Server-side filtering for dropdown filters only.
  // Search is client-side (instant, no roundtrip), so it does not appear here.
  let filtered = questionRows;
  if (searchParams.type) {
    filtered = filtered.filter((q) => q.type === searchParams.type);
  }
  if (searchParams.difficulty) {
    filtered = filtered.filter((q) => q.difficulty === searchParams.difficulty);
  }
  if (searchParams.status) {
    filtered = filtered.filter((q) => q.status === searchParams.status);
  }

  const solvedCount = questionRows.filter((q) => q.status === 'solved').length;

  // Categorise questions for the stats bar — type is primary signal
  const categorise = (q: QuestionRow) => {
    if (q.type === 'REACT_APP') return 'ui';
    const tags = q.tags.map((s) => s.toLowerCase()).join(' ');
    if (/node|api|server|backend|database|express|rest/i.test(tags)) return 'backend';
    if (q.type === 'FUNCTION_PYTHON') return 'backend';
    return 'js';
  };

  const cats = { js: { solved: 0, total: 0 }, ui: { solved: 0, total: 0 }, backend: { solved: 0, total: 0 } };
  for (const q of questionRows) {
    const cat = categorise(q);
    cats[cat].total++;
    if (q.status === 'solved') cats[cat].solved++;
  }

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6">
      <div className="grid gap-6 pb-8 max-md:pb-4">
        <QuestionsStatsBar
          isLoggedIn={!!user}
          streak={streak}
          totalQuestions={questionRows.length}
          solvedCount={solvedCount}
          js={cats.js}
          ui={cats.ui}
          backend={cats.backend}
        />

        <Suspense>
          <QuestionsListClient allRows={filtered} isLoggedIn={!!user} />
        </Suspense>
      </div>
    </div>
  );
}

async function getSubmissionStats(userId?: string) {
  const stats: Record<string, { status: 'solved' | 'attempted'; passedCount: number }> = {};
  if (!userId) return stats;

  const submissions = await prisma.submission.findMany({
    where: { userId },
    select: { questionId: true, status: true },
  });
  for (const sub of submissions) {
    if (!stats[sub.questionId]) {
      stats[sub.questionId] = { status: 'attempted', passedCount: 0 };
    }
    if (sub.status === 'PASSED') {
      stats[sub.questionId].status = 'solved';
      stats[sub.questionId].passedCount += 1;
    }
  }
  return stats;
}
