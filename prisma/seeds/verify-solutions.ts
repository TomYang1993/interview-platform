import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transform } from 'sucrase';
import { PYTHON_HARNESS } from '../../lib/runners/python-harness';
import { TEST_COLLECT_ASYNC_CODE, TEST_HARNESS_CODE } from '../../lib/runners/test-harness';
import type { BackendTestCase, SeedQuestion } from './types';

export interface CaseResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface VerifyReport {
  /** False when any official solution fails a test or can't be run. */
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Per-run pass counts, e.g. "python solution · hidden: 8/8". */
  summary: string[];
}

const RUN_TIMEOUT_MS = 60_000;

/**
 * Run every official solution against the question's public and hidden
 * tests with the same harness users are graded by, and run the starter code
 * as a sanity check that the tests can tell a stub from a solution.
 *
 * Python runs on the local `python3`; JS/TS runs in-process. REACT_APP
 * questions can't be verified outside Sandpack and only get a warning.
 */
export async function verifyQuestion(q: SeedQuestion): Promise<VerifyReport> {
  const report: VerifyReport = { ok: true, errors: [], warnings: [], summary: [] };

  if (q.type === 'REACT_APP') {
    report.warnings.push('REACT_APP solutions are not auto-verified — check the draft in the app before publishing.');
    return report;
  }

  const suites = testSuites(q);
  if (suites.length === 0) {
    report.ok = false;
    report.errors.push('no tests to verify against');
    return report;
  }

  for (const sol of q.solutions ?? []) {
    for (const suite of suites) {
      const label = `${sol.language} solution · ${suite.label}`;
      try {
        const results = await runSuite(q, sol.code, sol.language, suite);
        const failed = results.filter((r) => !r.passed);
        report.summary.push(`${label}: ${results.length - failed.length}/${results.length}`);
        if (results.length === 0) {
          report.ok = false;
          report.errors.push(`${label}: no test results — is the test file empty?`);
        }
        for (const f of failed) {
          report.ok = false;
          report.errors.push(`${label}: "${f.name}" failed${f.error ? ` — ${f.error}` : ''}`);
        }
      } catch (e) {
        report.ok = false;
        report.errors.push(`${label}: ${(e as Error).message}`);
      }
    }
  }

  for (const [key, code] of Object.entries(q.starterCode)) {
    const results: CaseResult[] = [];
    try {
      for (const suite of suites) results.push(...(await runSuite(q, code, key, suite)));
    } catch {
      continue; // A starter that doesn't even load can't pass anything.
    }
    if (results.length > 0 && results.every((r) => r.passed)) {
      report.warnings.push(`starter/${key} passes every test — the tests can't tell a stub from a solution.`);
    }
  }

  return report;
}

type Suite =
  | { label: 'public' | 'hidden'; kind: 'cases'; cases: BackendTestCase[] }
  | { label: 'public' | 'hidden'; kind: 'code'; testCode: string };

function testSuites(q: SeedQuestion): Suite[] {
  if (q.language === 'python') {
    return [
      { label: 'public' as const, kind: 'cases' as const, cases: q.publicTestCases ?? [] },
      { label: 'hidden' as const, kind: 'cases' as const, cases: q.hiddenTestCases ?? [] },
    ].filter((s) => s.cases.length > 0);
  }
  return [
    { label: 'public' as const, kind: 'code' as const, testCode: q.publicTestCode ?? '' },
    { label: 'hidden' as const, kind: 'code' as const, testCode: q.hiddenTestCode ?? '' },
  ].filter((s) => s.testCode.trim().length > 0);
}

function runSuite(q: SeedQuestion, code: string, language: string, suite: Suite): Promise<CaseResult[]> {
  if (suite.kind === 'cases') {
    if (!q.functionName) throw new Error('functionName is required for Python questions');
    return runPython(code, suite.cases, q.functionName);
  }
  if (language !== 'javascript' && language !== 'typescript') {
    throw new Error(`can't run "${language}" code against JS tests`);
  }
  return runJs(code, language, suite.testCode);
}

/** Run Python code against structured cases using the shared Pyodide harness. */
export async function runPython(code: string, cases: BackendTestCase[], functionName: string): Promise<CaseResult[]> {
  const dir = mkdtempSync(join(tmpdir(), 'question-verify-'));
  try {
    writeFileSync(join(dir, 'solution.py'), code);
    writeFileSync(join(dir, 'cases.json'), JSON.stringify(cases));
    writeFileSync(join(dir, 'harness.py'), PYTHON_HARNESS.replace('__FN_NAME__', functionName));

    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn('python3', ['-I', 'harness.py'], { cwd: dir });
      let out = '';
      let err = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`timed out after ${RUN_TIMEOUT_MS / 1000}s`));
      }, RUN_TIMEOUT_MS);
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('error', (e) => {
        clearTimeout(timer);
        const missing = (e as NodeJS.ErrnoException).code === 'ENOENT';
        reject(missing ? new Error('python3 not found on PATH — it is needed to verify Python questions') : e);
      });
      child.on('close', (status) => {
        clearTimeout(timer);
        if (status !== 0) reject(new Error(`python3 exited with ${status}: ${err.trim()}`));
        else resolve(out);
      });
    });

    const results: CaseResult[] = [];
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('__LOAD_ERROR__:')) {
        throw new Error(trimmed.slice('__LOAD_ERROR__:'.length));
      }
      if (trimmed.startsWith('__RESULT__:')) {
        const r = JSON.parse(trimmed.slice('__RESULT__:'.length)) as CaseResult;
        results.push({ name: r.name, passed: r.passed, error: r.error });
      }
    }
    return results;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Run JS/TS code against Jest-style test code, mirroring js-test-worker. */
export async function runJs(
  code: string,
  language: 'javascript' | 'typescript',
  testCode: string
): Promise<CaseResult[]> {
  const userCode =
    language === 'typescript'
      ? transform(code, { transforms: ['typescript'], disableESTransforms: true }).code
      : code;

  const fullScript = `
    ${TEST_HARNESS_CODE}

    // ── User code ──
    ${userCode}

    // ── Test code ──
    ${testCode}

    // ── Collect (async) ──
    return ${TEST_COLLECT_ASYNC_CODE};
  `;

  const silentConsole = { log() {}, error() {}, warn() {}, info() {} };
  const runner = new Function('console', fullScript) as (c: typeof silentConsole) => Promise<string>;

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${RUN_TIMEOUT_MS / 1000}s`)), RUN_TIMEOUT_MS);
  });
  try {
    const json = await Promise.race([runner(silentConsole), timeout]);
    return (JSON.parse(json) as { results: CaseResult[] }).results;
  } finally {
    clearTimeout(timer);
  }
}
