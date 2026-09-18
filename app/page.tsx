import Link from "next/link";
import { ArrowRight, Coffee } from "lucide-react";
import { HomeCountdown } from "@/components/home-countdown";

/* Hallmark · genre: modern-minimal · macrostructure: Split Studio · theme: Cobalt (existing tokens)
 * enrichment: none · nav: unchanged (site-header) · footer: Ft2 · studied: yes · DNA-source: url
 * source-url: https://wtfinterview.com · observed-fonts: Space Grotesk + IBM Plex Mono
 * pre-emit critique: P4 H4 E4 S4 R5 V4
 */

// ponytail: real seed question, mirrors prisma/seeds/js/debounce-function.ts — keep in sync by hand
const SPECIMEN = {
  slug: "debounce-function",
  title: "Debounce Function",
  difficulty: "Medium",
  minutes: 30,
  tier: "Free",
  prompt:
    "Implement debounce(fn, delay). The returned function delays calling fn until delay ms have passed since the last invocation — every new call resets the timer.",
  starter: `function debounce(fn, delay) {
  // your code here
}`,
};

const label =
  "font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted";
const rule = "border-t border-line";

export default function HomePage() {
  return (
    <div className="w-screen ml-[calc(-50vw+50%)] -mt-8 -mb-16 overflow-x-clip">
      {/* ─── 1 · Hero diptych — title left, real question right ─── */}
      <section className="max-w-[1120px] mx-auto px-6 max-md:px-4 pt-24 pb-20 max-md:pt-14 max-md:pb-12 grid md:grid-cols-12 gap-12 max-md:gap-10 items-center">
        <div className="md:col-span-7">
          <p className={`${label} mb-5`}>Fullstack interview practice</p>
          <h1 className="text-[clamp(2.25rem,8vw,3rem)] md:text-[clamp(3rem,5.5vw,4.5rem)] font-bold leading-[1.02] tracking-[-0.03em] mb-6 [overflow-wrap:anywhere]">
            Whack the fullstack interview.
          </h1>
          <p className="text-ink-secondary text-[1.05rem] max-md:text-base leading-[1.65] max-w-[52ch] mb-9">
            JS/TS function questions, React component questions, Python —
            adapted from real tech screens, solved in your browser, on a
            clock. Completely free. If it helps,{" "}
            <Link
              href="/coffee"
              className="inline-flex items-center gap-1 align-baseline text-ink underline decoration-line underline-offset-4 decoration-1 hover:decoration-brand transition-[text-decoration-color] duration-150"
            >
              <Coffee size={15} aria-hidden="true" className="shrink-0" />
              buy me a coffee
            </Link>
            .
          </p>
          <Link
            href="/questions"
            className="inline-flex items-center gap-2 bg-brand text-brand-ink font-semibold text-[0.95rem] px-5 py-3 min-h-11 rounded-[6px] whitespace-nowrap hover:bg-brand-hover transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Start practicing
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <Link
          href={`/questions/${SPECIMEN.slug}`}
          className="md:col-span-5 block border border-line rounded-[10px] bg-surface p-5 hover:border-brand transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand group"
        >
          <div className={`${label} flex flex-wrap gap-x-4 gap-y-1 mb-4`}>
            <span className="text-brand">{SPECIMEN.tier}</span>
            <span>{SPECIMEN.difficulty}</span>
            <span className="tabular-nums">{SPECIMEN.minutes} min</span>
            <span>JS · TS</span>
          </div>
          <h2 className="text-[1.25rem] font-semibold tracking-tight mb-3">
            {SPECIMEN.title}
          </h2>
          <p className="font-mono text-[0.8rem] leading-[1.6] text-ink-secondary m-0">
            {SPECIMEN.prompt}
          </p>
          <span className="mt-5 inline-flex items-center gap-1 text-[0.85rem] font-medium text-ink group-hover:text-brand transition-colors duration-150">
            Open question <ArrowRight size={14} aria-hidden="true" />
          </span>
        </Link>
      </section>

      {/* ─── 2 · Diptych, proof left — the editor ─── */}
      <section className={`${rule}`}>
        <div className="max-w-[1120px] mx-auto px-6 max-md:px-4 py-20 max-md:py-12 grid md:grid-cols-12 gap-12 max-md:gap-8 items-center">
          <figure className="md:col-span-6 md:order-1 max-md:order-2 m-0 border border-line rounded-[10px] bg-surface overflow-hidden">
            <figcaption className={`${label} px-4 py-2.5 border-b border-line`}>
              {SPECIMEN.slug}.js
            </figcaption>
            <pre className="m-0 p-4 font-mono text-[0.85rem] leading-[1.6] text-ink overflow-x-auto">
              <code>{SPECIMEN.starter}</code>
            </pre>
            <div className={`${label} px-4 py-2.5 border-t border-line`}>
              Run tests · hidden cases checked on submit
            </div>
          </figure>
          <div className="md:col-span-6 md:order-2 max-md:order-1">
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em] mb-4">
              Solve it right here.
            </h2>
            <p className="text-ink-secondary leading-[1.65] max-w-[48ch] m-0">
              Every question ships with starter code, a full editor, and a
              test runner. No setup — open a question and start typing.
              Submit to run the hidden tests and get a verdict.
            </p>
          </div>
        </div>
      </section>

      {/* ─── 3 · Diptych, text left — the clock ─── */}
      <section className={`${rule} bg-surface`}>
        <div className="max-w-[1120px] mx-auto px-6 max-md:px-4 py-20 max-md:py-12 grid md:grid-cols-12 gap-12 max-md:gap-8 items-center">
          <div className="md:col-span-6">
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em] mb-4">
              On the clock, like the real thing.
            </h2>
            <p className="text-ink-secondary leading-[1.65] max-w-[48ch] m-0">
              Every question is adapted from an actual interview round, not a
              LeetCode puzzle. Tech screens put you on a timer, so each
              question has a time limit and it&apos;s enforced.
            </p>
          </div>
          <div className="md:col-span-6 md:pl-12 border-line max-md:border-t max-md:pt-8 md:border-l">
            <p className={`${label} mb-2`}>Time limit · {SPECIMEN.title}</p>
            <HomeCountdown
              minutes={SPECIMEN.minutes}
              className="font-mono tabular-nums text-[clamp(3.5rem,10vw,6rem)] leading-none tracking-[-0.04em] text-ink m-0"
            />
            <p className="text-ink-secondary text-[0.9rem] mt-3 m-0">
              Starts when you open the editor. Stops when you submit.
            </p>
          </div>
        </div>
      </section>

      {/* ─── 4 · Closing line ─── */}
      <section className={rule}>
        <div className="max-w-[1120px] mx-auto px-6 max-md:px-4 py-20 max-md:py-12 flex max-md:flex-col md:items-center justify-between gap-6">
          <p className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.02em] leading-[1.15] max-w-[24ch] m-0">
            Pick a question. Beat the clock.
          </p>
          <Link
            href="/questions"
            className="inline-flex items-center gap-2 border border-ink text-ink font-semibold text-[0.95rem] px-5 py-3 min-h-11 rounded-[6px] whitespace-nowrap self-start md:self-auto hover:bg-ink hover:text-bg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Browse questions
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ─── Footer · Ft2 inline single line ─── */}
      <footer className={`${rule} bg-bg`}>
        <div className="max-w-[1120px] mx-auto px-6 max-md:px-4 py-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[0.8rem] text-muted">
          <span className="font-semibold text-ink">
            Whack The Fullstack Interview
          </span>
          <span>Built for engineers, by engineers.</span>
          <span className="tabular-nums">&copy; {new Date().getFullYear()}</span>
          <span className="flex gap-5 md:ml-auto">
            <Link
              href="/terms"
              className="inline-flex items-center py-2 whitespace-nowrap hover:text-ink transition-colors duration-150"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center py-2 whitespace-nowrap hover:text-ink transition-colors duration-150"
            >
              Privacy
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
