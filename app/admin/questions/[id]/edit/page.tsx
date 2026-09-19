import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getCurrentServerUser } from '@/lib/auth/current-user-server';
import { AdminQuestionForm, type QuestionInitialValues } from '@/components/admin-question-form';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditQuestionPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentServerUser();
  if (!user || !user.roles.includes('ADMIN')) {
    redirect('/questions');
  }

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      versions: { orderBy: { version: 'desc' }, take: 1 },
      officialSolutions: { orderBy: { updatedAt: 'desc' } },
    },
  });

  if (!question) notFound();

  const latest = question.versions[0];
  const starterMap = (latest?.starterCode ?? {}) as Record<string, string>;
  const starterKey =
    question.type === 'REACT_APP' ? 'react' : question.type === 'FUNCTION_PYTHON' ? 'python' : 'javascript';

  const versionContent = (latest?.content ?? null) as { description?: string } | null;
  const renderData = (question.renderData ?? null) as { description?: string } | null;
  const description = versionContent?.description ?? renderData?.description ?? '';

  const initial: QuestionInitialValues = {
    id: question.id,
    slug: question.slug,
    title: question.title,
    prompt: question.prompt,
    description,
    tags: question.tags.filter((t) => t.tag.kind !== 'COMPANY').map((t) => t.tag.name),
    companies: question.tags.filter((t) => t.tag.kind === 'COMPANY').map((t) => t.tag.name),
    starterCode: starterMap[starterKey] ?? '',
    starterCodeTs: question.type === 'FUNCTION_JS' ? starterMap.typescript ?? '' : undefined,
    type: question.type,
    difficulty: question.difficulty,
    accessTier: question.accessTier,
    timeLimitMinutes: question.timeLimitMinutes,
    isPublished: question.isPublished,
    solutions: question.officialSolutions.map((s) => ({
      id: s.id,
      language: s.language,
      framework: s.framework,
      explanation: s.explanation,
      code: s.code,
      complexity: s.complexity,
    })),
  };

  return (
    <section className="stack-gap">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm underline opacity-70">
            ← Back to admin
          </Link>
          <h1>Edit question</h1>
        </div>
        <Link
          href={`/questions/${question.slug}`}
          target="_blank"
          className="text-sm underline"
        >
          View as user ↗
        </Link>
      </div>
      <AdminQuestionForm initial={initial} />
    </section>
  );
}
