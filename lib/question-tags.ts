import type { Prisma, PrismaClient, TagKind } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Resolve tag names to ids, creating missing ones with the given kind.
 * Matches case-insensitively so "visa" reuses an existing "Visa" row.
 * Shared by the admin API and the seed scripts.
 */
export async function ensureTagIds(db: Db, names: string[], kind: TagKind): Promise<string[]> {
  const ids: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const byName = { name: { equals: name, mode: 'insensitive' as const } };
    let tag = await db.questionTag.findFirst({ where: { ...byName, kind } });
    if (!tag) {
      // Same name under the other kind: a tag has one kind, so the explicit
      // assignment wins (e.g. a stray topic "visa" becomes the company "Visa").
      const other = await db.questionTag.findFirst({ where: byName });
      tag = other
        ? await db.questionTag.update({ where: { id: other.id }, data: { kind, name } })
        : await db.questionTag.create({ data: { name, kind } });
    }
    ids.push(tag.id);
  }
  return ids;
}

/** Every company tag, for the home-page marquee. */
export function listCompanyTags(db: Db) {
  return db.questionTag.findMany({ where: { kind: 'COMPANY' }, orderBy: { name: 'asc' }, select: { name: true } });
}

/**
 * Logo for a company tag via Google's favicon service.
 * ponytail: domain is derived as `<name>.com`, which holds for every company we list;
 * add a `domain` column on QuestionTag when one breaks the convention.
 */
export function companyLogoUrl(name: string, size = 64) {
  const domain = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}
