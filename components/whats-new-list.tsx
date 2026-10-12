'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CompanyChip, NewBadge } from '@/components/question-badges';
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
    return <p className="py-12 text-muted">No questions yet.</p>;
  }

  return (
    <>
      <ol className="list-none m-0 p-0">
        {items.map((q) => (
          <li key={q.slug} className="py-5 border-b border-line">
            <Link
              href={`/questions/${q.slug}`}
              className="inline-flex items-center gap-2 font-semibold text-[1.05rem] tracking-tight text-ink hover:text-brand transition-colors duration-150"
            >
              {q.title}
              {q.isNew && <NewBadge />}
            </Link>
            {q.description && (
              <p className="m-0 mt-1 text-[0.92rem] text-muted leading-relaxed max-w-[64ch]">{q.description}</p>
            )}
            {q.companies.length > 0 && (
              <div className={`${label} flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-3`}>
                <span className="text-muted">Asked at</span>
                {q.companies.map((c) => (
                  <CompanyChip key={c} name={c} />
                ))}
              </div>
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
          <span className={`${label} text-muted`}>That&apos;s every question. More are on the way.</span>
        )}
      </div>
    </>
  );
}
