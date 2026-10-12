/**
 * Diff seed source vs DB state to find admin-edited questions.
 *
 * Compares every field the admin UI can mutate (Question + latest
 * QuestionVersion + tags + OfficialSolutions) and prints a per-question
 * report of drift.
 *
 * Usage: npx tsx scripts/diff-seeds-vs-db.ts
 */
import { PrismaClient } from '@prisma/client';
import * as seeds from '../prisma/seeds';
import type { SeedQuestion } from '../prisma/seeds';
import { diffQuestion, previewValue } from '../prisma/seeds/diff';

const prisma = new PrismaClient();

function collectSeeds(): SeedQuestion[] {
  const result: SeedQuestion[] = [];
  for (const value of Object.values(seeds)) {
    if (value && typeof value === 'object' && 'slug' in value && 'prompt' in value) {
      result.push(value as SeedQuestion);
    }
  }
  return result;
}

async function main() {
  const list = collectSeeds();
  console.log(`Comparing ${list.length} seeds against DB...\n`);

  let driftCount = 0;
  for (const seed of list) {
    const diffs = (await diffQuestion(prisma, seed)) ?? [{ field: '<missing in DB>', seed: seed.slug, db: null }];
    if (diffs.length === 0) continue;
    driftCount++;
    console.log(`\n━━━ ${seed.slug} (${diffs.length} diff${diffs.length === 1 ? '' : 's'}) ━━━`);
    for (const d of diffs) {
      console.log(`  • ${d.field}`);
      console.log(`      seed: ${previewValue(d.seed)}`);
      console.log(`      db  : ${previewValue(d.db)}`);
    }
  }

  console.log(`\n\n${driftCount} question(s) have drift between seed and DB.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
