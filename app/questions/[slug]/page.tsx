import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { EditorWorkspace } from '@/components/editor-workspace';
import { ReactEditorWorkspace } from '@/components/react-editor-workspace';
import { PremiumUpsell } from '@/components/premium-upsell';
import { QuestionStartScreen } from '@/components/question-start-screen';
import { DesktopOnlyGate } from '@/components/desktop-only-gate';
import { getCurrentServerUser } from '@/lib/auth/current-user-server';
import { getQuestionDetailBySlug } from '@/lib/questions';
import { prisma } from '@/lib/db/prisma';
import { createTimer } from '@/lib/server-timing';

export const dynamic = 'force-dynamic';

async function resolveTimerState(userId: string, questionId: string) {
  const timer = await prisma.questionTimer.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });
  if (!timer) return null;

  const expiryMs = timer.startedAt.getTime() + timer.timeLimitMinutes * 60_000;
  const remainingMs = expiryMs - Date.now();

  if (remainingMs > 5_000) {
    return { expiresAt: new Date(expiryMs).toISOString(), reactLanguage: timer.reactLanguage };
  }

  await prisma.questionTimer.delete({ where: { id: timer.id } });
  return null;
}

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function QuestionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const t = createTimer(`GET /questions/${slug}`);
  const user = await t.time('auth', getCurrentServerUser());

  if (!user) {
    redirect(`/auth?next=/questions/${encodeURIComponent(slug)}`);
  }

  const question = await t.time('query', getQuestionDetailBySlug(slug, user.id));
  t.summary();

  if (!question) {
    notFound();
  }

  if (question.locked) {
    return (
      <section className="premium-lock">
        <h1>{question.title}</h1>
        <p>This is a premium question.</p>
        <p>Unlock by subscribing to Pro or buying a content pack.</p>
        <PremiumUpsell packId={question.packId} />
        <Link href="/questions" className="btn btn-secondary">
          Back to question list
        </Link>
      </section>
    );
  }

  // ─── Timer check ───
  const timerState = await resolveTimerState(user.id, question.id);
  const expiresAt = timerState?.expiresAt ?? null;

  // No active timer → show start screen
  if (!expiresAt) {
    return (
      <QuestionStartScreen
        slug={slug}
        title={question.title}
        difficulty={question.difficulty}
        tags={question.tags}
        timeLimitMinutes={question.timeLimitMinutes}
        questionType={question.type}
      />
    );
  }

  // ─── Active timer → show workspace ───
  const starterCode: Record<string, string> = { ...((question.starterCode as Record<string, string>) || {}) };

  const drafts = await prisma.codeDraft.findMany({
    where: { userId: user.id, questionId: question.id }
  });
  for (const d of drafts) {
    if (d.framework === 'react') {
      try {
        const parsed = JSON.parse(d.code);
        // New shape: { appJs, appTs, styles }
        if (parsed.appJs) starterCode.react = parsed.appJs;
        if (parsed.appTs) starterCode.reactTypescript = parsed.appTs;
        // Legacy shape: { app, styles }
        if (parsed.app && !parsed.appJs) starterCode.react = parsed.app;
        if (parsed.styles) starterCode.css = parsed.styles;
      } catch {
        // ignore parsing error
      }
    } else {
      starterCode[d.framework] = d.code;
    }
  }

  if (question.type === 'FUNCTION_JS' || question.type === 'FUNCTION_PYTHON') {
    return (
      <DesktopOnlyGate title={question.title}>
        <EditorWorkspace
          questionId={question.id}
          slug={slug}
          questionType={question.type}
          title={question.title}
          prompt={question.prompt}
          difficulty={question.difficulty}
          tags={question.tags}
          starterCode={starterCode}
          publicTestCode={question.publicTestCode || ''}
          publicTestCases={
            (question.publicTestCases as { name: string; args: unknown[]; expected: unknown }[] | null) ?? null
          }
          functionName={question.functionName ?? null}
          argTypes={question.argTypes}
          expiresAt={expiresAt}
        />
      </DesktopOnlyGate>
    );
  }

  const reactLanguage = (timerState?.reactLanguage === 'ts' ? 'ts' : 'js') as 'js' | 'ts';

  return (
    <DesktopOnlyGate title={question.title}>
      <ReactEditorWorkspace
        questionId={question.id}
        slug={slug}
        title={question.title}
        prompt={question.prompt}
        difficulty={question.difficulty}
        tags={question.tags}
        starterCode={starterCode}
        publicTestCode={question.publicTestCode || ''}
        expiresAt={expiresAt}
        language={reactLanguage}
      />
    </DesktopOnlyGate>
  );
}
