import { companyLogoUrl } from '@/lib/question-tags';

// Companies whose favicon reads badly at small sizes get a self-hosted
// monochrome wordmark instead, masked so it takes the current text color.
const WORDMARKS: Record<string, string> = {
  visa: '/logos/visa.svg',
};

interface Props {
  name: string;
  size: number;
  className?: string;
}

export function CompanyLogo({ name, size, className }: Props) {
  const wordmark = WORDMARKS[name.toLowerCase()];
  if (wordmark) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 bg-current ${className ?? ''}`}
        style={{
          width: size,
          height: size,
          maskImage: `url(${wordmark})`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
        }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- third-party favicon, no optimisation needed
    <img
      src={companyLogoUrl(name, size >= 20 ? 64 : 32)}
      alt=""
      width={size}
      height={size}
      decoding="async"
      referrerPolicy="no-referrer"
      className={`shrink-0 rounded-[4px] ${className ?? ''}`}
    />
  );
}
