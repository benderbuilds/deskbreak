import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker, StartResetButton } from "@/components/marketing/LandingCta";
import { RichText } from "@/components/marketing/RichText";
import { ALGORITHM_VERSION } from "@/lib/recommendation";
import { allSources } from "@/lib/seo-content";

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
      "In observational studies, long, uninterrupted sitting is associated with worse health markers than the same amount of sitting broken into shorter blocks {cite:healy-2008}. Experimental work has found that brief, regular activity breaks during prolonged sitting change how the body handles a meal {cite:dunstan-2012,loh-2020}. Large population studies suggest that high levels of daily activity, around an hour a day of moderate activity, can offset the link between long sitting time and early death {cite:ekelund-2016}. Desk breaks are one small piece of that, not a replacement for regular exercise {cite:who-2020}.",
      "DeskBreak's job is to make those interruptions happen. It does not claim to know you have been sitting; it makes the break easy enough that you take it anyway.",
    ],
  },
  {
    heading: "Why short movement breaks?",
    body: [
      "Reviews of workplace break interventions find moderate-quality evidence that active breaks with a change of posture are associated with less discomfort in office workers, without costing productivity {cite:waongenngarm-2018}. Studies of desk workers have found benefits from short breaks taken often, for example every 20 to 30 minutes {cite:mclean-2001,shrestha-2018}, and short breaks you actually take add up. They're easier to fit into a real workday, and easier to repeat, than a long session.",
      "Three minutes is DeskBreak's default because it is long enough to reach the neck, shoulders, wrists, back, hips and legs, and short enough to repeat.",
    ],
  },
  {
    heading: "Why DeskBreak includes more than stretching",
    body: [
      "Stretching is pleasant, and trials in office workers have found it can reduce discomfort {cite:shariat-2018}, but it is not the only lever. A randomised trial found that just 2 minutes a day of resistance exercise with light elastic bands reduced neck and shoulder pain intensity in working adults with frequent symptoms {cite:andersen-2011}, and a review of office-worker trials found strengthening exercise helped neck pain {cite:louw-2017}. Reviews of workplace programmes find the strongest evidence for strengthening exercise, with more modest evidence for stretching {cite:van-eerd-2016}, so DeskBreak includes both.",
      "So a Desk Reset mixes mobility, light activation (a shoulder-blade squeeze, a glute squeeze, a sit-to-stand), a change of position, and where possible a short walk. DeskBreak's no-equipment moves are a lighter version of the band exercises those trials used. Move more. Change positions. Build capacity.",
    ],
  },
  {
    heading: "Why there isn't one perfect posture",
    body: [
      "There is little evidence that one 'correct' sitting posture prevents pain {cite:slater-2019}. Trials in office workers suggest that regularly changing position and taking active breaks helps {cite:waongenngarm-2018,waongenngarm-2021}. DeskBreak therefore never tells you to sit up straight. It tells you to sit differently, and to get up.",
    ],
  },
  {
    heading: "How routines are created",
    body: [
      "Every movement in the library is tagged with the areas it addresses, the kind of movement it is (mobility, strength, activation, aerobic, breathing, position change or an eye break), where it can sit in a routine, functional constraints it conflicts with, and the evidence category it draws on.",
      "A routine is assembled from a template with phases: reset, mobilize, activate, move, return. Each slot is filled by scoring candidates on relevance to what you asked for, how often it has helped you before, structural fit, your preferences and restrictions, recent repetition, time of day and variety. Anything you have said you would rather avoid is excluded before scoring, whatever its score.",
      `Every generated routine is checked for length, position changes, balance and repetition before you see it. If it fails, a hand-authored routine is used instead. Each recommendation is versioned (currently ${ALGORITHM_VERSION}) and stored with its inputs, so what you report afterwards can be attributed to what was recommended.`,
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
  const references = allSources();

  return (
    <MarketingShell>
      <LandingViewTracker page="science" />
      <article className="py-10">
        <h1 className="max-w-[40rem] font-display font-extrabold text-[2.2rem] leading-tight text-ink sm:text-[2.6rem]">
          Why DeskBreak works the way it does
        </h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-ink/70">
          Evidence-informed, carefully worded, and honest about what it is: short movement breaks
          designed for people who sit at a computer all day.
        </p>

        <div className="mt-10 max-w-[42rem] space-y-9">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display font-extrabold text-xl text-ink">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="mt-3 leading-relaxed text-ink/70">
                  <RichText text={paragraph} />
                </p>
              ))}
            </section>
          ))}
        </div>

        <section className="mt-12 max-w-[42rem]" aria-labelledby="references">
          <h2 id="references" className="font-display font-extrabold text-xl text-ink">
            References
          </h2>
          <p className="mt-2 text-sm text-muted">
            A curated list, not an exhaustive one. Summaries describe what each study looked at, not what DeskBreak does to you.
          </p>
          <ol className="mt-4 grid gap-5">
            {references.map((reference, index) => (
              <li key={reference.id} id={reference.id} className="scroll-mt-6 text-sm leading-relaxed text-ink/70">
                <p>
                  <span className="mr-2 font-semibold text-muted">{index + 1}.</span>
                  {reference.citation ? (
                    reference.citation.replace(reference.url, "").trim()
                  ) : (
                    <>
                      {reference.title}. <em>{reference.source}</em>, {reference.year}.
                    </>
                  )}{" "}
                  <a href={reference.url} target="_blank" rel="noreferrer" className="break-all font-semibold text-pen">
                    doi:{reference.doi}
                  </a>
                </p>
                <p className="mt-1 text-muted">{reference.summary}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="how-we-use-sources" className="mt-12 max-w-[42rem] scroll-mt-6" aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="font-display font-extrabold text-xl text-ink">
            Sources and how we use them
          </h2>
          <p className="mt-3 leading-relaxed text-ink/70">
            Every study cited on DeskBreak, including the blog, is on this list, checked against its PubMed record and
            DOI. We link the DOI, keep the limits a study states (&ldquo;in a lab trial&rdquo;, &ldquo;small&rdquo;,
            &ldquo;in one trial&rdquo;), and only quote words that appear in the published abstract. A finding about
            walking breaks or resistance bands is not a finding about DeskBreak, and we say so where it matters.
          </p>
          <p className="mt-3 leading-relaxed text-ink/70">
            Move pages don&apos;t carry evidence grades. A move cites a study only when that move, or a close analogue,
            was what the study tested.
          </p>
        </section>

        <div className="surface-elevated mt-12 max-w-[34rem] px-5 py-6 sm:px-7">
          <p className="font-display font-extrabold text-lg text-ink">Try the guided version</p>
          <p className="mt-1 text-sm text-muted">3-Minute Desk Reset. No equipment. No signup.</p>
          <div className="mt-4">
            <StartResetButton minutes={3} source="science">
              Start DeskBreak
            </StartResetButton>
          </div>
        </div>

        <p className="mt-8 text-xs text-muted">
          Every movement page explains why it&apos;s in a reset. Browse them from{" "}
          <Link href="/desk-exercises" className="font-semibold text-pen">
            desk exercises
          </Link>
          .
        </p>
      </article>
    </MarketingShell>
  );
}
