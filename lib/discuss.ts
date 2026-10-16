import type { AccessTier, Prisma } from '@prisma/client';
import { canAccessQuestion, getEntitlementContext } from '@/lib/auth/entitlement';
import { forbidden, notFound } from '@/lib/api';

type EntitlementContext = Awaited<ReturnType<typeof getEntitlementContext>>;

/**
 * Prisma `user` relation selection for discussion authors. Selects only the
 * display name so the account email never leaves the database on public paths.
 */
export const discussionAuthorSelect = {
  select: { profile: { select: { displayName: true } } }
} as const;

/** Public byline for a thread or comment. Never falls back to the account email. */
export function discussionAuthorName(user: { profile: { displayName: string } | null }): string {
  return user.profile?.displayName.trim() || 'Anonymous';
}

/**
 * Discussions often contain solutions, so they inherit the question's gating:
 * 404 if the question is missing or unpublished, 403 if it is not FREE and the
 * user is not entitled to it. Returns the error response, or null if allowed.
 */
export async function questionAccessError(
  question: { id: string; accessTier: AccessTier; isPublished: boolean } | null,
  userId: string | null
) {
  if (!question || !question.isPublished) {
    return notFound('Question not found');
  }

  if (question.accessTier !== 'FREE') {
    const entitlement = userId ? await getEntitlementContext(userId) : null;
    if (!canAccessQuestion(question.accessTier, question.id, entitlement)) {
      return forbidden('Upgrade required');
    }
  }

  return null;
}

/** Prisma filter matching the questions `canAccessQuestion` would allow for this context. */
export function accessibleQuestionWhere(entitlement: EntitlementContext | null): Prisma.QuestionWhereInput {
  if (entitlement?.hasPro) {
    return { isPublished: true };
  }
  return {
    isPublished: true,
    OR: [{ accessTier: 'FREE' }, { id: { in: entitlement?.unlockedPackQuestionIds ?? [] } }]
  };
}
