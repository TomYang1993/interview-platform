import type { PrismaClient } from '@prisma/client';
import type { SeedQuestion } from './types';
import { officialSolutionId } from './seed-questions';

export type FieldDiff = { field: string; seed: unknown; db: unknown };

/**
 * Compare a seed against the DB row with the same slug, across every field
 * the admin UI or seedQuestion() can mutate (Question + latest
 * QuestionVersion + tags + OfficialSolutions).
 *
 * Returns `null` when the slug isn't in the DB, otherwise the list of
 * differing fields (empty when in sync).
 */
export async function diffQuestion(prisma: PrismaClient, seed: SeedQuestion): Promise<FieldDiff[] | null> {
  const q = await prisma.question.findUnique({
    where: { slug: seed.slug },
    include: {
      tags: { include: { tag: true } },
      versions: { orderBy: { version: 'desc' }, take: 1 },
      officialSolutions: true,
    },
  });

  if (!q) return null;

  const diffs: FieldDiff[] = [];
  const scalar: Array<keyof SeedQuestion & keyof typeof q> = [
    'title',
    'prompt',
    'type',
    'difficulty',
    'accessTier',
    'timeLimitMinutes',
    'publicTestCode',
    'hiddenTestCode',
    'language',
    'functionName',
  ];
  for (const f of scalar) {
    const sv = seed[f] ?? null;
    const dv = (q as Record<string, unknown>)[f] ?? null;
    if (!jsonEqual(sv, dv)) diffs.push({ field: f, seed: sv, db: dv });
  }

  if (!jsonEqual(seed.argTypes ?? [], q.argTypes)) {
    diffs.push({ field: 'argTypes', seed: seed.argTypes ?? [], db: q.argTypes });
  }

  // JSON test cases
  for (const f of ['publicTestCases', 'hiddenTestCases'] as const) {
    const sv = seed[f] ?? null;
    const dv = (q as Record<string, unknown>)[f] ?? null;
    if (!jsonEqual(sv, dv)) diffs.push({ field: f, seed: sv, db: dv });
  }

  // Tags — topics and companies are stored together, compared separately
  for (const [field, seedNames, kind] of [
    ['tags', seed.tags, 'TOPIC'],
    ['companies', seed.companies ?? [], 'COMPANY'],
  ] as const) {
    const sv = [...seedNames].sort();
    const dv = q.tags.filter((t) => t.tag.kind === kind).map((t) => t.tag.name).sort();
    if (!jsonEqual(sv, dv)) diffs.push({ field, seed: sv, db: dv });
  }

  // Latest version: description + starterCode
  const v = q.versions[0];
  if (v) {
    const dbDescription = (v.content as { description?: string } | null)?.description ?? null;
    if (!jsonEqual(seed.description, dbDescription)) {
      diffs.push({ field: 'description', seed: seed.description, db: dbDescription });
    }
    if (!jsonEqual(seed.starterCode, v.starterCode)) {
      diffs.push({ field: 'starterCode', seed: seed.starterCode, db: v.starterCode });
    }
  }

  // Solutions — match by key ("python", "python.iterative"). Seeded rows carry
  // the key in their id; rows added in the admin UI fall back to language.
  const seedPrefix = officialSolutionId(q.id, '');
  const dbKey = (s: (typeof q.officialSolutions)[number]) =>
    s.id.startsWith(seedPrefix) ? s.id.slice(seedPrefix.length) : s.language;
  const seedSols = (seed.solutions ?? []).map((s) => ({ ...s, key: s.key ?? s.language }));
  for (const ss of seedSols) {
    const ds = q.officialSolutions.find((s) => dbKey(s) === ss.key);
    if (!ds) {
      diffs.push({ field: `solution[${ss.key}]`, seed: '<present>', db: '<missing>' });
      continue;
    }
    const fields = [
      ['title', ss.title ?? null, ds.title],
      ['position', ss.position ?? 0, ds.position],
      ['code', ss.code, ds.code],
      ['explanation', ss.explanation, ds.explanation],
      ['complexity', ss.complexity ?? null, ds.complexity ?? null],
    ] as const;
    for (const [field, sv, dv] of fields) {
      if (!jsonEqual(sv, dv)) diffs.push({ field: `solution[${ss.key}].${field}`, seed: sv, db: dv });
    }
  }
  // Extra DB solutions not in seed
  for (const ds of q.officialSolutions) {
    if (!seedSols.find((ss) => ss.key === dbKey(ds))) {
      diffs.push({ field: `solution[${dbKey(ds)}]`, seed: '<missing>', db: '<present in DB>' });
    }
  }

  return diffs;
}

/** One-line preview of a diff value for console reports. */
export function previewValue(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'string') {
    const s = v.replace(/\s+/g, ' ').trim();
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  }
  const s = JSON.stringify(v);
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

// jsonb doesn't preserve object key order, so compare with keys sorted.
function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a, sortedKeys) === JSON.stringify(b, sortedKeys);
}

function sortedKeys(_key: string, value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}
