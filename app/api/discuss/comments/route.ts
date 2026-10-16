import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { badRequest, forbidden, notFound, unauthorized } from '@/lib/api';
import { requireUser } from '@/lib/auth/current-user';
import { questionAccessError } from '@/lib/discuss';

const bodySchema = z.object({
  threadId: z.string().min(1),
  body: z.string().min(1).max(5000),
  parentId: z.string().optional()
});

export async function POST(req: NextRequest) {
  const user = await requireUser(req).catch(() => null);
  if (!user) {
    return unauthorized();
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || 'Invalid comment payload');
  }

  // Comments inherit the thread's question gating; hidden threads don't exist publicly.
  const thread = await prisma.discussionThread.findUnique({
    where: { id: parsed.data.threadId },
    select: {
      status: true,
      question: { select: { id: true, accessTier: true, isPublished: true } }
    }
  });
  if (!thread || thread.status === 'HIDDEN') {
    return notFound('Thread not found');
  }
  const denied = await questionAccessError(thread.question, user.id);
  if (denied) return denied;
  if (thread.status === 'LOCKED') {
    return forbidden('Thread is locked');
  }

  const comment = await prisma.discussionComment.create({
    data: {
      threadId: parsed.data.threadId,
      userId: user.id,
      body: parsed.data.body,
      parentId: parsed.data.parentId
    }
  });

  return NextResponse.json({ comment }, { status: 201 });
}
