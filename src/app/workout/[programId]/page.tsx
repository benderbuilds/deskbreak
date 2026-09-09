import { WorkoutView } from "@/components/WorkoutView";
import { getPrograms } from "@/lib/content";

export function generateStaticParams() {
  return getPrograms().map((program) => ({ programId: program.id }));
}

export default async function WorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ src?: string }>;
}) {
  const { programId } = await params;
  const { src } = await searchParams;
  return <WorkoutView programId={programId} firstWin={src === "firstWin"} />;
}
