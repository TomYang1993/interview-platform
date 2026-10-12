'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CompanyBadge, NewBadge } from '@/components/question-badges';
import type { WhatsNewItem } from '@/lib/questions';

interface Props {
  initialItems: WhatsNewItem[];
  initialNextOffset: number | null;
}

const label = 'font-mono text-[0.7rem] uppercase tracking-[0.08em]';
const footerBtn =
  'h-10 px-4 inline-flex items-center justify-center rounded-[6px] border border-line bg-surface text-ink text-[0.88rem] font-medium transition-colors duration-150 hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// Server renders the first page; the rest streams in as the sentinel nears the
// viewport. The button is the fallback (and the retry after a failed fetch).
export function WhatsNewList({ initialItems, initialNextOffset }: Props) {
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (nextOffset === null || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/whats-new?offset=${nextOffset}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page: { items: WhatsNewItem[]; nextOffset: number | null } = await res.json();
      setItems((current) => {
        const seen = new Set(current.map((i) => i.slug));
        return [...current, ...page.items.filter((i) => !seen.has(i.slug))];
      });
      setNextOffset(page.nextOffset);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [nextOffset]);

  // Re-created after each page, so a sentinel still on screen loads the next one.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || nextOffset === null || failed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, nextOffset, failed]);

  if (items.length === 0) {
    return <p className="py-12 text-muted">No company questions yet.</p>;
  }

  return (
    <>
      <ol className="list-none m-0 p-0 mt-6 grid gap-4">
        {items.map((q) => (
          <li key={q.slug} className="rounded-[12px] border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${label} text-muted mr-1`}>Asked at</span>
              {q.companies.map((c) => (
                <CompanyBadge key={c} name={c} />
              ))}
            </div>
            <Link
              href={`/questions/${q.slug}`}
              className="mt-4 inline-flex flex-wrap items-center gap-2 font-semibold text-[1.15rem] tracking-tight text-ink hover:text-brand transition-colors duration-150"
            >
              {q.title}
              {q.isNew && <NewBadge />}
            </Link>
            {q.description && (
              <p className="m-0 mt-1.5 text-[0.95rem] text-muted leading-relaxed max-w-[64ch]">{q.description}</p>
            )}
          </li>
        ))}
      </ol>

      <div ref={sentinel} className="flex justify-center pt-6" aria-live="polite">
        {nextOffset !== null ? (
          failed ? (
            <button type="button" onClick={() => void loadMore()} className={footerBtn}>
              Couldn&apos;t load more. Retry
            </button>
          ) : (
            <button type="button" onClick={() => void loadMore()} disabled={loading} className={footerBtn}>
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )
        ) : (
          <span className={`${label} text-muted`}>More company questions are on the way.</span>
        )}
      </div>
    </>
  );
}
