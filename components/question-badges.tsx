import clsx from 'clsx';
import { CompanyLogo } from '@/components/company-logo';

/** Company that asked a question: logo + name. */
export function CompanyChip({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 h-5 pl-1 pr-1.5 rounded-[4px] border border-line text-ink-secondary normal-case tracking-normal font-medium',
        className
      )}
    >
      <CompanyLogo name={name} size={12} className="rounded-[2px]" />
      {name}
    </span>
  );
}

/** Marks a question published within NEW_QUESTION_DAYS. */
export function NewBadge() {
  return (
    <span className="inline-flex items-center h-5 px-1.5 rounded-[4px] bg-brand-subtle text-brand font-mono text-[0.68rem] font-medium uppercase tracking-[0.08em]">
      New
    </span>
  );
}
