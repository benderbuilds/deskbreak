import { Suspense } from "react";
import { WorkoutScreen } from "@/components/WorkoutScreen";
import { LoadingShell } from "@/components/StatusStates";

export const metadata = { title: "Your DeskBreak", robots: { index: false } };

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  return (
    <Suspense fallback={<LoadingShell label="Loading your DeskBreak" />}>
      <WorkoutScreen programId={programId} />
    </Suspense>
  );
}
