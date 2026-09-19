import { QuestionType, Difficulty, AccessTier } from '@prisma/client';

export interface SeedSolution {
  language: string;
  code: string;
  explanation: string;
  complexity?: string;
}

/** Structured backend test case: function called with `args`, output deep-compared to `expected`. */
export interface BackendTestCase {
  name: string;
  args: unknown[];
  expected: unknown;
}

export interface SeedQuestion {
  slug: string;
  title: string;
  prompt: string;
  description: string;
  type: QuestionType;
  difficulty: Difficulty;
  accessTier: AccessTier;
  /** Topic tag names — resolved to IDs in seed.ts */
  tags: string[];
  /** Companies the question was asked at (COMPANY tags). */
  companies?: string[];
  starterCode: Record<string, string>;
  timeLimitMinutes: number;

  // Frontend (JS/React) questions — Jest-style test source.
  publicTestCode?: string;
  hiddenTestCode?: string;

  // Backend (Python/Go/Java/Rust) questions — structured JSON cases + entrypoint.
  language?: 'python' | 'go' | 'java' | 'rust';
  functionName?: string;
  publicTestCases?: BackendTestCase[];
  hiddenTestCases?: BackendTestCase[];

  solutions?: SeedSolution[];
}
