import { notFound } from "next/navigation";
import { ExerciseDetail } from "@/components/ExerciseDetail";
import { getExercise, getExercises } from "@/lib/content";

export function generateStaticParams() {
  return getExercises().map((exercise) => ({ exerciseId: exercise.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const exercise = getExercise(exerciseId);
  return { title: exercise?.name ?? "Movement", robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const exercise = getExercise(exerciseId);
  if (!exercise) notFound();
  return <ExerciseDetail exercise={exercise} inApp />;
}
