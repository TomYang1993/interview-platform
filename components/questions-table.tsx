'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { DIFFICULTY_LABEL, DIFFICULTY_TEXT_CLASS, TYPE_LABEL } from '@/types/domain';
import { Check, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { companyLogoUrl } from '@/lib/question-tags';

export interface QuestionRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  difficulty: string;
  type: string;
  accessTier: string;
  tags: string[];
  /** Company names the question was asked at */
  companies: string[];
  locked: boolean;
  /** 'solved' | 'attempted' | 'unattempted' */
  status: string;
  /** Number of successful (PASSED) submissions */
  passedCount: number;
}

interface QuestionsTableProps {
  questions: QuestionRow[];
  isLoggedIn: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, '...', total];
  if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

const label = 'font-mono text-[0.7rem] uppercase tracking-[0.08em]';
const pageBtn =
  'h-9 min-w-9 px-2 inline-flex items-center justify-center rounded-[6px] border border-line bg-surface text-ink font-mono text-[0.8rem] tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
const pageBtnEnabled = 'hover:border-brand';
const pageBtnDisabled = 'opacity-40 cursor-default';

function StatusGlyph({ status, passedCount }: { status: string; passedCount: number }) {
  if (status === 'solved') {
    return (
      <span className="inline-flex items-center gap-1 text-good" title={`Solved ${passedCount} time${passedCount === 1 ? '' : 's'}`}>
        <Check size={16} strokeWidth={2.5} aria-label="Solved" />
        {passedCount >= 2 && <span className="font-mono text-[0.7rem] tabular-nums">×{passedCount}</span>}
      </span>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-muted" aria-label={status === 'attempted' ? 'In progress' : 'Not started'}>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray={status === 'attempted' ? '10 30' : '1.5 2.75'} strokeLinecap="round" />
    </svg>
  );
}

function CompanyRow({ companies, type }: { companies: string[]; type: string }) {
  if (companies.length === 0) {
    return <span className={clsx(label, 'md:hidden block mt-2 text-muted')}>{type}</span>;
  }
  return (
    <div className={clsx(label, 'flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5')}>
      <span className="md:hidden text-muted">{type}</span>
      {companies.map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5 h-5 pl-1 pr-1.5 rounded-[4px] border border-line text-ink-secondary normal-case tracking-normal font-medium">
          {/* eslint-disable-next-line @next/next/no-img-element -- third-party favicon, no optimisation needed */}
          <img src={companyLogoUrl(c, 32)} alt="" width={12} height={12} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="rounded-[2px]" />
          {c}
        </span>
      ))}
    </div>
  );
}

export function QuestionsTable({ questions, isLoggedIn, page, pageSize, totalPages, totalFiltered, onPageChange }: QuestionsTableProps) {
  return (
    <div className="flex flex-col">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className={clsx(label, 'text-muted border-b border-line')}>
            <th className="w-12 py-3 pr-2 font-medium">Status</th>
            <th className="py-3 pr-4 font-medium">Question</th>
            <th className="hidden md:table-cell w-24 py-3 pr-4 font-medium">Type</th>
            <th className="w-20 py-3 font-medium text-right">Level</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id} className={clsx('border-b border-line transition-colors duration-150 hover:bg-bg-subtle group', q.locked && 'text-muted')}>
              {/* Status */}
              <td className="py-4 pr-2 align-top">
                <div className="flex items-center h-6">
                  {isLoggedIn ? <StatusGlyph status={q.status} passedCount={q.passedCount} /> : <span className="text-muted">—</span>}
                </div>
              </td>

              {/* Title + description */}
              <td className="py-4 pr-4 align-top">
                <Link href={`/questions/${q.slug}`} className="font-semibold text-[1rem] tracking-tight text-ink group-hover:text-brand transition-colors duration-150 inline-flex items-center gap-2">
                  {q.title}
                  {q.locked && (
                    <span className={clsx(label, 'inline-flex items-center gap-1 text-caution')}>
                      <Lock size={11} aria-hidden="true" /> Pro
                    </span>
                  )}
                </Link>
                {q.description && (
                  <p className="text-[0.88rem] text-muted leading-relaxed m-0 mt-1 line-clamp-2 max-w-[64ch]">{q.description}</p>
                )}
                <CompanyRow companies={q.companies} type={TYPE_LABEL[q.type] ?? q.type} />
              </td>

              {/* Type */}
              <td className={clsx(label, 'hidden md:table-cell py-4 pr-4 align-top text-muted')}>
                <span className="inline-block leading-6">{TYPE_LABEL[q.type] ?? q.type}</span>
              </td>

              {/* Difficulty */}
              <td className={clsx(label, 'py-4 align-top text-right', DIFFICULTY_TEXT_CLASS[q.difficulty.toUpperCase()])}>
                <span className="inline-block leading-6">{DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}</span>
              </td>
            </tr>
          ))}

          {questions.length === 0 && (
            <tr>
              <td colSpan={4} className="py-12 text-muted border-b border-line">
                No questions match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex items-center justify-between flex-wrap gap-3 py-4">
        <span className={clsx(label, 'text-muted tabular-nums')}>
          {totalPages > 1
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalFiltered)} of ${totalFiltered}`
            : `${totalFiltered} question${totalFiltered !== 1 ? 's' : ''}`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className={clsx(pageBtn, page > 1 ? pageBtnEnabled : pageBtnDisabled)}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            {getPageNumbers(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="h-9 min-w-9 inline-flex items-center justify-center text-muted font-mono text-[0.8rem]">…</span>
              ) : (
                <button
                  type="button"
                  key={p}
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={clsx(pageBtn, p === page ? 'border-brand bg-brand text-brand-ink' : pageBtnEnabled)}
                >
                  {p}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className={clsx(pageBtn, page < totalPages ? pageBtnEnabled : pageBtnDisabled)}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
