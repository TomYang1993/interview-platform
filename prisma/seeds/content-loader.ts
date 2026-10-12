import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { z } from 'zod';
import type { BackendTestCase, SeedQuestion, SeedSolution } from './types';

/**
 * Loads questions authored as folders (the private content repo format)
 * into the same SeedQuestion shape the public seeds use:
 *
 *   <slug>/
 *     question.json         metadata (see metaSchema)
 *     prompt.md             full prompt shown in the editor
 *     starter/<key>.<ext>   starter code; <key> is the starterCode key
 *                           (python, javascript, typescript, react, reactTypescript)
 *     solutions/<language>.<ext> + solutions/<language>.md
 *                           official solution code + explanation
 *     tests/public.json, tests/hidden.json   FUNCTION_PYTHON cases
 *     tests/public.js,   tests/hidden.js     FUNCTION_JS / REACT_APP test code
 */

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const metaSchema = z
  .object({
    slug: z.string().regex(slugPattern, 'slug must be kebab-case'),
    title: z.string().min(3),
    description: z.string().min(10),
    type: z.enum(['FUNCTION_JS', 'REACT_APP', 'FUNCTION_PYTHON']),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    accessTier: z.enum(['FREE', 'PREMIUM']),
    timeLimitMinutes: z.number().int().positive(),
    tags: z.array(z.string().min(1)).default([]),
    companies: z.array(z.string().min(1)).default([]),
    functionName: z.string().regex(/^[A-Za-z_]\w*$/).optional(),
    /** Complexity note per solution language, e.g. { "python": "O(n) time" }. */
    complexity: z.record(z.string()).default({}),
  })
  .strict();

const casesSchema = z
  .array(
    z
      .object({
        name: z.string().min(1),
        args: z.array(z.unknown()),
        expected: z.unknown().refine((v) => v !== undefined, 'expected is required'),
      })
      .strict()
  )
  .min(1);

export class ContentError extends Error {}

/** True when `dir` is a question folder (has question.json). */
export function isQuestionDir(dir: string): boolean {
  return existsSync(join(dir, 'question.json'));
}

/**
 * Expand CLI paths into question folders: a path is either a question folder
 * itself or a folder searched recursively for them.
 */
export function findQuestionDirs(paths: string[]): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    if (isQuestionDir(dir)) {
      found.push(dir);
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(join(dir, entry.name));
      }
    }
  };
  for (const p of paths) {
    if (!existsSync(p) || !statSync(p).isDirectory()) {
      throw new ContentError(`Not a directory: ${p}`);
    }
    walk(p);
  }
  return [...new Set(found)].sort();
}

export function loadQuestionDir(dir: string): SeedQuestion {
  const fail = (msg: string): never => {
    throw new ContentError(`${dir}: ${msg}`);
  };

  const metaResult = metaSchema.safeParse(readJson(join(dir, 'question.json'), fail));
  if (!metaResult.success) {
    const issue = metaResult.error.issues[0];
    fail(`question.json ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  const meta = metaResult.data!;

  if (basename(dir) !== meta.slug) {
    fail(`folder name "${basename(dir)}" must match slug "${meta.slug}"`);
  }

  const prompt = readText(join(dir, 'prompt.md'), fail).trim() + '\n';

  const starterCode = readCodeFiles(join(dir, 'starter'));
  if (Object.keys(starterCode).length === 0) fail('starter/ has no starter code files');

  const solutions: SeedSolution[] = Object.entries(readCodeFiles(join(dir, 'solutions'))).map(
    ([language, code]) => ({
      language,
      code,
      explanation: readText(join(dir, 'solutions', `${language}.md`), fail).trim(),
      complexity: meta.complexity[language],
    })
  );
  if (solutions.length === 0) fail('solutions/ has no official solution');
  for (const lang of Object.keys(meta.complexity)) {
    if (!solutions.some((s) => s.language === lang)) {
      fail(`complexity.${lang} has no matching solutions/${lang}.* file`);
    }
  }

  const question: SeedQuestion = {
    slug: meta.slug,
    title: meta.title,
    prompt,
    description: meta.description,
    type: meta.type,
    difficulty: meta.difficulty,
    accessTier: meta.accessTier,
    timeLimitMinutes: meta.timeLimitMinutes,
    tags: meta.tags,
    companies: meta.companies,
    starterCode,
    solutions,
  };

  if (meta.type === 'FUNCTION_PYTHON') {
    if (!meta.functionName) fail('functionName is required for FUNCTION_PYTHON');
    if (!starterCode.python) fail('starter/python.py is required for FUNCTION_PYTHON');
    for (const s of solutions) {
      if (s.language !== 'python') fail(`unexpected solution language "${s.language}" for FUNCTION_PYTHON`);
    }
    const publicCases = readCases(join(dir, 'tests', 'public.json'), fail);
    const hiddenCases = readCases(join(dir, 'tests', 'hidden.json'), fail);
    const names = [...publicCases, ...hiddenCases].map((c) => c.name);
    const dupe = names.find((n, i) => names.indexOf(n) !== i);
    if (dupe) fail(`duplicate test case name "${dupe}"`);

    question.language = 'python';
    question.functionName = meta.functionName;
    question.publicTestCases = publicCases;
    question.hiddenTestCases = hiddenCases;
  } else {
    if (meta.functionName) fail(`functionName only applies to FUNCTION_PYTHON`);
    question.publicTestCode = readText(join(dir, 'tests', 'public.js'), fail);
    question.hiddenTestCode = readText(join(dir, 'tests', 'hidden.js'), fail);
  }

  return question;
}

/** Map `<key>.<ext>` code files in `dir` to { key: contents }, ignoring .md. */
function readCodeFiles(dir: string): Record<string, string> {
  if (!existsSync(dir)) return {};
  const out: Record<string, string> = {};
  for (const name of readdirSync(dir).sort()) {
    const ext = extname(name);
    if (!ext || ext === '.md' || name.startsWith('.')) continue;
    const key = name.slice(0, -ext.length);
    if (key in out) throw new ContentError(`${dir}: two files for "${key}"`);
    out[key] = readFileSync(join(dir, name), 'utf8');
  }
  return out;
}

function readText(path: string, fail: (msg: string) => never): string {
  if (!existsSync(path)) fail(`missing ${basename(path)}`);
  return readFileSync(path, 'utf8');
}

function readJson(path: string, fail: (msg: string) => never): unknown {
  const text = readText(path, fail);
  try {
    return JSON.parse(text);
  } catch (e) {
    return fail(`${basename(path)} is not valid JSON: ${(e as Error).message}`);
  }
}

function readCases(path: string, fail: (msg: string) => never): BackendTestCase[] {
  const parsed = casesSchema.safeParse(readJson(path, fail));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(`tests/${basename(path)} [${issue.path.join('.')}]: ${issue.message}`);
  }
  return parsed.data!;
}
