'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { CompanyLogo } from '@/components/company-logo';
import { DIFFICULTY_LABEL, TYPE_LABEL } from '@/types/domain';

export interface HeroQuestion {
  slug: string;
  title: string;
  description: string | null;
  difficulty: string;
  type: string;
  accessTier: string;
  timeLimitMinutes: number;
  companies: string[];
}

const INTERVAL_MS = 6000;
const label = 'font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted';

// Rotates through a few real questions in the hero. Auto-advances once in
// view, pauses on hover/focus, and stays on the first card under reduced motion.
export function HeroQuestionRotator({ questions }: { questions: HeroQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [cycle, setCycle] = useState(0); // bumps on manual pick so the progress bar restarts

  useEffect(() => {
    const el = rootRef.current;
    if (!el || questions.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setRunning(true);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [questions.length]);

  useEffect(() => {
    if (!running || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % questions.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [running, paused, questions.length, index]);

  function pick(i: number) {
    setCycle((c) => c + 1);
    setIndex(i);
  }

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="md:col-span-5 border border-line rounded-[10px] bg-surface overflow-hidden"
    >
      {/* progress hairline — fills over one interval, restarts each card */}
      <div className="h-px bg-line" aria-hidden="true">
        <div
          key={`${index}-${cycle}`}
          className={clsx(
            'h-full bg-brand origin-left motion-reduce:hidden',
            running && !paused && 'animate-[hero-progress_6s_linear_forwards]',
          )}
        />
      </div>

      {/* all cards stacked in one grid cell so the box is as tall as the tallest */}
      <div className="grid p-5">
        {questions.map((q, i) => {
          const active = i === index;
          return (
            <Link
              key={q.slug}
              href={`/questions/${q.slug}`}
              aria-hidden={!active}
              tabIndex={active ? 0 : -1}
              className={clsx(
                'col-start-1 row-start-1 group transition-[opacity,transform] duration-400 ease-(--ease-out) motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand rounded-[6px]',
                active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none',
              )}
            >
              <div className={`${label} flex flex-wrap gap-x-4 gap-y-1 mb-4`}>
                <span className="text-brand">{q.accessTier === 'FREE' ? 'Free' : 'Pro'}</span>
                <span>{DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}</span>
                <span className="tabular-nums">{q.timeLimitMinutes} min</span>
                <span>{TYPE_LABEL[q.type] ?? q.type}</span>
              </div>
              <h2 className="text-[1.25rem] font-semibold tracking-tight mb-3">{q.title}</h2>
              {q.companies.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3 text-[0.95rem] font-semibold text-ink">
                  <span className="text-ink-secondary font-normal">Asked at</span>
                  {q.companies.map((c) => (
                    <span key={c} title={c} aria-label={c} className="inline-flex items-center justify-center h-9 min-w-9 px-2 rounded-[6px] border border-line bg-bg">
                      <CompanyLogo name={c} size={24} />
                    </span>
                  ))}
                </div>
              )}
              {q.description && (
                <p className="font-mono text-[0.8rem] leading-[1.6] text-ink-secondary m-0 line-clamp-3">{q.description}</p>
              )}
              <span className="mt-5 inline-flex items-center gap-1 text-[0.85rem] font-medium text-ink group-hover:text-brand transition-colors duration-150">
                Open question <ArrowRight size={14} aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>

      {questions.length > 1 && (
        <div className="flex gap-1.5 px-5 pb-4" role="tablist" aria-label="Featured questions">
          {questions.map((q, i) => (
            <button
              key={q.slug}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={q.title}
              onClick={() => pick(i)}
              className={clsx(
                'h-6 min-w-6 px-1 inline-flex items-center justify-center rounded-[4px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                i === index ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              <span className={clsx('block h-1.5 w-1.5 rounded-full', i === index ? 'bg-brand' : 'bg-current')} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
