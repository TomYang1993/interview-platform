import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUserFromRequest } from '@/lib/auth/current-user';
import { getEntitlementContext, canAccessQuestion } from '@/lib/auth/entitlement';
import { notFound, forbidden } from '@/lib/api';
import { discussionAuthorName, discussionAuthorSelect } from '@/lib/discuss';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const question = await prisma.question.findUnique({
    where: { slug },
    include: {
      tags: { include: { tag: true } },
      versions: {
        where: { status: 'PUBLISHED' },
        orderBy: { version: 'desc' },
        take: 1
      },
      officialSolutions: {
        orderBy: { updatedAt: 'desc' }
      },
      threads: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: discussionAuthorSelect,
          _count: { select: { comments: true, likes: true } }
        }
      }
    }
  });

  if (!question || !question.isPublished) {
    return notFound('Question not found');
  }

  const user = await getCurrentUserFromRequest(req);
  const entitlement = user ? await getEntitlementContext(user.id) : null;
  const allowed = canAccessQuestion(question.accessTier, question.id, entitlement);

  if (!allowed) {
    return forbidden('Premium content is locked. Upgrade plan or buy pack.');
  }

  const starterCode = (question.versions[0]?.starterCode || {}) as Record<string, string>;

  return NextResponse.json({
    question: {
      id: question.id,
      slug: question.slug,
      title: question.title,
      prompt: question.prompt,
      difficulty: question.difficulty,
      type: question.type,
      accessTier: question.accessTier,
      tags: question.tags.map((item) => item.tag.name),
      starterCode,
      publicTestCode: question.publicTestCode,
      officialSolutions: question.officialSolutions,
      discussions: question.threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        body: thread.body,
        createdAt: thread.createdAt,
        author: discussionAuthorName(thread.user),
        commentsCount: thread._count.comments,
        likesCount: thread._count.likes
      }))
    }
  });
}
