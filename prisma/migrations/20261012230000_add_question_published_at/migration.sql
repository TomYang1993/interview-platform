-- AlterTable
ALTER TABLE "questions" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Backfill: Largest Tree Root is the first question published since the
-- "what's new" feed started. Use its version's publish time; every older
-- question stays NULL and sorts after dated ones. No-op where it doesn't exist.
UPDATE "questions" q
SET "publishedAt" = COALESCE(v."publishedAt", q."updatedAt")
FROM "question_versions" v
WHERE v."questionId" = q."id"
  AND v."version" = 1
  AND q."slug" = 'largest-tree-root'
  AND q."isPublished" = true;
