import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUserFromRequest } from '@/lib/auth/current-user';
import { serverError } from '@/lib/api';
import { discussionAuthorName, discussionAuthorSelect, questionAccessError } from '@/lib/discuss';

/**
 * Lists active discussion threads for a question. The slug param is the question ID.
 * Threads often contain solutions, so they are gated exactly like the question itself.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const question = await prisma.question.findUnique({
      where: { id: slug },
      select: { id: true, accessTier: true, isPublished: true }
    });

    // Only resolve the session when the tier actually needs it.
    const user = question?.accessTier && question.accessTier !== 'FREE'
      ? await getCurrentUserFromRequest(req)
      : null;
    const denied = await questionAccessError(question, user?.id ?? null);
    if (denied) return denied;

    const threads = await prisma.discussionThread.findMany({
      where: { questionId: slug, status: 'ACTIVE' },
      include: {
        _count: { select: { comments: true, likes: true } },
        user: discussionAuthorSelect
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const formatted = threads.map(thread => ({
      id: thread.id,
      title: thread.title,
      body: thread.body,
      author: discussionAuthorName(thread.user),
      commentsCount: thread._count.comments,
      likesCount: thread._count.likes,
    }));

    return NextResponse.json(formatted);
  } catch {
    return serverError();
  }
}
