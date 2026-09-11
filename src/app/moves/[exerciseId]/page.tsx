import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExerciseDetail } from "@/components/ExerciseDetail";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LandingViewTracker } from "@/components/marketing/LandingCta";
import { getExercise, getExercises } from "@/lib/content";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.app").replace(/\/$/, "");

export const dynamicParams = false;

export function generateStaticParams() {
  return getExercises().map((exercise) => ({ exerciseId: exercise.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ exerciseId: string }> }): Promise<Metadata> {
  const { exerciseId } = await params;
  const exercise = getExercise(exerciseId);
  if (!exercise) return {};
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
