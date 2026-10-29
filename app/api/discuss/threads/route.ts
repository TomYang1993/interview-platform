import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { badRequest, unauthorized } from '@/lib/api';
import { requireUser } from '@/lib/auth/current-user';
import { questionAccessError } from '@/lib/discuss';

const bodySchema = z.object({
  questionId: z.string().min(1),
  title: z.string().min(5).max(180),
  body: z.string().min(5).max(5000)
});

export async function POST(req: NextRequest) {
  const user = await requireUser(req).catch(() => null);
  if (!user) {
    return unauthorized();
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || 'Invalid thread payload');
  }

  // Can't post on a question you can't see.
  const question = await prisma.question.findUnique({
    where: { id: parsed.data.questionId },
    select: { id: true, accessTier: true, isPublished: true }
  });
  const denied = await questionAccessError(question, user.id);
  if (denied) return denied;

  const thread = await prisma.discussionThread.create({
    data: {
      questionId: parsed.data.questionId,
      userId: user.id,
      title: parsed.data.title,
      body: parsed.data.body
    }
  });

  return NextResponse.json({ thread }, { status: 201 });
}
