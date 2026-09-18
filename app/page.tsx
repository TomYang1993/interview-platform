import Link from "next/link";
import { ArrowRight, Coffee } from "lucide-react";
import { HomeCountdown } from "@/components/home-countdown";
import { prisma } from "@/lib/db/prisma";
import { listCompanyTags } from "@/lib/question-tags";
import { listHeroQuestions } from "@/lib/questions";
import { HeroQuestionRotator } from "@/components/hero-question-rotator";
import { SolveDemo } from "@/components/solve-demo";
import { CompanyLogo } from "@/components/company-logo";

/* Hallmark · genre: modern-minimal · macrostructure: Split Studio · theme: Cobalt (existing tokens)
 * enrichment: none · nav: unchanged (site-header) · footer: Ft2 · studied: yes · DNA-source: url
 * source-url: https://wtfinterview.com · observed-fonts: Space Grotesk + IBM Plex Mono
 * pre-emit critique: P4 H4 E4 S4 R5 V4
 */

// ponytail: mirrors prisma/seeds/python/web-crawler.ts — the question the solve demo plays back
const SPECIMEN = { title: "Web Crawler", minutes: 30 };

const label =
  "font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted";
const rule = "border-t border-line";

export default async function HomePage() {
  const [companyTags, heroQuestions] = await Promise.all([listCompanyTags(prisma), listHeroQuestions()]);
  const companies = companyTags.map((t) => t.name);

  return (
    <div className="w-screen ml-[calc(-50vw+50%)] -mt-8 -mb-16 overflow-x-clip">
      {/* ─── Notice strip ─── */}
      <div className="border-b border-line bg-surface">
        <p className="max-w-[1120px] mx-auto px-6 max-md:px-4 py-2.5 m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.85rem] text-ink-secondary">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-hidden="true" />
          <span>New questions are coming in — the bank keeps growing.</span>
          <Link href="/questions" className="font-medium text-ink hover:text-brand transition-colors duration-150 whitespace-nowrap">
            See what&apos;s new →
          </Link>
        </p>
      </div>

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

        <HeroQuestionRotator questions={heroQuestions} />
      </section>

      {/* ─── Wordmark marquee — where the questions come from ─── */}
      {companies.length > 0 && (
      <section className={`${rule} py-10 max-md:py-8`}>
        <p className={`${label} max-w-[1120px] mx-auto px-6 max-md:px-4 mb-6`}>
          Adapted from interview rounds at
        </p>
        <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:[mask-image:none]">
          <ul className="flex w-max gap-x-12 m-0 p-0 list-none animate-[marquee_60s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:w-auto motion-reduce:flex-wrap motion-reduce:gap-y-3 motion-reduce:max-w-[1120px] motion-reduce:mx-auto motion-reduce:px-6 max-md:motion-reduce:px-4">
            {[...companies, ...companies].map((name, i) => (
              <li
                key={`${name}-${i}`}
                aria-hidden={i >= companies.length || undefined}
                className={`inline-flex items-center gap-2.5 text-[1.35rem] font-semibold tracking-[-0.02em] text-muted whitespace-nowrap${i >= companies.length ? " motion-reduce:hidden" : ""}`}
              >
                <CompanyLogo name={name} size={22} />
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>
      )}

      {/* ─── 2 · Diptych, proof left — the editor ─── */}
      <section className={`${rule}`}>
        <div className="max-w-[1120px] mx-auto px-6 max-md:px-4 py-20 max-md:py-12 grid md:grid-cols-12 gap-12 max-md:gap-8 items-center">
          <SolveDemo />
          <div className="md:col-span-6 md:order-2 max-md:order-1">
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em] mb-4">
              Solve it right here.
            </h2>
            <p className="text-ink-secondary leading-[1.65] max-w-[48ch] m-0">
              Every question ships with starter code, a full editor, and a
              test runner. JavaScript, TypeScript, React and Python all run
              in your browser — no setup. Submit to run the hidden tests and
              get a verdict.
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
