import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { badRequest } from '@/lib/api';
import { authorizeAdmin } from '@/lib/auth/current-user';
import { createAuditLog } from '@/lib/audit';
import { refreshQuestionRenderData } from '@/lib/questions-snapshot';
import { ensureTagIds } from '@/lib/question-tags';

const bodySchema = z.object({
  slug: z.string().min(3),
  title: z.string().min(3),
  prompt: z.string().min(10),
  type: z.enum(['FUNCTION_JS', 'REACT_APP', 'FUNCTION_PYTHON']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  accessTier: z.enum(['FREE', 'PREMIUM']),
  isPublished: z.boolean().default(false),
  timeLimitMinutes: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
  companies: z.array(z.string()).default([]),
  content: z.record(z.unknown()).default({}),
  starterCode: z.record(z.string()).default({}),
  publicTestCode: z.string().optional(),
  hiddenTestCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const admin = await authorizeAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || 'Invalid question payload');
  }

  const data = parsed.data;
  const tagIds = [
    ...(await ensureTagIds(prisma, data.tags, 'TOPIC')),
    ...(await ensureTagIds(prisma, data.companies, 'COMPANY')),
  ];

  const existing = await prisma.question.findUnique({ where: { slug: data.slug } });
  if (existing) {
    return badRequest('Question slug already exists', 'DUPLICATE_SLUG');
  }

  const question = await prisma.question.create({
    data: {
      slug: data.slug,
      title: data.title,
      prompt: data.prompt,
      type: data.type,
      difficulty: data.difficulty,
      accessTier: data.accessTier,
      isPublished: data.isPublished,
      timeLimitMinutes: data.timeLimitMinutes,
      createdById: admin.id,
      publicTestCode: data.publicTestCode,
      hiddenTestCode: data.hiddenTestCode,
      versions: {
        create: {
          version: 1,
          content: data.content as Prisma.InputJsonValue,
          starterCode: data.starterCode as Prisma.InputJsonValue,
          status: data.isPublished ? 'PUBLISHED' : 'DRAFT',
          publishedAt: data.isPublished ? new Date() : null
        }
      },
      tags: {
        create: tagIds.map((tagId) => ({ tagId }))
      }
    },
    include: {
      tags: { include: { tag: true } },
      versions: true,
    }
  });

  await Promise.all([
    refreshQuestionRenderData(question.id),
    createAuditLog({
      actorId: admin.id,
      action: 'admin.question.create',
      entityType: 'Question',
      entityId: question.id,
      payload: { slug: question.slug }
    }),
  ]);

  return NextResponse.json({ question }, { status: 201 });
}
