'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { JsRunResult } from './use-js-runner';

export interface PyCase {
  name: string;
  args: unknown[];
  expected: unknown;
}

const TIMEOUT_MS = 15_000;

interface UsePyRunnerReturn {
  runTests: (
    userCode: string,
    cases: PyCase[],
    functionName: string,
    argTypes?: string[],
  ) => Promise<JsRunResult>;
}

/**
 * Client-side Python test runner.
 *
 * Spawns a Web Worker that loads Pyodide from the jsDelivr CDN. The worker
 * writes solution.py + cases.json into Pyodide's virtual FS and executes
 * the same harness shape as the legacy Vercel Sandbox path — so results
 * land in the JS runner's JsRunResult shape and the existing UI just works.
 *
 * First run pays the Pyodide download (~6-8MB, cached by the browser).
 * Subsequent runs warm-start in tens of ms.
 */
export function usePyRunner(): UsePyRunnerReturn {
  const activeWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      activeWorkerRef.current?.terminate();
      activeWorkerRef.current = null;
    };
  }, []);

  const runTests = useCallback(
    (userCode: string, cases: PyCase[], functionName: string, argTypes: string[] = []) => {
      return new Promise<JsRunResult>((resolve) => {
        activeWorkerRef.current?.terminate();

        const worker = new Worker(
          new URL('@/lib/runners/client/py-test-worker.ts', import.meta.url),
        );
        activeWorkerRef.current = worker;

        const cleanup = () => {
          worker.terminate();
          if (activeWorkerRef.current === worker) {
            activeWorkerRef.current = null;
          }
          clearTimeout(timeoutId);
        };

        const timeoutId = setTimeout(() => {
          cleanup();
          resolve({
            passed: false,
            results: [
              {
                name: 'Execution Error',
                passed: false,
                error: `Execution timed out after ${TIMEOUT_MS / 1000}s — possible infinite loop`,
              },
            ],
            logs: [],
            runtimeMs: TIMEOUT_MS,
          });
        }, TIMEOUT_MS);

        worker.onmessage = (e: MessageEvent) => {
          if (e.data?.type === 'RESULT') {
            cleanup();
            resolve({
              passed: e.data.passed,
              results: e.data.results,
              logs: e.data.logs,
              runtimeMs: e.data.runtimeMs,
            });
          } else if (e.data?.type === 'ERROR') {
            cleanup();
            resolve({
              passed: false,
              results: [{ name: 'Execution Error', passed: false, error: e.data.error }],
              logs: [],
              runtimeMs: 0,
            });
          }
        };

        worker.onerror = (err) => {
          cleanup();
          resolve({
            passed: false,
            results: [
              { name: 'Execution Error', passed: false, error: err.message || 'Worker error' },
            ],
            logs: [],
            runtimeMs: 0,
          });
        };

        worker.postMessage({ type: 'RUN', userCode, cases, functionName, argTypes });
      });
    },
    [],
  );

  return { runTests };
}
