import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { z } from 'zod';
import type { BackendTestCase, SeedQuestion, SeedSolution } from './types';
import { lintCallouts } from '../../lib/markdown-callouts';
import { PYTHON_ARG_TYPES } from '../../lib/runners/python-harness';

/**
 * Loads questions authored as folders (the private content repo format)
 * into the same SeedQuestion shape the public seeds use:
 *
 *   <slug>/
 *     question.json         metadata (see metaSchema)
 *     prompt.md             full prompt shown in the editor
 *     starter/<key>.<ext>   starter code; <key> is the starterCode key
 *                           (python, javascript, typescript, react, reactTypescript)
 *     solutions/<key>.<ext> + solutions/<key>.md
 *                           official solution code + explanation; <key> is
 *                           the language, optionally followed by an approach
 *                           (python.py, python.iterative.py)
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
    /** How the grader converts each positional arg, e.g. ["tree"]. FUNCTION_PYTHON only. */
    argTypes: z.array(z.enum(PYTHON_ARG_TYPES)).optional(),
    /** Complexity note per solution key, e.g. { "python": "O(n) time" }. */
    complexity: z.record(z.string()).default({}),
    /**
     * Card title per solution key, e.g. { "python": "Recursive DFS" }. Listed
     * order is display order. Required for every solution once there are two.
     */
    solutionTitles: z.record(z.string().min(1)).default({}),
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

  // Display order: keys listed in solutionTitles first, in that order; then
  // the rest by name, which puts a bare `python` before `python.<approach>`.
  const titleOrder = Object.keys(meta.solutionTitles);
  const orderOf = (key: string) => (titleOrder.includes(key) ? titleOrder.indexOf(key) : titleOrder.length);
  const solutions: SeedSolution[] = Object.entries(readCodeFiles(join(dir, 'solutions')))
    .sort(([a], [b]) => orderOf(a) - orderOf(b) || a.localeCompare(b))
    .map(([key, code], position) => ({
      key,
      language: key.split('.')[0],
      title: meta.solutionTitles[key],
      position,
      code,
      explanation: readText(join(dir, 'solutions', `${key}.md`), fail).trim(),
      complexity: meta.complexity[key],
    }));
  if (solutions.length === 0) fail('solutions/ has no official solution');
  for (const [field, map] of [['complexity', meta.complexity], ['solutionTitles', meta.solutionTitles]] as const) {
    for (const key of Object.keys(map)) {
      if (!solutions.some((s) => s.key === key)) fail(`${field}.${key} has no matching solutions/${key}.* file`);
    }
  }
  for (const s of solutions) {
    if (!s.title && solutions.some((o) => o !== s && o.language === s.language)) {
      fail(`solutionTitles.${s.key} is required when ${s.language} has more than one solution`);
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
    question.argTypes = meta.argTypes ?? [];
    for (const c of [...publicCases, ...hiddenCases]) {
      if (meta.argTypes && c.args.length !== meta.argTypes.length) {
        fail(`test "${c.name}" has ${c.args.length} args but argTypes lists ${meta.argTypes.length}`);
      }
    }
    question.publicTestCases = publicCases;
    question.hiddenTestCases = hiddenCases;
  } else {
    if (meta.functionName) fail(`functionName only applies to FUNCTION_PYTHON`);
    if (meta.argTypes) fail(`argTypes only applies to FUNCTION_PYTHON`);
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

/**
 * Non-blocking checks on a loaded question's markdown — currently callouts
 * that won't render (e.g. `[!warn]`, `[!INFO]`). Each message names the file.
 */
export function lintQuestion(q: SeedQuestion): string[] {
  const files: [string, string][] = [
    ['prompt.md', q.prompt],
    ...(q.solutions ?? []).map((s): [string, string] => [`solutions/${s.key ?? s.language}.md`, s.explanation]),
  ];
  return files.flatMap(([file, markdown]) => lintCallouts(markdown).map((p) => `${file} ${p}`));
}
