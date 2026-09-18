'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check } from 'lucide-react';

// ponytail: scripted playback of a real question — nothing executes here.
// Mirrors prisma/seeds/python/web-crawler.ts (solution + test names); keep in sync by hand.
const FILE = 'web_crawler.py';
const SOLUTION = `from collections import deque

def web_crawl(pages, start_url):
    slash = start_url.find("/", 8)
    origin = start_url
    if slash != -1:
        origin = start_url[:slash]

    visited = set()
    queue = deque()
    if start_url in pages:
        queue.append(start_url)
        visited.add(start_url)

    while queue:
        url = queue.popleft()
        for link in pages.get(url, []):
            if link.startswith("/"):
                link = origin + link
            if not link.startswith(origin):
                continue
            if link not in visited and link in pages:
                visited.add(link)
                queue.append(link)

    return sorted(visited)`.split('\n');
const TESTS = [
  'single page with no links',
  'follows same-domain links only',
  'resolves relative paths',
  'handles cycles without infinite loop',
  'skips pages not in the map (404)',
  'deep chain',
  'mixed relative and absolute with cross-domain noise',
  'start url not in pages returns empty',
];

const LINE_MS = 90;
const RUN_MS = 700;
const TEST_MS = 160;
const HOLD_MS = 4000;

type Phase = 'code' | 'tests' | 'done';
const label = 'font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted';

const REDUCED = '(prefers-reduced-motion: reduce)';
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
function useReducedMotion() {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
}

export function SolveDemo() {
  const rootRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [started, setStarted] = useState(false);
  const [animPhase, setPhase] = useState<Phase>('code');
  const [animLines, setLines] = useState(0);
  const [animPassed, setPassed] = useState(0);
  // Reduced motion: skip the playback and show the finished state.
  const phase: Phase = reduced ? 'done' : animPhase;
  const lines = reduced ? SOLUTION.length : animLines;
  const passed = reduced ? TESTS.length : animPassed;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setStarted(true);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One timer per step; the state machine advances itself.
  useEffect(() => {
    if (!started || reduced) return;
    let delay: number;
    let next: () => void;
    if (phase === 'code') {
      if (lines < SOLUTION.length) {
        delay = LINE_MS;
        next = () => setLines((n) => n + 1);
      } else {
        delay = RUN_MS;
        next = () => setPhase('tests');
      }
    } else if (phase === 'tests') {
      if (passed < TESTS.length) {
        delay = passed === 0 ? 400 : TEST_MS;
        next = () => setPassed((n) => n + 1);
      } else {
        delay = 300;
        next = () => setPhase('done');
      }
    } else {
      delay = HOLD_MS;
      next = () => {
        setLines(0);
        setPassed(0);
        setPhase('code');
      };
    }
    const id = setTimeout(next, delay);
    return () => clearTimeout(id);
  }, [started, reduced, phase, lines, passed]);

  const showTests = phase !== 'code';

  return (
    <figure
      ref={rootRef}
      className="md:col-span-6 md:order-1 max-md:order-2 m-0 border border-line rounded-[10px] bg-surface overflow-hidden"
      aria-label="Demo: solving Web Crawler in Python and running its tests"
    >
      <figcaption className={`${label} flex items-center justify-between px-4 py-2.5 border-b border-line`}>
        <span>{FILE}</span>
        <span className="normal-case tracking-normal">Python · runs in your browser</span>
      </figcaption>

      {/* code and tests stacked in one cell so the box keeps one height */}
      <div className="grid">
        <pre
          aria-hidden={showTests}
          className={clsx(
            'col-start-1 row-start-1 m-0 p-4 font-mono text-[0.78rem] leading-[1.6] text-ink overflow-hidden transition-opacity duration-300 ease-(--ease-out) motion-reduce:transition-none',
            showTests && 'opacity-0 pointer-events-none',
          )}
        >
          <code>
            {SOLUTION.map((line, i) => (
              <span
                key={i}
                className={clsx(
                  'block min-h-[1.6em] transition-[opacity,transform] duration-200 ease-(--ease-out) motion-reduce:transition-none',
                  i < lines ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1',
                )}
              >
                {line || ' '}
              </span>
            ))}
          </code>
        </pre>

        <ol
          aria-hidden={!showTests}
          className={clsx(
            'col-start-1 row-start-1 m-0 p-4 list-none font-mono text-[0.8rem] leading-[1.6] transition-opacity duration-300 ease-(--ease-out) motion-reduce:transition-none',
            !showTests && 'opacity-0 pointer-events-none',
          )}
        >
          {TESTS.map((name, i) => {
            const ok = i < passed;
            return (
              <li key={name} className="flex items-center gap-3 py-0.5">
                <span
                  className={clsx(
                    'inline-flex items-center justify-center w-4 h-4 rounded-full border transition-[background-color,border-color] duration-150 ease-(--ease-out) motion-reduce:transition-none',
                    ok ? 'bg-good border-good text-bg' : 'border-line text-transparent',
                  )}
                >
                  <Check size={10} strokeWidth={3} aria-hidden="true" />
                </span>
                <span className={clsx('transition-colors duration-150', ok ? 'text-ink' : 'text-muted')}>{name}</span>
                <span className={clsx('ml-auto text-[0.7rem] uppercase tracking-[0.08em]', ok ? 'text-good' : 'text-transparent')}>pass</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className={`${label} flex items-center justify-between px-4 py-2.5 border-t border-line`}>
        <span
          className={clsx(
            'transition-colors duration-150',
            phase === 'code' && lines === SOLUTION.length ? 'text-brand' : '',
          )}
        >
          {phase === 'code' ? 'Run tests' : phase === 'tests' ? 'Running…' : 'Submitted'}
        </span>
        <span
          className={clsx(
            'tabular-nums transition-colors duration-150',
            phase === 'done' ? 'text-good' : passed > 0 ? 'text-ink' : 'text-muted',
          )}
        >
          {phase === 'code' ? `${TESTS.length} tests` : `${passed}/${TESTS.length} passed`}
        </span>
      </div>
    </figure>
  );
}
