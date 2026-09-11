"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ResumePrompt, WorkoutView } from "@/components/WorkoutView";
import { LoadingShell } from "@/components/StatusStates";
import { track } from "@/lib/analytics";
import { resumableWorkout } from "@/lib/resume";
import { clearActiveWorkout, getAppState } from "@/lib/storage";
import { useIsClient } from "@/lib/use-client";
import {
  isPrimaryNeed,
  isSetupRequest,
  type PrimaryNeed,
  type SessionSource,
  type SetupRequest,
} from "@/lib/types";

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
  const need: PrimaryNeed = isPrimaryNeed(needParam) ? needParam : (state.primaryNeed ?? "general");
  const setup: SetupRequest = isSetupRequest(setupParam)
    ? setupParam
    : (state.preferredSetup ?? "either");
  const recommendationId = params.get("rec") ?? resumable?.recommendationId ?? null;
  const source = (params.get("source") ?? resumable?.source ?? "unknown") as SessionSource;
  const plannedBreakId = params.get("break") ?? resumable?.plannedBreakId ?? null;

  if (!decided && resumable) {
    return (
      <ResumePrompt
        stepIndex={resumable.stepIndex}
        onResume={() => {
          track("session_resumed", { program_id: programId, step: resumable.stepIndex + 1 });
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
      recommendationId={recommendationId}
      source={source}
      plannedBreakId={plannedBreakId}
    />
  );
}
