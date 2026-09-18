-- CreateEnum
CREATE TYPE "TagKind" AS ENUM ('TOPIC', 'COMPANY');

-- AlterTable
ALTER TABLE "question_tags" ADD COLUMN "kind" "TagKind" NOT NULL DEFAULT 'TOPIC';

-- Seed the initial company tags. Existing rows with the same name (any case)
-- are promoted and renamed to the canonical casing; the rest are inserted.
CREATE TEMP TABLE seed_companies ("id" TEXT, "name" TEXT) ON COMMIT DROP;
INSERT INTO seed_companies VALUES
  ('ctag_meta', 'Meta'), ('ctag_doordash', 'DoorDash'), ('ctag_netflix', 'Netflix'),
  ('ctag_roblox', 'Roblox'), ('ctag_linkedin', 'LinkedIn'), ('ctag_tiktok', 'TikTok'),
  ('ctag_pinterest', 'Pinterest'), ('ctag_snowflake', 'Snowflake'), ('ctag_coinbase', 'Coinbase'),
  ('ctag_stripe', 'Stripe'), ('ctag_google', 'Google'), ('ctag_amazon', 'Amazon'),
  ('ctag_microsoft', 'Microsoft'), ('ctag_bloomberg', 'Bloomberg'), ('ctag_uber', 'Uber'),
  ('ctag_anthropic', 'Anthropic'), ('ctag_openai', 'OpenAI'), ('ctag_visa', 'Visa');

UPDATE "question_tags" t
SET "kind" = 'COMPANY', "name" = s."name"
FROM seed_companies s
WHERE lower(t."name") = lower(s."name");

INSERT INTO "question_tags" ("id", "name", "kind")
SELECT s."id", s."name", 'COMPANY'
FROM seed_companies s
WHERE NOT EXISTS (SELECT 1 FROM "question_tags" t WHERE lower(t."name") = lower(s."name"));
