import { WorkoutView } from "@/components/WorkoutView";
import { getPrograms } from "@/lib/content";

export function generateStaticParams() {
  return getPrograms().map((program) => ({ programId: program.id }));
}

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  return <WorkoutView programId={programId} />;
}
