'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { QuestionsFilters } from './questions-filters';
import { QuestionsTable, type QuestionRow } from './questions-table';

const PAGE_SIZE = 20;

interface Props {
  allRows: QuestionRow[];
  isLoggedIn: boolean;
}

export function QuestionsListClient({ allRows, isLoggedIn }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const type = searchParams.get('type') || '';
  const difficulty = searchParams.get('difficulty') || '';
  const status = searchParams.get('status') || '';

  function handleFilterChange(key: 'type' | 'difficulty' | 'status', value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/questions?${params.toString()}`);
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [allRows, searchQuery]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap w-full">
        <div className="relative flex-1 max-w-[320px] max-md:max-w-none max-md:basis-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search questions"
            aria-label="Search questions"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-[6px] border border-line bg-surface text-ink text-[0.85rem] max-md:text-base outline-none transition-colors duration-150 placeholder:text-muted hover:border-brand focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
        </div>
        <QuestionsFilters
          type={type}
          difficulty={difficulty}
          status={status}
          onChange={handleFilterChange}
        />
      </div>

      <QuestionsTable
        questions={paginated}
        isLoggedIn={isLoggedIn}
        page={safePage}
        pageSize={PAGE_SIZE}
        totalPages={totalPages}
        totalFiltered={totalFiltered}
        onPageChange={setPage}
      />
    </>
  );
}
