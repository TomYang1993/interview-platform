import clsx from 'clsx';
import { CompanyLogo } from '@/components/company-logo';
import { companyColor } from '@/lib/question-tags';

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

/**
 * Large, brand-tinted company tag for marketing surfaces (/whats-new).
 * The logo sits on a white disc so favicons drawn for light backgrounds
 * (and the masked Visa wordmark) read on the dark theme too.
 */
export function CompanyBadge({ name }: { name: string }) {
  const color = companyColor(name);
  return (
    <span
      className="inline-flex items-center gap-2 h-9 pl-1.5 pr-3.5 rounded-full border text-[0.92rem] font-semibold text-ink"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
      }}
    >
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white text-[#0f1419] shrink-0">
        <CompanyLogo name={name} size={16} className="rounded-[3px]" />
      </span>
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
