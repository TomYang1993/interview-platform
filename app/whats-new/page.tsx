import type { Metadata } from 'next';
import { WhatsNewList } from '@/components/whats-new-list';
import { listWhatsNew } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "What's new · Whack The Fullstack Interview",
  description: 'The newest interview questions first, with the companies that asked them.',
};

export default async function WhatsNewPage() {
  const { items, nextOffset } = await listWhatsNew(0);

  return (
    <div className="max-w-[760px] mx-auto px-4 sm:px-6 pb-12">
      <header className="pb-6 border-b border-line">
        <h1 className="m-0 text-[2rem] font-bold tracking-[-0.02em]">What&apos;s new</h1>
        <p className="m-0 mt-2 text-muted">The newest questions first, with the companies that asked them.</p>
      </header>
      <WhatsNewList initialItems={items} initialNextOffset={nextOffset} />
    </div>
  );
}
