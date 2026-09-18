'use client';

import Link from 'next/link';
import { useState } from 'react';
import { X } from 'lucide-react';

// Site-wide strip above the header. Dismiss hides it for this page view only —
// it comes back on the next load by design.
export function AnnouncementBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  function dismiss() {
    setOpen(false);
  }

  return (
    <div className="border-b border-line bg-surface">
      <div className="flex items-center gap-3 px-6 max-md:px-4 min-h-11 text-[0.85rem] text-ink-secondary">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-brand shrink-0 animate-[breathe_2.4s_ease-in-out_infinite] motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0">
          <span>New questions are coming in — the bank keeps growing.</span>
          <Link href="/questions" className="font-medium text-ink hover:text-brand transition-colors duration-150 whitespace-nowrap">
            See what&apos;s new →
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="ml-auto -mr-2 inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-[6px] text-muted hover:text-ink transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
