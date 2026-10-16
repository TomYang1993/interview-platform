import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentError, findQuestionDirs, loadQuestionDir } from '@/prisma/seeds/content-loader';
import { verifyQuestion } from '@/prisma/seeds/verify-solutions';

let root: string;

function writeQuestion(slug: string, files: Record<string, string | object>) {
  const dir = join(root, 'questions', slug);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

const pythonMeta = {
  slug: 'add-two',
  title: 'Add Two',
  description: 'Add two numbers together.',
  type: 'FUNCTION_PYTHON',
  difficulty: 'EASY',
  accessTier: 'PREMIUM',
  timeLimitMinutes: 10,
  tags: ['math'],
  functionName: 'add',
  complexity: { python: 'O(1)' },
};

function pythonQuestion(overrides: Record<string, string | object> = {}) {
  return writeQuestion('add-two', {
    'question.json': pythonMeta,
    'prompt.md': 'Implement `add(a, b)`.',
    'starter/python.py': 'def add(a, b):\n    return 0\n',
    'solutions/python.py': 'def add(a, b):\n    return a + b\n',
    'solutions/python.md': 'Return the sum.',
    'tests/public.json': [{ name: 'small', args: [1, 2], expected: 3 }],
    'tests/hidden.json': [{ name: 'negative', args: [-1, -2], expected: -3 }],
    ...overrides,
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'content-test-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('loadQuestionDir', () => {
  it('maps a Python question folder onto SeedQuestion', () => {
    const q = loadQuestionDir(pythonQuestion());
    expect(q).toMatchObject({
      slug: 'add-two',
      type: 'FUNCTION_PYTHON',
      accessTier: 'PREMIUM',
      language: 'python',
      functionName: 'add',
      companies: [],
      starterCode: { python: 'def add(a, b):\n    return 0\n' },
      publicTestCases: [{ name: 'small', args: [1, 2], expected: 3 }],
      hiddenTestCases: [{ name: 'negative', args: [-1, -2], expected: -3 }],
    });
    expect(q.solutions).toEqual([
      { language: 'python', code: 'def add(a, b):\n    return a + b\n', explanation: 'Return the sum.', complexity: 'O(1)' },
    ]);
  });

  it('maps a JS question folder with test code files', () => {
    const dir = writeQuestion('double-it', {
      'question.json': { ...pythonMeta, slug: 'double-it', type: 'FUNCTION_JS', functionName: undefined, complexity: {} },
      'prompt.md': 'Implement `double(n)`.',
      'starter/javascript.js': 'function double(n) {}',
      'solutions/javascript.js': 'function double(n) { return n * 2; }',
      'solutions/javascript.md': 'Multiply by two.',
      'tests/public.js': 'test("2", () => expect(double(2)).toBe(4));',
      'tests/hidden.js': 'test("0", () => expect(double(0)).toBe(0));',
    });
    const q = loadQuestionDir(dir);
    expect(q.publicTestCode).toContain('double(2)');
    expect(q.hiddenTestCode).toContain('double(0)');
    expect(q.language).toBeUndefined();
  });

  it.each([
    ['folder/slug mismatch', { 'question.json': { ...pythonMeta, slug: 'other-slug' } }, /must match slug/],
    ['unparseable hidden tests', { 'tests/hidden.json': '' }, /not valid JSON/],
    ['empty hidden tests', { 'tests/hidden.json': [] }, /hidden\.json/],
    ['case without expected', { 'tests/hidden.json': [{ name: 'x', args: [] }] }, /expected is required/],
    ['duplicate case names', { 'tests/hidden.json': [{ name: 'small', args: [0, 0], expected: 0 }] }, /duplicate test case name "small"/],
    ['missing explanation', { 'solutions/python.md': undefined }, /missing python\.md/],
    ['unknown metadata key', { 'question.json': { ...pythonMeta, isPublished: true } }, /Unrecognized key/],
    ['missing functionName', { 'question.json': { ...pythonMeta, functionName: undefined } }, /functionName is required/],
  ])('rejects %s', (_label, overrides, message) => {
    const files = { ...overrides } as Record<string, string | object>;
    const dir = pythonQuestion(Object.fromEntries(Object.entries(files).filter(([, v]) => v !== undefined)));
    for (const [path, v] of Object.entries(overrides)) {
      if (v === undefined) rmSync(join(dir, path));
    }
    expect(() => loadQuestionDir(dir)).toThrow(message);
  });
});

describe('findQuestionDirs', () => {
  it('finds question folders recursively and accepts a question folder directly', () => {
    const dir = pythonQuestion();
    expect(findQuestionDirs([root])).toEqual([dir]);
    expect(findQuestionDirs([dir])).toEqual([dir]);
  });

  it('throws for a missing path', () => {
    expect(() => findQuestionDirs([join(root, 'nope')])).toThrow(ContentError);
  });
});

describe('verifyQuestion', () => {
  it('passes a correct Python solution', async () => {
    const report = await verifyQuestion(loadQuestionDir(pythonQuestion()));
    expect(report).toEqual({
      ok: true,
      errors: [],
      warnings: [],
      summary: ['python solution · public: 1/1', 'python solution · hidden: 1/1'],
    });
  });

  it('fails a wrong Python solution with the failing case named', async () => {
    const q = loadQuestionDir(pythonQuestion({ 'solutions/python.py': 'def add(a, b):\n    return abs(a) + abs(b)\n' }));
    const report = await verifyQuestion(q);
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual([expect.stringContaining('hidden: "negative" failed — Expected -3, got 3')]);
  });

  it('fails when the solution does not define functionName', async () => {
    const q = loadQuestionDir(pythonQuestion({ 'solutions/python.py': 'class Solution:\n    def add(self, a, b):\n        return a + b\n' }));
    const report = await verifyQuestion(q);
    expect(report.ok).toBe(false);
    expect(report.errors[0]).toMatch(/Function 'add' not found/);
  });

  it('warns when the starter already passes every test', async () => {
    const q = loadQuestionDir(pythonQuestion({ 'starter/python.py': 'def add(a, b):\n    return a + b\n' }));
    const report = await verifyQuestion(q);
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([expect.stringContaining('starter/python passes every test')]);
  });

  it('verifies JS and TS solutions against Jest-style test code', async () => {
    const dir = writeQuestion('double-it', {
      'question.json': { ...pythonMeta, slug: 'double-it', type: 'FUNCTION_JS', functionName: undefined, complexity: {} },
      'prompt.md': 'Implement `double(n)`.',
      'starter/javascript.js': 'function double(n) { return 0; }',
      'solutions/javascript.js': 'function double(n) { return n * 2; }',
      'solutions/javascript.md': 'Multiply by two.',
      'solutions/typescript.ts': 'function double(n: number): number { return n + 1; }',
      'solutions/typescript.md': 'Wrong on purpose.',
      'tests/public.js': 'test("double 1", () => expect(double(1)).toBe(2));',
      'tests/hidden.js': 'test("double 3", () => expect(double(3)).toBe(6));',
    });
    const report = await verifyQuestion(loadQuestionDir(dir));
    expect(report.ok).toBe(false);
    expect(report.summary).toEqual([
      'javascript solution · public: 1/1',
      'javascript solution · hidden: 1/1',
      'typescript solution · public: 1/1',
      'typescript solution · hidden: 0/1',
    ]);
  });
});

describe('lintQuestion', () => {
  it('names the file for callout problems in the prompt and solution explanation', async () => {
    const { lintQuestion } = await import('@/prisma/seeds/content-loader');
    const q = loadQuestionDir(
      pythonQuestion({
        'prompt.md': 'Implement `add(a, b)`.\n\n> [!warn] Watch out\n> overflow',
        'solutions/python.md': '> [!Tip] Sum it\n> easy',
      })
    );
    expect(lintQuestion(q)).toEqual([
      "prompt.md line 3: [!warn] won't render as a callout — use [!warning]",
      "solutions/python.md line 1: [!Tip] won't render as a callout — use [!tip]",
    ]);
  });
});
