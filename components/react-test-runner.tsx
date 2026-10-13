'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { SandpackProvider, SandpackTests, useSandpack } from '@codesandbox/sandpack-react';
import { withReactInScope } from '@/lib/runners/react-scope';

export interface ReactTestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export interface ReactTestRunResult {
  passedCount: number;
  total: number;
  runtimeMs: number;
  results: ReactTestResult[];
}

interface ReactTestRunnerProps {
  appCode: string;
  stylesCode: string;
  language: 'js' | 'ts';
  testCode: string;
  onComplete: (result: ReactTestRunResult) => void;
  onError: (message: string) => void;
}

const TEST_HEADER = `import React from 'react';
import UserComponent from './App';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Fake timer shim — Sandpack's jest-lite ships without useFakeTimers/advanceTimersByTime.
// Patches setTimeout/setInterval/clearTimeout/clearInterval/Date.now while installed.
(() => {
  const g = globalThis;
  if (typeof g.jest === 'undefined') g.jest = {};
  if (typeof g.jest.advanceTimersByTime === 'function') return;

  const real = {
    setTimeout: g.setTimeout.bind(g),
    clearTimeout: g.clearTimeout.bind(g),
    setInterval: g.setInterval.bind(g),
    clearInterval: g.clearInterval.bind(g),
    dateNow: Date.now.bind(Date),
  };
  let installed = false;
  let nowMs = 0;
  let nextId = 1;
  const timers = new Map();

  const install = () => {
    if (installed) return;
    installed = true;
    nowMs = real.dateNow();
    g.setTimeout = (cb, ms) => {
      const id = nextId++;
      timers.set(id, { time: nowMs + (ms || 0), cb });
      return id;
    };
    g.clearTimeout = (id) => { timers.delete(id); };
    g.setInterval = (cb, ms) => {
      const id = nextId++;
      timers.set(id, { time: nowMs + (ms || 0), cb, interval: ms || 0 });
      return id;
    };
    g.clearInterval = (id) => { timers.delete(id); };
    Date.now = () => nowMs;
  };

  const uninstall = () => {
    if (!installed) return;
    installed = false;
    g.setTimeout = real.setTimeout;
    g.clearTimeout = real.clearTimeout;
    g.setInterval = real.setInterval;
    g.clearInterval = real.clearInterval;
    Date.now = real.dateNow;
    timers.clear();
  };

  const advance = (ms) => {
    const target = nowMs + (ms || 0);
    // Loop firing due timers, smallest-time first, until none remain <= target.
    // Intervals reschedule themselves; setTimeout entries get deleted on fire.
    while (true) {
      let dueId = null;
      let dueEntry = null;
      for (const [id, t] of timers) {
        if (t.time <= target && (!dueEntry || t.time < dueEntry.time)) {
          dueId = id;
          dueEntry = t;
        }
      }
      if (!dueEntry) break;
      nowMs = dueEntry.time;
      if (typeof dueEntry.interval === 'number') {
        dueEntry.time = nowMs + dueEntry.interval;
      } else {
        timers.delete(dueId);
      }
      try { dueEntry.cb(); } catch (e) { /* swallow timer errors */ }
    }
    nowMs = target;
  };

  g.jest.useFakeTimers = install;
  g.jest.useRealTimers = uninstall;
  g.jest.advanceTimersByTime = advance;
  g.jest.runOnlyPendingTimers = () => {
    while (timers.size > 0) {
      let dueId = null;
      let dueEntry = null;
      for (const [id, t] of timers) {
        if (!dueEntry || t.time < dueEntry.time) { dueId = id; dueEntry = t; }
      }
      if (!dueEntry) break;
      nowMs = dueEntry.time;
      if (typeof dueEntry.interval === 'number') {
        dueEntry.time = nowMs + dueEntry.interval;
      } else {
        timers.delete(dueId);
      }
      try { dueEntry.cb(); } catch (e) {}
    }
  };
})();

`;


type SpecTest = {
  name: string;
  status: 'pass' | 'fail' | 'idle' | 'running';
  errors?: Array<{ message?: string; matcherResult?: { message?: string } } | string>;
  duration?: number;
  blocks?: string[];
};

type SpecDescribe = {
  name: string;
  tests: Record<string, SpecTest>;
  describes: Record<string, SpecDescribe>;
};

type Spec = {
  name: string;
  tests: Record<string, SpecTest>;
  describes: Record<string, SpecDescribe>;
  error?: { message?: string };
};

function flattenSpec(spec: Spec): SpecTest[] {
  const out: SpecTest[] = [];
  const visit = (tests: Record<string, SpecTest>, describes: Record<string, SpecDescribe>) => {
    Object.values(tests).forEach((t) => out.push(t));
    Object.values(describes).forEach((d) => visit(d.tests, d.describes));
  };
  visit(spec.tests, spec.describes);
  return out;
}

function formatError(t: SpecTest): string {
  if (!t.errors || t.errors.length === 0) return 'Test failed';
  const first = t.errors[0];
  if (typeof first === 'string') return first;
  return (
    first.matcherResult?.message ||
    first.message ||
    'Test failed'
  );
}

export function ReactTestRunner({
  appCode,
  stylesCode,
  language,
  testCode,
  onComplete,
  onError,
}: ReactTestRunnerProps) {
  const fired = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = 'test-ts';
  const appFile = language === 'ts' ? '/App.tsx' : '/App.js';
  const testFile = language === 'ts' ? '/App.test.tsx' : '/App.test.js';

  // Stable refs for callbacks to avoid re-triggering effects / SandpackTests
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  const files = useMemo(
    () => ({
      [appFile]: withReactInScope(appCode),
      '/styles.css': stylesCode,
      [testFile]: TEST_HEADER + testCode,
      '/add.ts': '',
      '/add.test.ts': `test('dummy template test', () => { expect(true).toBe(true); });`,
    }),
    [appFile, testFile, appCode, stylesCode, testCode],
  );

  const customSetup = useMemo(
    () => ({
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        '@testing-library/react': '^14.3.0',
        '@testing-library/jest-dom': '^6.0.0',
        '@testing-library/user-event': '^14.0.0',
      },
    }),
    [],
  );

  // Timeout safety-net (120s)
  useEffect(() => {
    const TIMEOUT_MS = 120_000;
    timeoutRef.current = setTimeout(() => {
      if (fired.current) return;
      fired.current = true;
      onErrorRef.current(`Test run timed out after ${TIMEOUT_MS / 1000}s`);
    }, TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleComplete = useCallback((rawSpecs: Record<string, unknown>) => {
    if (fired.current) return;
    fired.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const specs = { ...rawSpecs } as Record<string, Spec>;
    delete specs['/add.test.ts'];

    const specList = Object.values(specs);
    const fileErrorSpec = specList.find((s) => s.error);
    if (fileErrorSpec?.error) {
      onErrorRef.current(fileErrorSpec.error.message || 'Failed to load test file');
      return;
    }

    const allTests = specList.flatMap(flattenSpec);
    let runtimeMs = 0;
    const results: ReactTestResult[] = allTests.map((t) => {
      const durationMs = t.duration ?? 0;
      runtimeMs += durationMs;
      const passed = t.status === 'pass';
      return {
        name: [...(t.blocks || []), t.name].join(' › '),
        passed,
        error: passed ? undefined : formatError(t),
        durationMs,
      };
    });
    const passedCount = results.filter((r) => r.passed).length;
    onCompleteRef.current({
      passedCount,
      total: results.length,
      runtimeMs: Math.round(runtimeMs),
      results,
    });
  }, []);

  const wrapperStyle: React.CSSProperties = {
    position: 'fixed',
    width: 1,
    height: 1,
    overflow: 'hidden',
    pointerEvents: 'none',
    opacity: 0,
    left: -9999,
    top: -9999,
  };

  return (
    <div aria-hidden style={wrapperStyle}>
      <SandpackProvider
        template={template}
        files={files}
        customSetup={customSetup}
        options={{
          activeFile: testFile,
          initMode: 'immediate',
          recompileMode: 'immediate',
          visibleFiles: [testFile],
        }}
        style={{ height: '100%' }}
      >
        <SandpackTests onComplete={handleComplete} style={{ height: '100%' }} />
        <DebugListener />
      </SandpackProvider>
    </div>
  );
}

function DebugListener() {
  const { listen, sandpack } = useSandpack();
  const lastIdRef = useRef<string | null>(null);

  // Hack: SandpackTests renders an iframe with style={{ display: 'none' }}.
  // In Next.js dev server mode, the browser aggressively throttles/suspends display: none iframes.
  // We periodically find the iframe and force it to be visible (1x1px, opacity: 0.01) to keep it active.
  useEffect(() => {
    const fixIFrame = () => {
      const iframes = document.querySelectorAll('iframe[title="Sandpack Tests"]');
      iframes.forEach((iframe) => {
        const htmlIframe = iframe as HTMLIFrameElement;
        if (htmlIframe.style.display === 'none') {
          htmlIframe.style.display = 'block';
          htmlIframe.style.opacity = '0.01';
          htmlIframe.style.width = '1px';
          htmlIframe.style.height = '1px';
          htmlIframe.style.position = 'absolute';
          htmlIframe.style.pointerEvents = 'none';
        }
      });
    };

    fixIFrame();
    const interval = setInterval(fixIFrame, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let started = false;

    const unsub = listen((msg) => {
      // Capture the active client's channel ID
      const rawMsg = msg as { $id?: string; event?: string };
      if (rawMsg.$id) {
        lastIdRef.current = rawMsg.$id;
      }

      const event = rawMsg.event;
      if (msg.type === 'test') {
        if (event === 'test_count' || event === 'initialize_tests') {
          if (!interval && !started) {
            interval = setInterval(() => {
              if (started) {
                if (interval) clearInterval(interval);
                return;
              }
              
              const id = lastIdRef.current;
              if (id) {
                // 1. Direct postMessage to all iframes in the DOM with correct signature
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach((iframe) => {
                  const htmlIframe = iframe as HTMLIFrameElement;
                  htmlIframe.contentWindow?.postMessage({ 
                    type: 'run-all-tests',
                    $id: id,
                    codesandbox: true
                  }, '*');
                  if (sandpack.activeFile) {
                    htmlIframe.contentWindow?.postMessage({ 
                      type: 'run-tests', 
                      path: sandpack.activeFile,
                      $id: id,
                      codesandbox: true
                    }, '*');
                  }
                });
              }

              // 2. Sandpack client.dispatch fallback
              Object.values(sandpack.clients).forEach((client) => {
                try {
                  client.dispatch({ type: 'run-all-tests' });
                  if (sandpack.activeFile) {
                    client.dispatch({ type: 'run-tests', path: sandpack.activeFile });
                  }
                } catch {
                  // Ignore fallback failures
                }
              });
            }, 1000);
          }
        }
        if (event === 'total_test_start' || event === 'test_start') {
          started = true;
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      }
    });

    return () => {
      unsub();
      if (interval) clearInterval(interval);
    };
  }, [listen, sandpack]);
  return null;
}
