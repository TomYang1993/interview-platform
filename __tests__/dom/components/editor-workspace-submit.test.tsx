import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { SubmitResult, TestResult } from '@/components/bottom-panel';

// Submit must score the code being submitted: public tests are re-run against it
// and merged with hidden results, never taken from a previous Run.

const { jsRunTests, pyRunTests } = vi.hoisted(() => ({
  jsRunTests: vi.fn(),
  pyRunTests: vi.fn()
}));

vi.mock('@/hooks/use-js-runner', () => ({
  useJsRunner: () => ({ runTests: jsRunTests })
}));
vi.mock('@/hooks/use-py-runner', () => ({
  usePyRunner: () => ({ runTests: pyRunTests })
}));
vi.mock('@monaco-editor/react', () => ({
  default: ({ defaultValue, onChange }: { defaultValue: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="editor"
      defaultValue={defaultValue}
      onChange={e => onChange(e.target.value)}
    />
  )
}));
vi.mock('@/components/bottom-panel', () => ({
  BottomPanel: ({ testResults, submitResult }: { testResults: TestResult[]; submitResult: SubmitResult | null }) => (
    <div>
      <pre data-testid="test-results">{JSON.stringify(testResults)}</pre>
      <pre data-testid="submit-result">{JSON.stringify(submitResult)}</pre>
    </div>
  )
}));
vi.mock('@/components/tabs/description-tab', () => ({ DescriptionTab: () => <div /> }));
vi.mock('@/components/tabs/solutions-tab', () => ({ SolutionsTab: () => <div /> }));
vi.mock('@/components/tabs/submissions-tab', () => ({ SubmissionsTab: () => <div /> }));
vi.mock('@/components/cheatsheet-modal', () => ({ CheatsheetModal: () => <div /> }));
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => <div /> }));
vi.mock('@/components/countdown-timer', () => ({ CountdownTimer: () => <div /> }));
vi.mock('@/components/toast-provider', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/hooks/use-debounce', () => ({ useDebounce: <T,>(v: T) => v }));

const STARTER = 'def add(a, b):\n    return 0';
const SOLUTION = 'def add(a, b):\n    return a + b';

// Fake runner: every case passes for SOLUTION, fails for anything else.
function fakeRun(code: string, count: number, prefix: string) {
  const ok = code === SOLUTION;
  return {
    passed: ok,
    logs: [],
    runtimeMs: 0,
    results: Array.from({ length: count }, (_, i) => ({
      name: `${prefix} ${i + 1}`,
      passed: ok,
      ...(ok ? {} : { error: 'Expected: 3\nReceived: 0' })
    }))
  };
}

const publicCases = [1, 2, 3].map(n => ({ name: `public ${n}`, args: [n, n], expected: n * 2 }));
const hiddenCases = Array.from({ length: 9 }, (_, n) => ({ name: `hidden ${n}`, args: [n, 1], expected: n + 1 }));

const pyProps = {
  questionId: 'q1',
  slug: 'add',
  questionType: 'FUNCTION_PYTHON' as const,
  title: 'Add',
  prompt: 'Add two numbers',
  difficulty: 'EASY',
  tags: [] as string[],
  starterCode: { python: STARTER },
  publicTestCode: '',
  publicTestCases: publicCases,
  functionName: 'add'
};

let judgeBodies: { clientResults: { passedCount: number; total: number; score: number } }[];

beforeEach(() => {
  judgeBodies = [];
  pyRunTests.mockReset().mockImplementation(async (code: string, cases: unknown[]) =>
    fakeRun(code, cases.length, cases === publicCases ? 'public' : 'hidden')
  );
  jsRunTests.mockReset().mockImplementation(async (code: string, testCode: string) =>
    fakeRun(code, testCode === 'PUBLIC' ? 3 : 9, testCode === 'PUBLIC' ? 'public' : 'hidden')
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/hidden-tests')) {
        return {
          ok: true,
          json: async () => ({ functionName: 'add', testCases: hiddenCases, testCode: 'HIDDEN' })
        };
      }
      if (url === '/api/submissions/judge-hidden') {
        const body = JSON.parse(String(init?.body));
        judgeBodies.push(body);
        return { ok: true, json: async () => ({ ...body.clientResults }) };
      }
      return { ok: true, json: async () => ({}) };
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function readJson<T>(testId: string): T {
  return JSON.parse(screen.getByTestId(testId).textContent ?? 'null') as T;
}

async function submitAndWait() {
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));
  await waitFor(() => expect(readJson<SubmitResult | null>('submit-result')).not.toBeNull());
  return readJson<SubmitResult>('submit-result');
}

describe('<EditorWorkspace /> submit scoring', () => {
  it('re-runs public tests on submit instead of reusing a stale Run (Python)', async () => {
    const { EditorWorkspace } = await import('@/components/editor-workspace');
    render(<EditorWorkspace {...pyProps} />);

    // Run with the starter: public tests fail.
    fireEvent.click(screen.getByRole('button', { name: /run/i }));
    await waitFor(() => expect(readJson<TestResult[]>('test-results')).toHaveLength(3));
    expect(readJson<TestResult[]>('test-results').every(r => !r.passed)).toBe(true);

    // Paste a correct solution and submit.
    fireEvent.change(screen.getByTestId('editor'), { target: { value: SOLUTION } });
    const result = await submitAndWait();

    expect(result).toMatchObject({ score: 100, status: 'PASSED', passedCount: 12, total: 12 });
    expect(result.publicResults.every(r => r.passed)).toBe(true);
    expect(result.hiddenResults).toHaveLength(9);
    // Tests tab reflects the submitted code too.
    expect(readJson<TestResult[]>('test-results').every(r => r.passed)).toBe(true);
    // Stored score matches the displayed one.
    expect(judgeBodies[0].clientResults).toMatchObject({ passedCount: 12, total: 12, score: 100 });
    expect(pyRunTests).toHaveBeenLastCalledWith(SOLUTION, hiddenCases, 'add');
  });

  it('includes public results when Run was never clicked (Python)', async () => {
    const { EditorWorkspace } = await import('@/components/editor-workspace');
    render(<EditorWorkspace {...pyProps} />);

    const result = await submitAndWait();

    expect(result).toMatchObject({ score: 0, status: 'FAILED', passedCount: 0, total: 12 });
    expect(result.publicResults).toHaveLength(3);
    expect(judgeBodies[0].clientResults).toMatchObject({ passedCount: 0, total: 12, score: 0 });
  });

  it('re-runs public tests on submit (JS)', async () => {
    const { EditorWorkspace } = await import('@/components/editor-workspace');
    render(
      <EditorWorkspace
        {...pyProps}
        questionType="FUNCTION_JS"
        starterCode={{ javascript: STARTER }}
        publicTestCode="PUBLIC"
        publicTestCases={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /run/i }));
    await waitFor(() => expect(readJson<TestResult[]>('test-results')).toHaveLength(3));

    fireEvent.change(screen.getByTestId('editor'), { target: { value: SOLUTION } });
    const result = await submitAndWait();

    expect(result).toMatchObject({ score: 100, status: 'PASSED', passedCount: 12, total: 12 });
    expect(result.publicResults.every(r => r.passed)).toBe(true);
    expect(judgeBodies[0]).toMatchObject({
      framework: 'javascript',
      clientResults: { passedCount: 12, total: 12, score: 100 }
    });
  });
});
