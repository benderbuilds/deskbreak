import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ExerciseDetail } from "@/components/ExerciseDetail";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker } from "@/components/marketing/LandingCta";
import { getExercise, getExercises } from "@/lib/content";
import { formatDose } from "@/lib/format";
import type { Exercise } from "@/lib/types";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.co").replace(/\/$/, "");

// Retired ids never reach this page: next.config.ts redirects them (308).
export const dynamicParams = false;

export function generateStaticParams() {
  return getExercises().map((exercise) => ({ exerciseId: exercise.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ exerciseId: string }> }): Promise<Metadata> {
  const { exerciseId } = await params;
  const exercise = getExercise(exerciseId);
  if (!exercise || exercise.id !== exerciseId) return {};
  return {
    title: `${exercise.name}: how to do it at your desk`,
    description: moveDescription(exercise),
    alternates: { canonical: `/moves/${exercise.id}` },
  };
}

/**
 * What a searcher sees under the title: the move's name, as much of the
 * instruction as fits in whole sentences, the dose, and what the page offers.
 * Search results cut off near 160 characters; the offer always survives.
 */
function moveDescription(exercise: Exercise): string {
  // Pro moves open the paywall, so only free moves may promise a free reset.
  const extra = exercise.access === "free" ? "free guided 3-minute reset" : "common mistake to avoid";
  const tail = `${formatDose(exercise.defaultDose)} · easier option · ${extra}`;
  const room = 160 - exercise.name.length - tail.length - 4;
  const sentences = exercise.cue.split(/(?<=\.)\s+/);
  let how = "";
  for (const sentence of sentences) {
    const next = how ? `${how} ${sentence}` : sentence;
    if (next.length > room) break;
    how = next;
  }
  // A first sentence too long to fit is cut at a word, never left out.
  if (!how) how = `${sentences[0].slice(0, room - 1).replace(/\s+\S*$/, "")}…`;
  return `${exercise.name}: ${how} ${tail}`;
}

/** Public, indexable page for one movement. Same component the app uses. */
export default async function MovePage({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const exercise = getExercise(exerciseId);
  if (!exercise) notFound();
  if (exercise.id !== exerciseId) permanentRedirect(`/moves/${exercise.id}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: exercise.name,
    description: exercise.rationale ?? exercise.cue,
    url: `${BASE}/moves/${exercise.id}`,
    step: [{ "@type": "HowToStep", position: 1, name: exercise.name, text: exercise.cue }],
  };

  return (
    <MarketingShell>
      <LandingViewTracker page={`move_${exercise.id}`} seo />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-[40rem]">
        <ExerciseDetail exercise={exercise} inApp={false} />
      </div>
    </MarketingShell>
  );
}
