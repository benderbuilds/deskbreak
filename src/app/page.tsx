import type { Metadata } from "next";
import { CharacterArt } from "@/components/CharacterArt";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { NeedCards } from "@/components/marketing/NeedCards";
import {
  LandingViewTracker,
  StartResetButton,
} from "@/components/marketing/LandingCta";
import { PRODUCT_SUBHEAD } from "@/lib/constants";

export const metadata: Metadata = {
  title: "DeskBreak - feel better at your desk in 2 minutes",
  description: PRODUCT_SUBHEAD,
  alternates: { canonical: "/" },
};

/** Product proof, standing in for testimonials until there are real ones. */
const PROOF = [
  { value: "2 minutes", label: "Start to finish" },
  { value: "No equipment", label: "Nothing to buy" },
  { value: "Beside your desk", label: "No changing clothes" },
];

const STEPS = [
  { n: "1", title: "Tell us what feels off", body: "One tap. Neck, back, wrists, energy, stress." },
  { n: "2", title: "Move for two minutes", body: "Guided, timed, and specific to what you picked." },
  { n: "3", title: "Get back to work feeling better", body: "No app to learn. No workout to plan." },
];

const PRO_EXAMPLES = [
  { time: "10:30 AM", label: "Neck reset" },
  { time: "1:15 PM", label: "Hip + back reset" },
  { time: "3:30 PM", label: "Energy reset" },
];

export default function LandingPage() {
  return (
    <MarketingShell>
      <LandingViewTracker />

      <section className="grid items-center gap-8 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-14">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral">
            For people who work at computers
          </p>
          <h1 className="mt-4 font-display text-[2.4rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-[3.2rem]">
            Your neck shouldn&apos;t pay rent for a laptop.
          </h1>
          <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink/65">
            {PRODUCT_SUBHEAD}
          </p>
          <div className="mt-8">
            <StartResetButton />
          </div>
          <p className="mt-4 text-sm text-ink/50">
            No account. No equipment. No changing clothes.
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <CharacterArt pose="ready" size={300} alt="Stretch, ready to go" />
        </div>
      </section>

      <section className="py-10" aria-labelledby="whats-bothering">
        <h2
          id="whats-bothering"
          className="font-display text-[1.9rem] font-semibold tracking-tight text-ink"
        >
          What&apos;s bothering you right now?
        </h2>
        <p className="mt-2 text-ink/60">Pick one and we&apos;ll start there.</p>
        <div className="mt-6">
          <NeedCards />
        </div>
      </section>

      <section className="py-10" aria-label="What DeskBreak is">
        <ul className="grid gap-3 sm:grid-cols-3">
          {PROOF.map((item) => (
            <li
              key={item.value}
              className="rounded-[22px] border-2 border-ink/8 px-5 py-6 text-center"
            >
              <p className="font-display text-xl font-semibold text-ink">{item.value}</p>
              <p className="mt-1 text-sm text-ink/55">{item.label}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="py-10" aria-labelledby="how-it-works">
        <h2
          id="how-it-works"
          className="font-display text-[1.9rem] font-semibold tracking-tight text-ink"
        >
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-[22px] bg-white px-5 py-6 shadow-[0_4px_0_rgba(28,25,23,0.06)]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-coral text-sm font-semibold text-white">
                {step.n}
              </span>
              <p className="mt-4 font-display text-lg font-semibold text-ink">
                {step.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink/60">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <StartResetButton source="landing_how_it_works">
            Start my DeskBreak
          </StartResetButton>
        </div>
      </section>

      <section
        className="mt-6 rounded-[28px] bg-ink px-6 py-10 text-paper sm:px-10"
        aria-labelledby="pro-teaser"
      >
        <h2
          id="pro-teaser"
          className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-[2rem]"
        >
          Want DeskBreak to handle the rest of your day?
        </h2>
        <p className="mt-3 max-w-[36rem] leading-relaxed text-paper/70">
          Pro builds tiny movement breaks around your schedule and what your body
          needs.
        </p>
        <ul className="mt-7 grid gap-2 sm:max-w-[24rem]">
          {PRO_EXAMPLES.map((item) => (
            <li
              key={item.time}
              className="flex items-center justify-between rounded-2xl bg-paper/10 px-4 py-3"
            >
              <span className="font-semibold tabular-nums">{item.time}</span>
              <span className="text-paper/70">{item.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </MarketingShell>
  );
}
