'use client';

import { useEffect, useRef, useState } from 'react';

interface HomeCountdownProps {
  minutes: number;
  className?: string;
}

// Ticks once per second after scrolling into view, so the "time limit" figure
// on the home page reads as a real clock rather than a static number.
export function HomeCountdown({ minutes, className }: HomeCountdownProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [remaining, setRemaining] = useState(minutes * 60);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !interval) {
        interval = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (interval) clearInterval(interval);
    };
  }, []);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <p ref={ref} className={className} aria-live="off">
      <span>{mm}</span>
      <span className="animate-[tick-colon_1s_steps(1)_infinite] motion-reduce:animate-none">:</span>
      {/* key remount per second → @starting-style entry via `starting:` */}
      <span
        key={ss}
        className="inline-block transition-[opacity,translate] duration-150 ease-(--ease-out) starting:opacity-0 starting:translate-y-[0.08em] motion-reduce:transition-none"
      >
        {ss}
      </span>
    </p>
  );
}
