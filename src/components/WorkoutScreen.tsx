"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ResumePrompt, WorkoutView } from "@/components/WorkoutView";
import { clearActiveWorkout, getAppState } from "@/lib/storage";
import { resumableWorkout } from "@/lib/resume";
import { useIsClient } from "@/lib/use-client";
import { LoadingShell } from "@/components/StatusStates";
import { isPrimaryNeed, type PrimaryNeed, type SetupId } from "@/lib/types";

export function WorkoutScreen({ programId }: { programId: string }) {
  const isClient = useIsClient();
  const params = useSearchParams();
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [decided, setDecided] = useState(false);
  // Read once, on mount: whether a resume is on offer must not change just
  // because the component re-rendered a second later.
  const [resumable] = useState(() => resumableWorkout(programId));

  if (!isClient) return <LoadingShell label="Loading your DeskBreak" />;

  const state = getAppState();
  const needParam = params.get("need");
  const setupParam = params.get("setup");
  const need: PrimaryNeed = isPrimaryNeed(needParam)
    ? needParam
    : (state.primaryNeed ?? "general");
  const setup: SetupId =
    setupParam === "standing" || setupParam === "seated"
      ? setupParam
      : (state.preferredSetup ?? "seated");

  if (!decided && resumable) {
    return (
      <ResumePrompt
        stepIndex={resumable.stepIndex}
        onResume={() => {
          setResumeAt(resumable.stepIndex);
          setDecided(true);
        }}
        onRestart={() => {
          clearActiveWorkout();
          setResumeAt(0);
          setDecided(true);
        }}
      />
    );
  }

  return (
    <WorkoutView
      programId={programId}
      need={need}
      setup={setup}
      resumeAt={resumeAt ?? 0}
    />
  );
}
