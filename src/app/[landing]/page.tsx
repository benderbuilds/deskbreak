import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterArt } from "@/components/CharacterArt";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker, StartResetButton } from "@/components/marketing/LandingCta";
import { getExercise } from "@/lib/content";
import { LANDING_PAGES, findLandingPage } from "@/lib/seo-content";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.app").replace(/\/$/, "");

export const dynamicParams = false;

export function generateStaticParams() {
  return LANDING_PAGES.map((page) => ({ landing: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ landing: string }> }): Promise<Metadata> {
  const { landing } = await params;
  const page = findLandingPage(landing);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
    openGraph: { title: page.metaTitle, description: page.metaDescription, type: "article" },
  };
}

/**
 * One search intent, one page, one guided handoff.
 *
 * Useful on its own (the moves are written out, illustrated, with cues), and
 * the CTA preloads the matching recommendation so the reader is moving within
 * a second of clicking.
 */
export default async function SeoLandingPage({ params }: { params: Promise<{ landing: string }> }) {
  const { landing } = await params;
  const page = findLandingPage(landing);
  if (!page) notFound();

  const moves = page.moves.map((id) => getExercise(id)).filter((exercise) => exercise !== undefined);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.title,
    description: page.metaDescription,
    url: `${BASE}/${page.slug}`,
    author: { "@type": "Organization", name: "DeskBreak" },
    publisher: { "@type": "Organization", name: "DeskBreak", url: BASE },
    about: page.intents.map((intent) => ({ "@type": "Thing", name: intent })),
    hasPart: {
      "@type": "HowTo",
      name: page.title,
      totalTime: `PT${page.durationMinutes}M`,
      step: moves.map((exercise, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: exercise.name,
        text: exercise.cue,
        url: `${BASE}/moves/${exercise.id}`,
      })),
    },
  };

  return (
    <MarketingShell>
      <LandingViewTracker page={`seo_${page.slug}`} seo />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="py-10">
        <h1 className="max-w-[40rem] font-display text-[2.2rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.6rem]">
          {page.title}
        </h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-ink/70">{page.answer}</p>

        <div className="surface-elevated mt-8 max-w-[34rem] px-5 py-6 sm:px-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">{page.ctaTitle}</p>
          <p className="mt-1 font-display text-xl font-semibold text-ink">
            {page.durationMinutes}-Minute {page.need === "general" ? "Desk Reset" : "Reset"}
          </p>
          <p className="mt-1 text-sm text-ink/60">No equipment. No signup. Timed, cued and illustrated.</p>
          <div className="mt-4">
            <StartResetButton need={page.need} minutes={page.durationMinutes <= 3 ? page.durationMinutes : 3} source={`seo_${page.slug}`} seo>
              {page.ctaLabel}
            </StartResetButton>
          </div>
        </div>

        <h2 className="mt-12 font-display text-[1.6rem] font-semibold tracking-tight text-ink">
          Best {page.need === "wrists_hands" ? "wrist" : page.need === "neck_shoulders" ? "neck and shoulder" : page.need === "back_hips" ? "back and hip" : "desk"} exercises
        </h2>
        <ol className="mt-5 grid gap-4">
          {moves.map((exercise, index) => (
            <li key={exercise.id} className="surface flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
              <CharacterArt pose="exercise" exerciseId={exercise.id} size={110} alt={`Stretch demonstrating ${exercise.name}`} />
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold text-ink">
                  {index + 1}.{" "}
                  <Link href={`/moves/${exercise.id}`} className="hover:text-coral">
                    {exercise.name}
                  </Link>
                </h3>
                <p className="mt-1.5 leading-relaxed text-ink/70">{exercise.cue}</p>
                {exercise.feelIt ? (
                  <p className="mt-2 text-sm text-ink/55">
                    <strong className="font-semibold text-ink/70">Feel it:</strong> {exercise.feelIt}
                  </p>
                ) : null}
                {exercise.avoid ? (
                  <p className="mt-1 text-sm text-ink/55">
                    <strong className="font-semibold text-ink/70">Common mistake:</strong> {exercise.avoid}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 max-w-[42rem] space-y-7">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-semibold text-ink">{section.heading}</h2>
              <p className="mt-2 leading-relaxed text-ink/70">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="surface-elevated mt-10 max-w-[34rem] px-5 py-6 sm:px-7">
          <p className="font-display text-lg font-semibold text-ink">{page.ctaTitle}</p>
          <p className="mt-1 text-sm text-ink/60">Start DeskBreak. No equipment, no signup.</p>
          <div className="mt-4">
            <StartResetButton need={page.need} minutes={page.durationMinutes <= 3 ? page.durationMinutes : 3} source={`seo_${page.slug}_footer`} seo>
              {page.ctaLabel}
            </StartResetButton>
          </div>
        </div>

        <nav className="mt-12 text-sm text-ink/55" aria-label="More desk exercise guides">
          <p className="font-semibold text-ink/70">More guides</p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {LANDING_PAGES.filter((entry) => entry.slug !== page.slug).map((entry) => (
              <li key={entry.slug}>
                <Link href={`/${entry.slug}`} className="font-semibold text-coral">
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </MarketingShell>
  );
}
