import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { NeedCards } from "@/components/marketing/NeedCards";
import { LandingViewTracker, StartResetButton } from "@/components/marketing/LandingCta";
import { Citation } from "@/components/marketing/RichText";
import { StickyStartBar } from "@/components/marketing/StickyStartBar";
import { startHref } from "@/lib/start-link";
import { WorkoutDemo, type DemoMove } from "@/components/marketing/WorkoutDemo";
import {
  CLOSING_CTA_HEADING,
  FREE_CTA_LABEL,
  FREE_OFFER_HEADING,
  FREE_OFFER_TERMS,
  FREE_REASSURANCE,
  FREE_RESET_MINUTES,
  FREE_RESET_NAME,
  FREE_RESET_PROGRAM_ID,
  HERO_ASIDE,
  HERO_HEADLINE,
  HERO_SUPPORT,
} from "@/lib/constants";
import { getExercise, getProgram } from "@/lib/content";
import { BLOG_POSTS } from "@/content/blog";
import { LANDING_PAGES, PROOF_CALLOUTS } from "@/lib/seo-content";

export const metadata: Metadata = {
  title: "DeskBreak. A free, guided 3-minute desk break.",
  description:
    "A free, guided movement break for people who sit all day. Three minutes in your browser, no signup and no equipment.",
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
 * The first screen a stranger sees.
 *
 * The order is the order of the decision: what this is, that it is free, what
 * it looks like, then how it works, then what free actually includes. The
 * research and the Pro teaser come after all of that, because neither answers
 * "what happens if I press the button".
 *
 * Server-rendered and static so a visitor from a search result has the Start
 * button before the JavaScript lands.
 */
export default function LandingPage() {
  const reset = freeReset();
  const countWord = NUMBER_WORDS[reset.moveCount] ?? String(reset.moveCount);
  const steps = [
    {
      n: "1",
      title: "Start with a quick safety check",
      body: "A few optional questions about anything to go easy on. No account to create.",
    },
    {
      n: "2",
      title: `Follow ${countWord} guided moves`,
      body: "Clear cues, an illustration for each move, and a timer that keeps you honest.",
    },
    {
      n: "3",
      title: "Tell us how it went",
      body: "One tap. It shapes which moves come back next time.",
    },
  ];

  return (
    <MarketingShell>
      <LandingViewTracker />

      {/* min-w-0: grid items refuse to shrink past their content otherwise,
          which pushes a 320px phone sideways. */}
      <section className="grid items-center gap-8 py-4 lg:grid-cols-[1.05fr_0.95fr] lg:py-12">
        <div className="min-w-0">
          <h1 className="font-display font-extrabold text-[2.4rem] leading-[1.02] text-balance text-ink sm:text-[3.5rem]">
            {HERO_HEADLINE}
          </h1>
          <p className="mt-4 max-w-[34rem] text-lg leading-relaxed text-muted">{HERO_SUPPORT}</p>

          <div className="mt-6 max-w-[26rem]" data-free-start>
            <StartResetButton minutes={FREE_RESET_MINUTES} source="landing_hero">
              {FREE_CTA_LABEL}
            </StartResetButton>
          </div>
          <p className="mt-3 text-sm font-semibold text-muted">{FREE_REASSURANCE}</p>
          {/* One joke, and not on a narrow screen, where the demo matters more. */}
          <p className="mt-2 hidden text-sm text-muted sm:block">{HERO_ASIDE}</p>
        </div>

        <div className="flex min-w-0 justify-center lg:justify-end">
          <WorkoutDemo moves={reset.demo} totalSteps={reset.stepCount} />
        </div>
      </section>

      <section className="py-6" aria-labelledby="targeted">
        <h2 id="targeted" className="text-sm font-semibold text-muted">
          Something specific bothering you?
        </h2>
        <div className="mt-3 max-w-[34rem]">
          <NeedCards />
        </div>
      </section>

      <section className="py-8" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="font-display font-extrabold text-[1.9rem] text-ink">
          How it works
        </h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-8">
          {steps.map((step) => (
            <li key={step.n} className="grid grid-cols-[auto_1fr] gap-x-4 sm:block">
              <span aria-hidden className="font-display text-[3.5rem] font-extrabold leading-[0.85] text-pen tabular-nums">
                {step.n}
              </span>
              <div>
                <p className="font-display font-extrabold text-xl text-ink sm:mt-3">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="tonal px-6 py-8 sm:px-8" aria-labelledby="free-offer">
        <h2 id="free-offer" className="font-display font-extrabold text-[1.9rem] text-ink">
          {FREE_OFFER_HEADING}
        </h2>
        <ul className="mt-5 grid gap-3 text-[0.98rem] leading-relaxed text-ink/85 sm:grid-cols-3">
          <li>
            <span className="font-semibold text-ink">The {FREE_RESET_NAME}</span>, whenever you want it, plus
            one- and two-minute versions for a gap between meetings.
          </li>
          <li>
            <span className="font-semibold text-ink">Resets aimed at what hurts</span>: neck and shoulders,
            back and hips, wrists and hands, energy, or changing position.
          </li>
          <li>
            <span className="font-semibold text-ink">Your progress, kept</span>: what you did, what helped, and
            an optional sign-in so it follows you to another device.
          </li>
        </ul>
        <p className="mt-5 text-sm font-semibold text-ink">{FREE_OFFER_TERMS}</p>
      </section>

      <section className="py-10" aria-labelledby="research">
        <h2 id="research" className="font-display font-extrabold text-[1.5rem] text-ink">
          Why short breaks are worth it
        </h2>
        <ul className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {PROOF_CALLOUTS.slice(0, 2).map((callout) => (
            <li key={callout.sourceId} className="border-t border-line-strong pt-3 text-[0.95rem] leading-relaxed text-ink/80">
              {callout.text}{" "}
              <span className="text-sm">
                <Citation ids={[callout.sourceId]} />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-[42rem] text-sm leading-relaxed text-muted">
          These are findings from the studies, not promises about DeskBreak. DeskBreak is general movement
          guidance, not medical care.{" "}
          <Link href="/science" className="font-semibold text-pen underline underline-offset-4">
            How we use research
          </Link>
        </p>
      </section>

      <section className="rounded-[20px] bg-ink px-6 py-9 text-paper sm:px-10" aria-labelledby="pro-teaser">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <h2 id="pro-teaser" className="font-display font-extrabold text-[1.5rem] leading-tight sm:text-[1.8rem]">
              Later, if you want it planned for you
            </h2>
            <p className="mt-3 max-w-[36rem] leading-relaxed text-paper/80">
              Pro fits breaks around the hours you actually work and reminds you when each one is due. It adds
              five- and ten-minute routines and the rest of the move library. The free resets stay free.
            </p>
            <Link href="/app/pro?from=landing" className="mt-5 inline-block text-sm font-semibold text-white underline underline-offset-4">
              See what Pro adds
            </Link>
          </div>
          <ul className="grid gap-2">
            {PRO_EXAMPLES.map((item) => (
              <li key={item.time} className="flex items-center justify-between border-b border-paper/20 px-1 py-3 last:border-b-0">
                <span className="font-semibold tabular-nums">{item.time}</span>
                <span className="text-paper/80">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-12" aria-labelledby="guides">
        <h2 id="guides" className="font-display font-extrabold text-[1.5rem] text-ink">
          Desk exercises, written out
        </h2>
        <ul className="mt-4 grid border-t border-line sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
          {LANDING_PAGES.map((page) => (
            <li key={page.slug} className="border-b border-line">
              <Link href={`/${page.slug}`} className="block py-3.5 font-semibold text-ink underline-offset-4 hover:text-pen hover:underline">
                {page.title}
              </Link>
            </li>
          ))}
        </ul>

        <h2 id="blog" className="mt-10 font-display font-extrabold text-[1.5rem] text-ink">
          What the research says
        </h2>
        <ul className="mt-4 grid border-t border-line sm:grid-cols-2 sm:gap-x-8">
          {BLOG_POSTS.slice(0, 4).map((post) => (
            <li key={post.slug} className="border-b border-line">
              <Link href={`/blog/${post.slug}`} className="block py-3.5 font-semibold text-ink underline-offset-4 hover:text-pen hover:underline">
                {post.title}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/blog" className="mt-4 inline-block text-sm font-semibold text-pen underline underline-offset-4">
          All posts
        </Link>
      </section>

      <section className="border-t border-line py-10 text-center" aria-labelledby="closing">
        <h2 id="closing" className="font-display font-extrabold text-[1.8rem] text-ink">
          {CLOSING_CTA_HEADING}
        </h2>
        <div className="mx-auto mt-5 max-w-[22rem]" data-free-start>
          <StartResetButton minutes={FREE_RESET_MINUTES} source="landing_closing">
            {FREE_CTA_LABEL}
          </StartResetButton>
        </div>
        <p className="mt-3 text-sm font-semibold text-muted">{FREE_REASSURANCE}</p>
      </section>

      <StickyStartBar
        href={startHref({ minutes: FREE_RESET_MINUTES })}
        label={FREE_CTA_LABEL}
        placement="landing_sticky"
      />
    </MarketingShell>
  );
}
