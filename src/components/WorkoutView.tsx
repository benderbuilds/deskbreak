"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { getProgram } from "@/lib/content";
import { formatClock, formatDose } from "@/lib/format";
import {
  recordCompletedWorkout,
  saveLastSession,
} from "@/lib/storage";
import { useWorkoutEngine } from "@/lib/use-workout-engine";

export function WorkoutView({ programId }: { programId: string }) {
  const router = useRouter();
  const program = getProgram(programId);
  const engine = useWorkoutEngine(programId);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!program) {
      router.replace("/");
    }
  }, [program, router]);

  useEffect(() => {
    if (engine.status !== "complete" || !program || recordedRef.current) return;
    recordedRef.current = true;
    const session = {
      programId: program.id,
      programName: program.name,
      durationMin: program.durationMin,
      completedExerciseIds: engine.completedIds,
      skippedExerciseIds: engine.skippedIds,
      elapsedSec: Math.max(1, Math.round(engine.elapsedSec)),
      finishedAt: new Date().toISOString(),
    };
    saveLastSession(session);
    recordCompletedWorkout(session);
    router.replace("/done");
  }, [
    engine.status,
    engine.completedIds,
    engine.skippedIds,
    engine.elapsedSec,
    program,
    router,
  ]);

  const current = engine.current;
  const doseLabel = useMemo(
    () => (current ? formatDose(current.exercise.defaultDose) : ""),
    [current],
  );

  if (!program || !current) {
    return <div className="min-h-dvh bg-paper" />;
  }

  const seconds = formatClock(engine.remainingSec);
  const stepLabel = `${engine.stepIndex + 1} of ${engine.steps.length}`;

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.9rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="grid h-12 w-12 place-items-center rounded-full bg-white text-ink shadow-[0_3px_0_rgba(28,25,23,0.06)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] active:scale-95"
          aria-label="Leave break"
        >
          <CloseIcon />
        </button>
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">
            {program.shortLabel}
          </p>
          <p className="text-sm font-semibold text-ink/60">{stepLabel}</p>
        </div>
        <button
          type="button"
          onClick={engine.status === "paused" ? engine.resume : engine.pause}
          className="grid h-12 w-12 place-items-center rounded-full bg-white text-ink shadow-[0_3px_0_rgba(28,25,23,0.06)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] active:scale-95"
          aria-label={engine.status === "paused" ? "Resume" : "Pause"}
        >
          {engine.status === "paused" ? <PlayIcon /> : <PauseIcon />}
        </button>
      </header>

      <div className="mb-5 h-2 overflow-hidden rounded-full bg-ink/8">
        <div
          className="h-full rounded-full bg-mint transition-[width] duration-200 ease-out"
          style={{ width: `${Math.round(engine.progress * 100)}%` }}
        />
      </div>

      <div className="relative flex flex-1 flex-col items-center text-center">
        {engine.status === "paused" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[32px] bg-paper/80 backdrop-blur-[2px]">
            <p className="font-display text-3xl font-semibold text-ink">Paused</p>
            <p className="mt-2 max-w-[16rem] text-sm text-ink/55">
              No rush. Resume when you&apos;re ready.
            </p>
            <div className="mt-6 w-full max-w-[220px]">
              <Button onClick={engine.resume}>Resume</Button>
            </div>
          </div>
        )}

        <p
          key={current.exercise.id + "-time"}
          className="font-display text-[6.5rem] font-semibold leading-none tracking-tight text-ink tabular-nums"
        >
          {seconds}
        </p>
        <p className="mt-2 text-sm font-semibold text-ink/45">{doseLabel}</p>

        <div
          key={current.exercise.id}
          className="mt-8 w-full animate-[stepIn_260ms_cubic-bezier(0.34,1.2,0.64,1)]"
        >
          <h1 className="font-display text-[2rem] font-semibold leading-tight text-ink">
            {current.exercise.name}
          </h1>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-ink/70">
            {current.exercise.cue}
          </p>
          <p className="mt-4 text-sm text-ink/45">
            Watch for: {current.exercise.commonMistake}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[1fr_1.4fr] gap-3">
        <Button variant="ghost" onClick={engine.skip}>
          Skip
        </Button>
        <Button onClick={engine.next}>
          {engine.stepIndex === engine.steps.length - 1 ? "Done" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M4 4l10 10M14 4 4 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="3" y="2" width="3.5" height="12" rx="1" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4 2.5v11l9-5.5-9-5.5Z" />
    </svg>
  );
}
