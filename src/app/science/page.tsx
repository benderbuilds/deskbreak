import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker, StartResetButton } from "@/components/marketing/LandingCta";
import { getEvidence } from "@/lib/content";
import { ALGORITHM_VERSION } from "@/lib/recommendation";

export const metadata: Metadata = {
  title: "The science behind DeskBreak",
  description:
    "Why DeskBreak interrupts sitting with short movement breaks, why it includes more than stretching, and how routines are built and reviewed.",
  alternates: { canonical: "/science" },
};

const SECTIONS = [
  {
    heading: "Why interrupt sitting?",
    body: [
      "Long, uninterrupted sitting is associated with worse outcomes than the same amount of sitting broken into shorter blocks. Experimental work has found that brief, regular activity breaks during prolonged sitting change how the body handles a meal, and large population studies suggest that regular activity substantially weakens the link between sitting time and poor health.",
      "DeskBreak's job is to make those interruptions happen. It does not claim to know you have been sitting; it makes the break easy enough that you take it anyway.",
    ],
  },
  {
    heading: "Why short movement breaks?",
    body: [
      "Reviews of workplace break interventions find that active breaks are associated with less discomfort in office workers without costing productivity. Frequency matters more than length: several two- or three-minute breaks across a day do more than one long session that rarely happens.",
      "Three minutes is DeskBreak's default because it is long enough to reach the neck, shoulders, wrists, back, hips and legs, and short enough to repeat.",
    ],
  },
  {
    heading: "Why DeskBreak includes more than stretching",
    body: [
      "Stretching is pleasant and improves how far joints move, but it is not the only lever. Randomised trials in office workers have found that small daily amounts of resistance exercise are associated with less frequent neck and shoulder pain, and reviews of workplace programmes find combined mobility and strengthening more useful than stretching alone.",
      "So a Desk Reset mixes mobility, light activation (a shoulder-blade squeeze, a glute squeeze, a sit-to-stand), a change of position, and where possible a short walk. Move more. Change positions. Build capacity.",
    ],
  },
  {
    heading: "Why there isn't one perfect posture",
    body: [
      "The evidence does not support a single correct sitting posture that prevents pain. What it does support is variability: changing position regularly and moving. DeskBreak therefore never tells you to sit up straight. It tells you to sit differently, and to get up.",
    ],
  },
  {
    heading: "How routines are created",
    body: [
      "Every movement in the library is tagged with the areas it addresses, the kind of movement it is (mobility, strength, activation, aerobic, breathing, position change or an eye break), where it can sit in a routine, functional constraints it conflicts with, and the evidence category it draws on.",
      "A routine is assembled from a template with phases: reset, mobilize, activate, move, return. Each slot is filled by scoring candidates on relevance to what you asked for, how often it has helped you before, structural fit, your preferences and restrictions, recent repetition, time of day and variety. Anything you have said you would rather avoid is excluded before scoring, whatever its score.",
      `Every generated routine is validated for length, position changes, balance, repetition and safety before you see it. If it fails, a hand-authored routine is used instead. Each recommendation is versioned (currently ${ALGORITHM_VERSION}) and stored with its inputs, so what you report afterwards can be attributed to what was recommended.`,
    ],
  },
  {
    heading: "Who reviews the content",
    body: [
      "Cues, sequencing, safer alternatives and the wording on this page are written to be conservative: DeskBreak provides general movement guidance for healthy desk workers, does not diagnose, and does not treat injuries. A review of the full library by a licensed physical therapist is planned before DeskBreak describes itself as clinically reviewed; until that review is complete, we do not make that claim.",
    ],
  },
];

export default function SciencePage() {
  const references = getEvidence();

  return (
    <MarketingShell>
      <LandingViewTracker page="science" />
      <article className="py-10">
        <h1 className="max-w-[40rem] font-display text-[2.2rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.6rem]">
          Why DeskBreak works the way it does
        </h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-ink/70">
          Evidence-informed, carefully worded, and honest about what it is: short movement breaks
          designed for people who sit at a computer all day.
        </p>

        <div className="mt-10 max-w-[42rem] space-y-9">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-semibold text-ink">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="mt-3 leading-relaxed text-ink/70">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <section className="mt-12 max-w-[42rem]" aria-labelledby="references">
          <h2 id="references" className="font-display text-xl font-semibold text-ink">
            References
          </h2>
          <p className="mt-2 text-sm text-ink/55">
            A curated list, not an exhaustive one. Summaries describe what each study looked at, not what DeskBreak does to you.
          </p>
          <ol className="mt-4 grid gap-4">
            {references.map((reference, index) => (
              <li key={reference.id} className="text-sm leading-relaxed text-ink/70">
                <span className="mr-2 font-semibold text-ink/40">{index + 1}.</span>
                <a href={reference.url} target="_blank" rel="noreferrer" className="font-semibold text-coral">
                  {reference.title}
                </a>
                . {reference.source}, {reference.year}. <span className="text-ink/55">{reference.summary}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="surface-elevated mt-12 max-w-[34rem] px-5 py-6 sm:px-7">
          <p className="font-display text-lg font-semibold text-ink">Try the guided version</p>
          <p className="mt-1 text-sm text-ink/60">3-Minute Desk Reset. No equipment. No signup.</p>
          <div className="mt-4">
            <StartResetButton minutes={3} source="science">
              Start DeskBreak
            </StartResetButton>
          </div>
        </div>

        <p className="mt-8 text-xs text-ink/45">
          Every movement page lists the evidence it draws on. Browse them from{" "}
          <Link href="/desk-exercises" className="font-semibold text-coral">
            desk exercises
          </Link>
          .
        </p>
      </article>
    </MarketingShell>
  );
}
