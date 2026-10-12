/// <reference lib="webworker" />
import { PYTHON_HARNESS } from '@/lib/runners/python-harness';

interface PyodideInterface {
  FS: { writeFile: (path: string, data: string | Uint8Array) => void };
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
}

type PyodideGlobal = {
  loadPyodide: (opts?: { indexURL?: string }) => Promise<PyodideInterface>;
  importScripts: (url: string) => void;
};
const pyGlobal = self as unknown as PyodideGlobal;

interface PyCase {
  name: string;
  args: unknown[];
  expected: unknown;
}

interface RunMessage {
  type: 'RUN';
  userCode: string;
  cases: PyCase[];
  functionName: string;
}

interface ResultMessage {
  type: 'RESULT';
  passed: boolean;
  results: { name: string; passed: boolean; error?: string }[];
  logs: string[];
  runtimeMs: number;
}

interface ErrorMessage {
  type: 'ERROR';
  error: string;
}

const PYODIDE_VERSION = '0.29.4';
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise: Promise<PyodideInterface> | null = null;

function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyGlobal.importScripts(`${PYODIDE_CDN}pyodide.js`);
    pyodidePromise = pyGlobal.loadPyodide({ indexURL: PYODIDE_CDN });
  }
  return pyodidePromise;
}

self.onmessage = async (e: MessageEvent<RunMessage>) => {
  const { type, userCode, cases, functionName } = e.data;
  if (type !== 'RUN') return;

  const started = performance.now();
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  try {
    const py = await getPyodide();

    py.setStdout({ batched: (s: string) => stdoutLines.push(s) });
    py.setStderr({ batched: (s: string) => stderrLines.push(s) });

    py.FS.writeFile('solution.py', userCode);
    py.FS.writeFile('cases.json', JSON.stringify(cases));

    const harness = PYTHON_HARNESS.replace('__FN_NAME__', functionName);
    await py.runPythonAsync(harness);

    const results: { name: string; passed: boolean; error?: string }[] = [];
    let loadError: string | null = null;

    for (const line of stdoutLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('__LOAD_ERROR__:')) {
        loadError = trimmed.slice('__LOAD_ERROR__:'.length);
        continue;
      }
      if (!trimmed.startsWith('__RESULT__:')) {
        // user print() output → logs (even if it happens to be valid JSON)
        stderrLines.push(trimmed);
        continue;
      }
      const parsed = JSON.parse(trimmed.slice('__RESULT__:'.length)) as {
        name: string;
        passed: boolean;
        error?: string;
      };
      results.push({ name: parsed.name, passed: parsed.passed, error: parsed.error });
    }

    if (loadError) {
      const message: ResultMessage = {
        type: 'RESULT',
        passed: false,
        results: cases.map((c) => ({ name: c.name, passed: false, error: loadError! })),
        logs: stderrLines,
        runtimeMs: Math.round(performance.now() - started),
      };
      self.postMessage(message);
      return;
    }

    const allPassed = results.length > 0 && results.every((r) => r.passed);
    const message: ResultMessage = {
      type: 'RESULT',
      passed: allPassed,
      results,
      logs: stderrLines,
      runtimeMs: Math.round(performance.now() - started),
    };
    self.postMessage(message);
  } catch (err) {
    const message: ErrorMessage = {
      type: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(message);
  }
};
