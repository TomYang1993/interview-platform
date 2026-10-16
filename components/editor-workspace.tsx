'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as monacoEditor } from 'monaco-editor';
import { useToast } from '@/components/toast-provider';
import {
  Lightbulb, FileCode2, History,
  Play, Upload, ArrowLeft, ChevronDown,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { CheatsheetModal } from '@/components/cheatsheet-modal';
import { useJsRunner } from '@/hooks/use-js-runner';
import { usePyRunner, type PyCase } from '@/hooks/use-py-runner';
import { CountdownTimer } from '@/components/countdown-timer';
import { DIFFICULTY_LABEL, DIFFICULTY_BADGE_CLASS } from '@/types/domain';
import { BottomPanel, type BottomTab, type TestResult, type SubmitResult } from '@/components/bottom-panel';
import { DescriptionTab } from '@/components/tabs/description-tab';
import { SolutionsTab } from '@/components/tabs/solutions-tab';
import { SubmissionsTab } from '@/components/tabs/submissions-tab';

interface EditorWorkspaceProps {
  questionId: string;
  slug: string;
  questionType?: 'FUNCTION_JS' | 'FUNCTION_PYTHON';
  title: string;
  prompt: string;
  difficulty: string;
  tags: string[];
  starterCode?: Record<string, string>;
  publicTestCode: string;
  publicTestCases?: PyCase[] | null;
  functionName?: string | null;
  expiresAt?: string;
}

type LeftTab = 'description' | 'solutions' | 'submissions';

const leftTabBtn = 'py-2 text-[0.75rem] font-bold uppercase tracking-[0.05em] bg-transparent border-none border-b-2 border-transparent text-muted cursor-pointer transition-all duration-200 hover:text-ink [&.active]:text-ink [&.active]:border-brand';

export function EditorWorkspace({
  questionId,
  slug,
  questionType = 'FUNCTION_JS',
  title,
  prompt,
  difficulty,
  tags,
  starterCode,
  publicTestCode,
  publicTestCases,
  functionName,
  expiresAt,
}: EditorWorkspaceProps) {
  const { toast } = useToast();
  const [activeLeftTab, setActiveLeftTab] = useState<LeftTab>('description');

  const isPython = questionType === 'FUNCTION_PYTHON';
  const jsRunner = useJsRunner();
  const pyRunner = usePyRunner();

  const [language, setLanguage] = useState<'javascript' | 'typescript' | 'python'>(
    isPython ? 'python' : 'javascript'
  );
  const [codes, setCodes] = useState<Record<string, string>>(() => {
    if (isPython) {
      return {
        python: starterCode?.python ?? '',
      } as Record<string, string>;
    }
    return {
      javascript: starterCode?.javascript ?? '',
      typescript: starterCode?.typescript ?? starterCode?.javascript ?? '',
    } as Record<string, string>;
  });

  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);

  /** Read current code from editor instance (source of truth) or fall back to state */
  const getCode = useCallback(() => {
    return editorRef.current?.getValue() ?? codes[language];
  }, [codes, language]);

  const code = codes[language];
  const setCode = (val: string) => {
    setCodes((prev) => ({ ...prev, [language]: val }));
  };
  const debouncedCode = useDebounce(code, 2000);
  const initialMount = useRef(true);

  // Persist draft to server (debounced)
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, framework: language, code: debouncedCode })
    }).catch(err => console.error('Autosave failed:', err));
  }, [debouncedCode, questionId, language]);

  // Flush unsaved changes on page leave
  useEffect(() => {
    const flush = () => {
      const currentCode = editorRef.current?.getValue();
      if (currentCode == null) return;
      navigator.sendBeacon(
        '/api/drafts',
        new Blob(
          [JSON.stringify({ questionId, framework: language, code: currentCode })],
          { type: 'application/json' },
        ),
      );
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [questionId, language]);

  // ─── Test/Console/Results state ───
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('tests');

  // ─── Bottom panel resize ───
  const [consoleHeight, setConsoleHeight] = useState(280);
  const consoleHeightRef = useRef(280);
  const lastOpenConsoleHeightRef = useRef(280);
  const consoleDragStart = useRef<{ y: number; h: number } | null>(null);
  const COLLAPSED_CONSOLE_HEIGHT = 46;
  const isConsoleCollapsed = consoleHeight < 80;

  useEffect(() => {
    consoleHeightRef.current = consoleHeight;
  }, [consoleHeight]);

  const [monacoTheme, setMonacoTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  // ─── Drag handles ───
  const [leftWidth, setLeftWidth] = useState(() =>
    typeof window === 'undefined' ? 450 : Math.max(400, (window.innerWidth - 64) * 0.40)
  );
  const isDragging = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const newWidth = Math.max(300, Math.min(e.clientX - 65, window.innerWidth * 0.7));
        setLeftWidth(newWidth);
      }
      if (consoleDragStart.current) {
        const delta = consoleDragStart.current.y - e.clientY;
        const next = Math.max(
          COLLAPSED_CONSOLE_HEIGHT,
          Math.min(consoleDragStart.current.h + delta, window.innerHeight * 0.8)
        );
        setConsoleHeight(next);
      }
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      if (consoleDragStart.current) {
        consoleDragStart.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (consoleHeightRef.current >= 80) {
          lastOpenConsoleHeightRef.current = consoleHeightRef.current;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = () => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleConsoleMouseDown = (e: React.MouseEvent) => {
    consoleDragStart.current = { y: e.clientY, h: consoleHeight };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const toggleConsole = () => {
    if (isConsoleCollapsed) {
      setConsoleHeight(lastOpenConsoleHeightRef.current || 280);
    } else {
      lastOpenConsoleHeightRef.current = consoleHeight;
      setConsoleHeight(COLLAPSED_CONSOLE_HEIGHT);
    }
  };

  const ensureConsoleOpen = () => {
    if (consoleHeightRef.current < 80) {
      setConsoleHeight(lastOpenConsoleHeightRef.current || 280);
    }
  };

  // When language changes, push the stored code into the editor imperatively
  const prevLanguageRef = useRef(language);
  useEffect(() => {
    if (prevLanguageRef.current !== language && editorRef.current) {
      editorRef.current.setValue(codes[language]);
      prevLanguageRef.current = language;
    }
  }, [language, codes]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    const updateTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setMonacoTheme(theme === 'light' ? 'light' : 'vs-dark');
    };

    updateTheme();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.attributeName === 'data-theme') {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.body.style.overflow = 'hidden';

    return () => {
      observer.disconnect();
      document.body.style.overflow = '';
    };
  }, []);

  // ─── Public test suite (shared by Run and Submit) ───
  async function executePublicTests(currentCode: string): Promise<{ results: TestResult[]; logs: string[] }> {
    if (!isPython) {
      return jsRunner.runTests(
        currentCode,
        publicTestCode,
        language as 'javascript' | 'typescript',
      );
    }
    if (!publicTestCases || publicTestCases.length === 0) {
      throw new Error('No public test cases configured for this question');
    }
    if (!functionName) {
      throw new Error('Question is missing a function name');
    }
    return pyRunner.runTests(currentCode, publicTestCases, functionName);
  }

  // ─── Run public tests ───
  async function runPublicTests() {
    setRunning(true);
    ensureConsoleOpen();
    const currentCode = getCode();

    try {
      const { results, logs } = await executePublicTests(currentCode);

      setTestResults(results);
      setConsoleLogs((prev) => [...prev, ...logs]);

      if (logs.length > 0) {
        setActiveBottomTab('console');
      } else {
        setActiveBottomTab('tests');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setTestResults([{ name: 'Execution Error', passed: false, error: msg }]);
      setActiveBottomTab('tests');
      toast({ title: 'Test run failed', description: msg, type: 'error' });
    } finally {
      setRunning(false);
    }
  }

  // ─── Submit: public + hidden tests ───
  async function submitHiddenTests() {
    setSubmitting(true);
    ensureConsoleOpen();
    const currentCode = getCode();

    try {
      // Re-run the public tests against the code being submitted so the score
      // never mixes in results from an older Run (or none at all).
      const hasPublicTests = isPython
        ? (publicTestCases?.length ?? 0) > 0
        : publicTestCode.trim() !== '';
      const publicResults = hasPublicTests
        ? (await executePublicTests(currentCode)).results
        : [];
      setTestResults(publicResults);

      // Fetch hidden tests, run client-side (Worker / Pyodide), post pre-computed result.
      const htRes = await fetch(`/api/questions/${questionId}/hidden-tests`);
      if (!htRes.ok) throw new Error('Failed to load hidden tests');

      let hiddenResults: TestResult[] = [];
      if (!isPython) {
        const { testCode: hiddenTestCode } = (await htRes.json()) as { testCode: string };
        if (hiddenTestCode) {
          const out = await jsRunner.runTests(
            currentCode,
            hiddenTestCode,
            language as 'javascript' | 'typescript',
          );
          hiddenResults = out.results;
        }
      } else {
        const ht = (await htRes.json()) as {
          functionName: string | null;
          testCases: PyCase[];
        };
        if (!ht.functionName) {
          throw new Error('Question is missing a function name');
        }
        if (ht.testCases.length > 0) {
          const out = await pyRunner.runTests(currentCode, ht.testCases, ht.functionName);
          hiddenResults = out.results;
        }
      }

      // The stored submission and the Results panel share one score: public + hidden.
      const allResults = [...publicResults, ...hiddenResults];
      const passedCount = allResults.filter((r) => r.passed).length;
      const total = allResults.length;
      const score = total > 0 ? Math.round((passedCount / total) * 100) : 0;
      const allPassed = total > 0 && passedCount === total;
      const runtimeMs = 0;

      const response = await fetch('/api/submissions/judge-hidden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          framework: isPython ? 'python' : 'javascript',
          code: currentCode,
          clientResults: { passedCount, total, score, runtimeMs },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Hidden judge failed');

      setSubmitResult({
        score,
        status: allPassed ? 'PASSED' : 'FAILED',
        passedCount,
        total,
        publicResults,
        hiddenResults: hiddenResults.map((r, i) => ({ index: i, ...r })),
      });
      setActiveBottomTab('results');

      toast({
        title: allPassed ? 'All tests passed!' : `Score: ${score}%`,
        description: `${passedCount}/${total} tests passed`,
        type: allPassed ? 'success' : 'info',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Submission failed', description: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen w-screen ml-[calc(-50vw+50%)] -mt-8 -mb-16 bg-bg overflow-hidden focus-mode:bg-[#15140f]">
      {/* ─── Side Nav ─── */}
      <aside className="w-[64px] bg-black border-r border-line flex flex-col items-center justify-between py-4 z-10">
        <div className="flex flex-col gap-4">
          <Link href="/questions" className="w-10 h-10 rounded-md border-none bg-transparent text-muted text-[1.2rem] cursor-pointer transition-all duration-200 flex items-center justify-center hover:bg-surface-raised hover:text-ink" title="Back to Questions">
            <ArrowLeft size={24} strokeWidth={1.5} />
          </Link>
        </div>
        <div className="flex flex-col gap-4">
          <CheatsheetModal type={isPython ? 'python' : 'js'} />
          <ThemeToggle className="w-10 h-10 rounded-md border-none bg-transparent text-muted cursor-pointer transition-all duration-200 flex items-center justify-center hover:bg-surface-raised hover:text-ink" />
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex min-w-0">
        {/* Left Pane: Problem Description */}
        <section className={`flex flex-col bg-surface border-r border-line flex-none max-w-[70%] min-w-[400px]`} style={{ width: leftWidth }}>
          <div className="px-6 pt-4 border-b border-line bg-surface-raised">
            <div className={`flex items-center gap-4 mb-4 flex items-center justify-between w-full`}>
              <div className="flex items-center gap-3">
                <h1 className="text-[1.25rem] font-bold m-0">{title}</h1>
                <span className={`inline-flex items-center justify-center px-2 py-[0.3rem] rounded-sm text-[0.65rem] font-bold uppercase tracking-[0.05em] leading-none ${DIFFICULTY_BADGE_CLASS[difficulty] ?? ''}`}>{DIFFICULTY_LABEL[difficulty] ?? difficulty}</span>
              </div>
              {expiresAt && <CountdownTimer expiresAt={expiresAt} slug={slug} />}
            </div>
            <div className="flex gap-6">
              <button
                className={`${leftTabBtn} ${activeLeftTab === 'description' ? 'active' : ''}`}
                onClick={() => setActiveLeftTab('description')}
              >Description</button>
              <button
                className={`${leftTabBtn} ${activeLeftTab === 'solutions' ? 'active' : ''}`}
                onClick={() => setActiveLeftTab('solutions')}
              ><Lightbulb size={16} className="inline-block mr-1" /> Solutions</button>
              <button
                className={`${leftTabBtn} ${activeLeftTab === 'submissions' ? 'active' : ''}`}
                onClick={() => setActiveLeftTab('submissions')}
              ><History size={16} className="inline-block mr-1" /> Submissions</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeLeftTab === 'description' && <DescriptionTab prompt={prompt} tags={tags} />}
            {activeLeftTab === 'solutions' && <SolutionsTab questionId={questionId} />}
            {activeLeftTab === 'submissions' && <SubmissionsTab questionId={questionId} />}
          </div>
        </section>

        {/* Drag Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="w-2 bg-transparent cursor-col-resize z-10 -mx-1 relative shrink-0"
        />

        {/* Right Pane: Editor + Bottom Panel */}
        <section className="flex-1 flex flex-col bg-surface-raised min-w-[400px] dark:bg-black focus-mode:bg-black">
          <div className="h-10 bg-surface border-b border-line flex justify-between items-center px-4 shrink-0">
            <div className="flex items-center h-full">
              <span className={`font-mono text-[0.75rem] font-bold text-muted h-full flex items-center px-4 bg-transparent border-none border-b-2 border-transparent cursor-pointer transition-colors duration-200 hover:text-ink-secondary [&.active]:text-brand [&.active]:border-brand active`}>
                <FileCode2 size={16} className="inline-block mr-1" />
                {isPython ? 'solution.py' : language === 'javascript' ? 'Solution.js' : 'Solution.ts'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isPython ? (
                <span className="font-mono text-[0.7rem] font-semibold text-accent-tertiary bg-accent-tertiary/10 px-3 py-1 rounded-md">Python 3.13</span>
              ) : (
                <div className="relative">
                  <select
                    className="appearance-none bg-surface-raised border border-line text-ink font-mono text-xs font-semibold py-[0.35rem] pr-7 pl-3 rounded-md outline-none cursor-pointer transition-all duration-200 shadow-sm hover:border-brand hover:bg-brand/10 focus:border-brand focus:ring-2 focus:ring-brand/20"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'javascript' | 'typescript')}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
                </div>
              )}
              <span className="mx-1 h-5 w-px bg-line" />
              <button
                className="inline-flex items-center gap-1.5 bg-transparent border border-brand text-brand py-[0.3rem] px-[1rem] rounded-md text-[0.7rem] font-bold cursor-pointer transition-all duration-200 hover:bg-brand/10 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={running}
                onClick={runPublicTests}
              >
                <Play size={12} fill="currentColor" /> {running ? 'Running…' : 'Run'}
              </button>
              <button
                className="inline-flex items-center gap-1.5 bg-brand text-white border-none py-[0.3rem] px-[1.2rem] rounded-md text-[0.7rem] font-bold cursor-pointer transition-all duration-200 shadow-[0_0_12px_rgba(37,99,235,0.25)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting}
                onClick={submitHiddenTests}
              >
                <Upload size={12} /> {submitting ? 'Judging…' : 'Submit'}
              </button>
            </div>
          </div>

          <div className="flex-1 relative flex flex-col min-h-0">
            <div className="relative flex-1 min-h-0">
              <Editor
                height="100%"
                language={language}
                theme={monacoTheme}
                defaultValue={code}
                onMount={handleEditorMount}
                onChange={(value) => setCode(value || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  padding: { top: 12, bottom: 0 },
                  lineNumbersMinChars: 3,
                  scrollBeyondLastLine: false,
                  renderLineHighlight: 'gutter',
                  fontFamily: 'var(--font-mono), JetBrains Mono, monospace',
                }}
              />
            </div>

            {/* Bottom Panel */}
            <BottomPanel
              activeTab={activeBottomTab}
              onTabChange={setActiveBottomTab}
              height={consoleHeight}
              collapsed={isConsoleCollapsed}
              onToggleCollapse={toggleConsole}
              onMouseDown={handleConsoleMouseDown}
              testCode={publicTestCode}
              publicCases={publicTestCases ?? null}
              testResults={testResults}
              mode="js"
              consoleLogs={consoleLogs}
              onClearConsole={() => setConsoleLogs([])}
              submitResult={submitResult}
              isRunning={running}
              isSubmitting={submitting}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
