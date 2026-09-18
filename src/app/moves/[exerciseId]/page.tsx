import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ExerciseDetail } from "@/components/ExerciseDetail";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker } from "@/components/marketing/LandingCta";
import { getExercise, getExercises } from "@/lib/content";
import { EXERCISE_ALIASES } from "@/lib/exercise-aliases";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.co").replace(/\/$/, "");

export const dynamicParams = false;

export function generateStaticParams() {
  // Retired ids are generated too, so old links reach the redirect below.
  return [...getExercises().map((exercise) => exercise.id), ...Object.keys(EXERCISE_ALIASES)].map((exerciseId) => ({
    exerciseId,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ exerciseId: string }> }): Promise<Metadata> {
  const { exerciseId } = await params;
  const exercise = getExercise(exerciseId);
  if (!exercise || exercise.id !== exerciseId) return {};
  return {
    title: `${exercise.name}: how to do it at your desk`,
    description: exercise.rationale ?? exercise.cue,
    alternates: { canonical: `/moves/${exercise.id}` },
  };
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
