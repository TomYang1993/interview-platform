import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { accessibleQuestionWhere, discussionAuthorName } from '@/lib/discuss';

describe('discussionAuthorName', () => {
  it('uses the display name', () => {
    expect(discussionAuthorName({ profile: { displayName: 'Ada' } })).toBe('Ada');
  });

  it('falls back to Anonymous for a missing or blank profile, never the email', () => {
    const noProfile = { profile: null, email: 'leak@example.com' };
    expect(discussionAuthorName(noProfile)).toBe('Anonymous');
    expect(discussionAuthorName({ profile: { displayName: '   ' } })).toBe('Anonymous');
  });
});

describe('accessibleQuestionWhere', () => {
  it('signed out: published FREE questions only', () => {
    expect(accessibleQuestionWhere(null)).toEqual({
      isPublished: true,
      OR: [{ accessTier: 'FREE' }, { id: { in: [] } }]
    });
  });

  it('pack owner: FREE plus unlocked questions', () => {
    expect(accessibleQuestionWhere({ hasPro: false, unlockedPackQuestionIds: ['q1'] })).toEqual({
      isPublished: true,
      OR: [{ accessTier: 'FREE' }, { id: { in: ['q1'] } }]
    });
  });

  it('Pro: every published question', () => {
    expect(accessibleQuestionWhere({ hasPro: true, unlockedPackQuestionIds: [] })).toEqual({ isPublished: true });
  });
});
