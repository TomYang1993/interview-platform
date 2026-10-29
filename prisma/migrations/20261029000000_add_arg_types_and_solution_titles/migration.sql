-- AlterTable
ALTER TABLE "questions" ADD COLUMN "argTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "official_solutions" ADD COLUMN "title" TEXT,
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
