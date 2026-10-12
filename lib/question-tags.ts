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

// Mid-luminance brand colours, readable as a tint on both light and dark themes.
// Brands whose colour is black or very dark (Uber, Visa's navy) are left out
// and get a generated colour instead.
const COMPANY_COLORS: Record<string, string> = {
  amazon: '#FF9900',
  anthropic: '#D97757',
  bloomberg: '#FB8B1E',
  coinbase: '#0052FF',
  doordash: '#FF3008',
  goldmansachs: '#7399C6',
  google: '#4285F4',
  linkedin: '#0A66C2',
  meta: '#0866FF',
  microsoft: '#00A4EF',
  netflix: '#E50914',
  openai: '#10A37F',
  pinterest: '#E60023',
  roblox: '#E2231A',
  snowflake: '#29B5E8',
  stripe: '#635BFF',
  tiktok: '#FE2C55',
  visa: '#1434CB',
};

/** Accent colour for a company tag: its brand colour, or a stable hue from its name. */
export function companyColor(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const known = COMPANY_COLORS[key];
  if (known) return known;
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 65% 50%)`;
}
