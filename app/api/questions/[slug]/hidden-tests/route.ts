import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/current-user';
import { canAccessQuestion, getEntitlementContext } from '@/lib/auth/entitlement';
import { forbidden, notFound, unauthorized } from '@/lib/api';

/**
 * Returns hidden test material for client-side execution.
 * The slug param here is actually the question ID (passed from the client).
 *
 * - Frontend (JS/React): returns the Jest-string `testCode`.
 * - Backend (`language` set, e.g. python): returns structured `testCases`, `functionName`
 *   and `argTypes` so the client-side Pyodide worker can replay them.
 *
 * Requires authentication, a published question, and access to its tier —
 * hidden tests of a PREMIUM question are as sensitive as its solutions.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await requireUser(req).catch(() => null);
  if (!user) {
    return unauthorized();
  }

  const question = await prisma.question.findUnique({
    where: { id: slug },
    select: {
      id: true,
      accessTier: true,
      isPublished: true,
      hiddenTestCode: true,
      hiddenTestCases: true,
      language: true,
      functionName: true,
      argTypes: true,
    },
  });

  if (!question || !question.isPublished) {
    return notFound('Question not found');
  }

  if (question.accessTier !== 'FREE') {
    const entitlement = await getEntitlementContext(user.id);
    if (!canAccessQuestion(question.accessTier, question.id, entitlement)) {
      return forbidden('Upgrade required');
    }
  }

  if (question.language) {
    return NextResponse.json({
      language: question.language,
      functionName: question.functionName ?? null,
      argTypes: question.argTypes,
      testCases: question.hiddenTestCases ?? [],
    });
  }

  return NextResponse.json({ testCode: question.hiddenTestCode || '' });
}
