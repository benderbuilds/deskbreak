import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { NeedCards } from "@/components/marketing/NeedCards";
import { LandingViewTracker, StartResetButton } from "@/components/marketing/LandingCta";
import { Citation } from "@/components/marketing/RichText";
import { WorkoutDemo, type DemoMove } from "@/components/marketing/WorkoutDemo";
import { FREE_RESET_PROGRAM_ID, HERO_SUBHEAD, PRODUCT_PROMISE, PRODUCT_SUBHEAD } from "@/lib/constants";
import { getExercise, getProgram } from "@/lib/content";
import { BLOG_POSTS } from "@/content/blog";
import { LANDING_PAGES, PROOF_CALLOUTS } from "@/lib/seo-content";

export const metadata: Metadata = {
  title: "DeskBreak. The workout for people who sit all day.",
  description: PRODUCT_SUBHEAD,
  alternates: { canonical: "/" },
};

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** The free reset "Start" opens, read from the catalog so the copy can't drift from it. */
function freeReset() {
  const program = getProgram(FREE_RESET_PROGRAM_ID);
  const steps = (program?.steps ?? [])
    .map((step) => ({ step, exercise: getExercise(step.exerciseId) }))
    .filter((entry) => entry.exercise !== undefined);
  const moveCount = new Set(steps.map((entry) => entry.step.exerciseId)).size;
  const demo: DemoMove[] = steps.slice(0, 3).map((entry, index) => ({
    id: entry.step.exerciseId,
    name: entry.exercise!.name,
    seconds: entry.step.durationSec,
    next: steps[index + 1]?.exercise?.name ?? "Done",
  }));
  return { moveCount, stepCount: steps.length, demo };
}

const PRO_EXAMPLES = [
  { time: "10:20 AM", label: "Desk Reset" },
  { time: "12:45 PM", label: "Walk break" },
  { time: "2:45 PM", label: "Desk Reset" },
  { time: "4:15 PM", label: "Energy reset" },
];

/**
 * The first screen a stranger sees. One card, one button.
 *
 * Server-rendered and static so a visitor from a search result has the Start
 * button before the JavaScript lands.
 */
export default function LandingPage() {
  const reset = freeReset();
  const countWord = NUMBER_WORDS[reset.moveCount] ?? String(reset.moveCount);
  const steps = [
    { n: "1", title: "Press Start", body: "No account, no questions. The reset begins in a second." },
    {
      n: "2",
      title: `Follow ${countWord} clear movements`,
      body: "Neck, shoulders, back, wrists, hips and legs. Three minutes.",
    },
    { n: "3", title: "Tell us how you feel", body: "One tap. DeskBreak uses it to make the next reset better." },
  ];

  return (
    <MarketingShell>
      <LandingViewTracker />

      <section className="grid items-center gap-8 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-12">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral">
            {PRODUCT_PROMISE}
          </p>
          <h1 className="mt-4 font-display text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-[3.3rem]">
            Sitting all day? Do this.
          </h1>
          <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink/65">{HERO_SUBHEAD}</p>

          <div className="surface-elevated mt-8 max-w-[30rem] px-5 py-5 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">Start here</p>
            <p className="mt-1.5 font-display text-[1.6rem] font-semibold leading-tight text-ink">
              3-Minute Desk Reset
            </p>
            <p className="mt-1 text-sm text-ink/60">Neck · shoulders · back · wrists · hips · legs</p>
            <p className="mt-1 text-xs text-ink/45">No equipment · Office-friendly · No signup</p>
            <div className="mt-4">
              <StartResetButton minutes={3} source="landing_hero">
                Start my reset
              </StartResetButton>
            </div>
          </div>

          <p className="mt-6 text-sm font-semibold text-ink/60">Need something specific?</p>
          <div className="mt-2 max-w-[30rem]">
            <NeedCards />
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <WorkoutDemo moves={reset.demo} totalSteps={reset.stepCount} />
        </div>
      </section>

      <section className="py-8" aria-labelledby="research">
        <h2 id="research" className="font-display text-[1.5rem] font-semibold tracking-tight text-ink">
          What the research says about short breaks
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROOF_CALLOUTS.map((callout) => (
            <li key={callout.sourceId} className="surface px-5 py-4 text-[0.95rem] leading-relaxed text-ink/80">
              {callout.text}{" "}
              <span className="text-sm">
                <Citation ids={[callout.sourceId]} />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-[42rem] text-sm leading-relaxed text-ink/55">
          These are findings from the studies, not promises about DeskBreak. DeskBreak is general movement
          guidance, not medical care.{" "}
          <Link href="/science" className="font-semibold text-coral">
            How we use research &rarr;
          </Link>
        </p>
      </section>

      <section className="py-10" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="font-display text-[1.9rem] font-semibold tracking-tight text-ink">
          How it works
        </h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step.n} className="surface px-5 py-6">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-coral text-sm font-semibold text-white">
                {step.n}
              </span>
              <p className="mt-4 font-display text-lg font-semibold text-ink">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink/60">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="py-6" aria-labelledby="more-than-stretching">
        <h2 id="more-than-stretching" className="font-display text-[1.9rem] font-semibold tracking-tight text-ink">
          More than stretching.
        </h2>
        <p className="mt-3 max-w-[40rem] leading-relaxed text-ink/65">
          Every Desk Reset mixes mobility, light activation and standing up, because the evidence for
          breaking up sitting is about moving, not holding a pose. It works offline, needs no account, and
          learns which moves help you.
        </p>
        <Link href="/science" className="mt-4 inline-block text-sm font-semibold text-coral">
          Why this works &rarr;
        </Link>
      </section>

      <section className="mt-8 rounded-[24px] bg-ink px-6 py-10 text-paper sm:px-10" aria-labelledby="pro-teaser">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <h2 id="pro-teaser" className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">
              Want DeskBreak to manage your workday?
            </h2>
            <p className="mt-3 max-w-[36rem] leading-relaxed text-paper/70">
              Pro learns which movements, lengths and times actually help you, then puts the right
              breaks into your day and reminds you before you&apos;ve been sitting all afternoon.
            </p>
            <Link href="/app/pro?from=landing" className="mt-5 inline-block text-sm font-semibold text-mint">
              See Pro &rarr;
            </Link>
          </div>
          <ul className="grid gap-2">
            {PRO_EXAMPLES.map((item) => (
              <li key={item.time} className="flex items-center justify-between rounded-[14px] bg-paper/10 px-4 py-3">
                <span className="font-semibold tabular-nums">{item.time}</span>
                <span className="text-paper/70">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-12" aria-labelledby="guides">
        <h2 id="guides" className="font-display text-[1.5rem] font-semibold tracking-tight text-ink">
          Desk exercises, written out
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_PAGES.map((page) => (
            <li key={page.slug}>
              <Link href={`/${page.slug}`} className="surface block px-4 py-4 text-sm font-semibold text-ink transition-colors hover:bg-ink/3">
                {page.title}
              </Link>
            </li>
          ))}
        </ul>

        <h2 id="blog" className="mt-10 font-display text-[1.5rem] font-semibold tracking-tight text-ink">
          What the research says
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {BLOG_POSTS.slice(0, 4).map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="surface block px-4 py-4 text-sm font-semibold text-ink transition-colors hover:bg-ink/3">
                {post.title}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/blog" className="mt-4 inline-block text-sm font-semibold text-coral">
          All posts &rarr;
        </Link>
      </section>
    </MarketingShell>
  );
}
