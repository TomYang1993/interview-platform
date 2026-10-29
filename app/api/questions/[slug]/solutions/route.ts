import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentServerUser } from '@/lib/auth/current-user-server';
import { canAccessQuestion, getEntitlementContext } from '@/lib/auth/entitlement';
import { forbidden, notFound, serverError } from '@/lib/api';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    // Run auth, question lookup, and solutions query in parallel
    const [user, question, solutions] = await Promise.all([
      getCurrentServerUser(),
      prisma.question.findUnique({
        where: { id: slug },
        select: { id: true, accessTier: true }
      }),
      prisma.officialSolution.findMany({
        where: { questionId: slug },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
      }),
    ]);

    if (!question) return notFound('Question not found');

    const entitlement = user ? await getEntitlementContext(user.id) : null;
    if (!canAccessQuestion(question.accessTier, question.id, entitlement)) {
      return forbidden('Upgrade required');
    }

    const formatted = solutions.map(sol => ({
      id: sol.id,
      language: sol.language,
      title: sol.title,
      framework: sol.framework,
      explanation: sol.explanation,
      code: sol.code,
      complexity: sol.complexity
    }));

    return NextResponse.json(formatted);
  } catch {
    return serverError();
  }
}
