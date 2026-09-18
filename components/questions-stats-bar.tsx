import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/* Hallmark · genre: modern-minimal · macrostructure: Index-First · theme: Cobalt (existing tokens) · designed-as-app */

interface CategoryStat {
  solved: number;
  total: number;
}

interface QuestionsStatsBarProps {
  isLoggedIn: boolean;
  streak: number;
  solvedCount: number;
  totalQuestions: number;
  js: CategoryStat;
  ui: CategoryStat;
  backend: CategoryStat;
}

const label = 'font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted';

function Readout({ name, solved, total, dim }: { name: string; solved: number; total: number; dim: boolean }) {
  const pct = total > 0 ? (solved / total) * 100 : 0;
  return (
    <div className="flex flex-col gap-2 min-w-[120px] flex-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className={label}>{name}</span>
        <span className="font-mono tabular-nums text-[0.9rem] text-ink">
          {dim ? '—' : <>{solved}<span className="text-muted">/{total}</span></>}
        </span>
      </div>
      <div className="h-px w-full bg-line" aria-hidden="true">
        <div
          className="h-full bg-brand transition-[width] duration-500 ease-(--ease-out) motion-reduce:transition-none"
          style={{ width: dim ? '0%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function QuestionsStatsBar({
  isLoggedIn,
  streak,
  solvedCount,
  totalQuestions,
  js,
  ui,
  backend,
}: QuestionsStatsBarProps) {
  const dim = !isLoggedIn;

  if (dim) {
    return (
      <div className="pb-6 border-b border-line flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <p className="text-ink text-[1rem] m-0">Sign in to track solved questions and your streak.</p>
        <Link
          href="/auth"
          className="inline-flex items-center gap-1 text-[0.95rem] font-medium text-brand hover:underline underline-offset-4 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Sign in <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-12 gap-x-12 gap-y-6 pb-6 border-b border-line">
      <div className="md:col-span-4 flex gap-10">
        <div>
          <p className={`${label} mb-1`}>Solved</p>
          <p className="font-mono tabular-nums text-[1.75rem] leading-none text-ink m-0">
            {dim ? '—' : <>{solvedCount}<span className="text-muted text-[1rem]">/{totalQuestions}</span></>}
          </p>
        </div>
        <div>
          <p className={`${label} mb-1`}>Streak</p>
          <p className="font-mono tabular-nums text-[1.75rem] leading-none text-ink m-0">
            {dim ? '—' : <>{streak}<span className="text-muted text-[1rem]"> {streak === 1 ? 'day' : 'days'}</span></>}
          </p>
        </div>
      </div>
      <div className="md:col-span-8 flex flex-wrap gap-x-8 gap-y-4">
        <Readout name="JS" solved={js.solved} total={js.total} dim={dim} />
        <Readout name="UI" solved={ui.solved} total={ui.total} dim={dim} />
        <Readout name="Backend" solved={backend.solved} total={backend.total} dim={dim} />
      </div>
    </div>
  );
}
