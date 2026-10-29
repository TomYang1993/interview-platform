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
      {
        key: 'python',
        language: 'python',
        position: 0,
        code: 'def add(a, b):\n    return a + b\n',
        explanation: 'Return the sum.',
        complexity: 'O(1)',
      },
    ]);
    expect(q.argTypes).toEqual([]);
  });

  it('loads several approaches per language, ordered as listed in solutionTitles', () => {
    const q = loadQuestionDir(
      pythonQuestion({
        'question.json': {
          ...pythonMeta,
          complexity: { python: 'O(1)', 'python.loop': 'O(|b|)' },
          solutionTitles: { 'python.loop': 'Counting up', python: 'Plus operator' },
        },
        'solutions/python.loop.py': 'def add(a, b):\n    return sum([a, b])\n',
        'solutions/python.loop.md': 'Loop it.',
      })
    );
    expect(q.solutions?.map(({ key, language, title, position, complexity }) => ({ key, language, title, position, complexity }))).toEqual([
      { key: 'python.loop', language: 'python', title: 'Counting up', position: 0, complexity: 'O(|b|)' },
      { key: 'python', language: 'python', title: 'Plus operator', position: 1, complexity: 'O(1)' },
    ]);
  });

  it('reads argTypes for Python questions', () => {
    const q = loadQuestionDir(pythonQuestion({ 'question.json': { ...pythonMeta, argTypes: ['json', 'json'] } }));
    expect(q.argTypes).toEqual(['json', 'json']);
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
    [
      'a second approach without a title',
      { 'solutions/python.loop.py': 'def add(a, b):\n    return a + b\n', 'solutions/python.loop.md': 'Loop.' },
      /solutionTitles\.python is required when python has more than one solution/,
    ],
    ['a title with no solution file', { 'question.json': { ...pythonMeta, solutionTitles: { 'python.fast': 'Fast' } } }, /solutionTitles\.python\.fast has no matching/],
    ['an unknown arg type', { 'question.json': { ...pythonMeta, argTypes: ['graph', 'json'] } }, /argTypes\.0/],
    ['argTypes that miss an arg', { 'question.json': { ...pythonMeta, argTypes: ['json'] } }, /test "small" has 2 args but argTypes lists 1/],
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

  it('builds tree args and verifies every approach', async () => {
    const dir = writeQuestion('tree-sum', {
      'question.json': {
        ...pythonMeta,
        slug: 'tree-sum',
        functionName: 'tree_sum',
        argTypes: ['tree'],
        complexity: {},
        solutionTitles: { python: 'Recursive', 'python.stack': 'Iterative' },
      },
      'prompt.md': 'Implement `tree_sum(root)`.',
      'starter/python.py': 'def tree_sum(root):\n    return 0\n',
      // TreeNode is provided by the grader; the annotation proves it exists before the code runs.
      'solutions/python.py':
        'from typing import Optional\n\ndef tree_sum(root: Optional[TreeNode]) -> int:\n' +
        '    return 0 if root is None else root.val + tree_sum(root.left) + tree_sum(root.right)\n',
      'solutions/python.md': 'Recurse.',
      'solutions/python.stack.py':
        'def tree_sum(root):\n    total, stack = 0, [root]\n    while stack:\n        node = stack.pop()\n' +
        '        if node:\n            total += node.val\n            stack += [node.left, node.right]\n    return total\n',
      'solutions/python.stack.md': 'Use a stack.',
      'tests/public.json': [
        { name: 'full', args: [[1, 2, 3]], expected: 6 },
        { name: 'empty', args: [[]], expected: 0 },
      ],
      'tests/hidden.json': [
        { name: 'gaps', args: [[1, null, 2, null, 3]], expected: 6 },
        { name: 'deep chain', args: [[1, ...Array.from({ length: 299 }, () => [null, 1]).flat()]], expected: 300 },
      ],
    });
    const report = await verifyQuestion(loadQuestionDir(dir));
    expect(report).toEqual({
      ok: true,
      errors: [],
      warnings: [],
      summary: [
        'python solution · public: 2/2',
        'python solution · hidden: 2/2',
        'python.stack solution · public: 2/2',
        'python.stack solution · hidden: 2/2',
      ],
    });
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
