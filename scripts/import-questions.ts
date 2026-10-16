/**
 * Import questions from the private content repo (see docs/adding-questions.md).
 *
 * Every run loads + validates each question folder, verifies the official
 * solutions against public and hidden tests, and diffs against the target DB.
 * Nothing is written unless --write is passed, and nothing is written at all
 * if any question fails validation or verification.
 *
 * Usage:
 *   npx tsx scripts/import-questions.ts <path>... [--write] [--publish] [--overwrite]
 *
 *   <path>       a question folder, or a folder searched for question folders
 *   --write      apply changes (default is a dry run)
 *   --publish    publish the imported questions (default: new ones are drafts,
 *                existing ones keep their current published state)
 *   --overwrite  allow updating questions that already exist and differ —
 *                this replaces any edits made through the admin UI
 *
 * Target DB comes from DATABASE_URL. For production, point it at the direct
 * (non-pooler) connection, e.g.:
 *   DATABASE_URL="$PROD_DIRECT_URL" npx tsx scripts/import-questions.ts ../interview-platform-content/questions
 */
import { prisma } from '@/lib/db/prisma';
import { seedQuestion } from '../prisma/seeds/seed-questions';
import { diffQuestion, previewValue, type FieldDiff } from '../prisma/seeds/diff';
import { ContentError, findQuestionDirs, lintQuestion, loadQuestionDir } from '../prisma/seeds/content-loader';
import { verifyQuestion } from '../prisma/seeds/verify-solutions';
import type { SeedQuestion } from '../prisma/seeds/types';

interface Planned {
  question: SeedQuestion;
  diffs: FieldDiff[] | null; // null = new question
  isPublished: boolean | null; // current state, null when new
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const paths = args.filter((a) => !a.startsWith('--'));
  const unknown = [...flags].filter((f) => !['--write', '--publish', '--overwrite'].includes(f));
  if (paths.length === 0 || unknown.length > 0) {
    if (unknown.length) console.error(`Unknown flag(s): ${unknown.join(', ')}\n`);
    console.error('Usage: npx tsx scripts/import-questions.ts <path>... [--write] [--publish] [--overwrite]');
    process.exit(1);
  }
  const write = flags.has('--write');
  const publish = flags.has('--publish');
  const overwrite = flags.has('--overwrite');

  console.log(`Target DB: ${describeDb(process.env.DATABASE_URL)}`);
  console.log(`Mode:      ${write ? 'WRITE' : 'dry run'}${publish ? ' + publish' : ''}${overwrite ? ' + overwrite' : ''}\n`);

  // 1. Load + validate
  const dirs = findQuestionDirs(paths);
  if (dirs.length === 0) throw new ContentError('No question folders (with question.json) found.');
  const questions = dirs.map(loadQuestionDir);
  const slugs = questions.map((q) => q.slug);
  const dupe = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dupe) throw new ContentError(`Slug "${dupe}" appears in more than one folder.`);

  // 2. Verify solutions
  let failed = false;
  for (const q of questions) {
    const report = await verifyQuestion(q);
    console.log(`${report.ok ? '✓' : '✗'} ${q.slug} (${q.type}, ${q.accessTier})`);
    for (const s of report.summary) console.log(`    ${s}`);
    for (const w of [...report.warnings, ...lintQuestion(q)]) console.log(`    ⚠ ${w}`);
    for (const e of report.errors) console.log(`    ✗ ${e}`);
    failed ||= !report.ok;
  }
  if (failed) {
    console.error('\nVerification failed — nothing was written.');
    process.exit(1);
  }

  // 3. Diff against the DB
  console.log('');
  const plan: Planned[] = [];
  for (const q of questions) {
    const [diffs, existing] = await Promise.all([
      diffQuestion(prisma, q),
      prisma.question.findUnique({ where: { slug: q.slug }, select: { isPublished: true } }),
    ]);
    plan.push({ question: q, diffs, isPublished: existing?.isPublished ?? null });
  }

  const blocked: string[] = [];
  for (const { question: q, diffs, isPublished } of plan) {
    const nextPublished = publish || (isPublished ?? false);
    const visibility = nextPublished ? 'published' : 'draft';
    if (diffs === null) {
      console.log(`+ ${q.slug}: new → ${visibility}`);
      continue;
    }
    const publishing = publish && !isPublished;
    if (diffs.length === 0) {
      console.log(`= ${q.slug}: unchanged${publishing ? ' → publish' : ''}`);
      continue;
    }
    console.log(`~ ${q.slug}: ${diffs.length} field(s) differ (${visibility})${publishing ? ' → publish' : ''}`);
    for (const d of diffs) {
      console.log(`    • ${d.field}`);
      console.log(`        content: ${previewValue(d.seed)}`);
      console.log(`        db     : ${previewValue(d.db)}`);
    }
    if (!overwrite) blocked.push(q.slug);
  }

  if (blocked.length > 0) {
    console.error(
      `\n${blocked.length} existing question(s) differ from the DB: ${blocked.join(', ')}.` +
        '\nThe DB may hold admin-UI edits. Copy them back into the content repo, or re-run with --overwrite to replace them.'
    );
    process.exit(1);
  }

  if (!write) {
    console.log('\nDry run — re-run with --write to apply.');
    return;
  }

  // 4. Apply
  const admin = await prisma.user.findFirst({
    where: { userRoles: { some: { role: { key: 'ADMIN' } } } },
    select: { id: true },
  });
  if (!admin) throw new ContentError('No admin user in the target DB — grant one with prisma/grant-admin.ts.');

  console.log('');
  let written = 0;
  for (const { question: q, diffs, isPublished } of plan) {
    const needsPublish = publish && !isPublished;
    if (diffs !== null && diffs.length === 0 && !needsPublish) continue;
    // New questions are drafts unless --publish; existing ones keep their state unless --publish.
    const options = publish ? { isPublished: true } : diffs === null ? { isPublished: false } : {};
    const record = await seedQuestion(prisma, q, admin.id, options);
    console.log(`✓ wrote ${q.slug} (${record.id})`);
    written++;
  }
  console.log(written ? `\nWrote ${written} question(s). Review drafts and publish from /admin.` : 'Nothing to write.');
}

/** host/db only — never print credentials. */
function describeDb(url: string | undefined): string {
  if (!url) return '(DATABASE_URL not set)';
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

main()
  .catch((e) => {
    console.error(e instanceof ContentError ? `\n✗ ${e.message}` : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
