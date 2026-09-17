import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterArt } from "@/components/CharacterArt";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker, StartResetButton } from "@/components/marketing/LandingCta";
import { getExercise } from "@/lib/content";
import { AREA_PAGES, findAreaPage } from "@/lib/seo-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return AREA_PAGES.map((page) => ({ area: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }): Promise<Metadata> {
  const { area } = await params;
  const page = findAreaPage(area);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/desk-exercises/${page.slug}` },
    openGraph: { title: page.metaTitle, description: page.metaDescription },
  };
}

export default async function AreaPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  const page = findAreaPage(area);
  if (!page) notFound();

  const moves = page.moves.map((id) => getExercise(id)).filter((exercise) => exercise !== undefined);

  return (
    <MarketingShell>
      <LandingViewTracker page={`desk_exercises_${page.slug}`} seo />
      <article className="py-10">
        <h1 className="font-display text-[2.2rem] font-semibold leading-tight tracking-tight text-ink">{page.title}</h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-ink/65">{page.intro}</p>

        <div className="surface-elevated mt-8 max-w-[34rem] px-5 py-6 sm:px-7">
          <p className="font-display text-lg font-semibold text-ink">{page.ctaLabel}</p>
          <p className="mt-1 text-sm text-ink/60">Timed, cued and illustrated. No account, no equipment.</p>
          <div className="mt-4">
            <StartResetButton need={page.need} minutes={3} source={`seo_${page.slug}`} seo>
              Start the 3-minute reset
            </StartResetButton>
          </div>
        </div>

        <ol className="mt-10 grid gap-4">
          {moves.map((exercise, index) => (
            <li key={exercise.id} className="surface flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
              <CharacterArt pose="exercise" exerciseId={exercise.id} size={110} alt={`Stretch demonstrating ${exercise.name}`} />
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-ink">
                  {index + 1}.{" "}
                  <Link href={`/moves/${exercise.id}`} className="hover:text-coral">
                    {exercise.name}
                  </Link>
                </h2>
                <p className="mt-1.5 leading-relaxed text-ink/70">{exercise.cue}</p>
                {exercise.feelIt ? (
                  <p className="mt-2 text-sm text-ink/55">
                    <strong className="font-semibold text-ink/70">Feel it:</strong> {exercise.feelIt}
                  </p>
                ) : null}
                {exercise.avoid ? (
                  <p className="mt-1 text-sm text-ink/55">
                    <strong className="font-semibold text-ink/70">Avoid:</strong> {exercise.avoid}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <ul className="mt-8 max-w-[42rem] space-y-2 text-ink/60">
          {page.notes.map((note) => (
            <li key={note} className="ml-5 list-disc leading-relaxed">
              {note}
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <StartResetButton need={page.need} minutes={3} source={`seo_${page.slug}_footer`} seo>
            Start the 3-minute reset
          </StartResetButton>
        </div>
      </article>
    </MarketingShell>
  );
}
