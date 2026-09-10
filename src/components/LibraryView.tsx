"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CharacterArt } from "@/components/CharacterArt";
import { EmptyState } from "@/components/StatusStates";
import { BODY_AREA_LABELS, BODY_AREAS } from "@/lib/body-areas";
import { getExercises } from "@/lib/content";
import { isExerciseLocked, isProEntitlement } from "@/lib/entitlements";
import { formatDose } from "@/lib/format";
import { track } from "@/lib/analytics";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import type { BodyArea, Exercise } from "@/lib/types";

export function LibraryView() {
  const router = useRouter();
  const isClient = useIsClient();
  const exercises = getExercises();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);
  const [area, setArea] = useState<BodyArea | "all">("all");

  const freeCount = useMemo(
    () => exercises.filter((exercise) => exercise.access === "free").length,
    [exercises],
  );

  const filtered = useMemo(
    () => (area === "all" ? exercises : exercises.filter((e) => e.bodyArea === area)),
    [area, exercises],
  );

  if (!isClient) return null;

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-coral">
        Browse
      </p>
      <h1 className="mt-1 font-display text-[2rem] font-semibold leading-tight text-ink">
        Move library
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink/60">
        {pro
          ? `${exercises.length} desk-safe moves. Filter by the bit that feels stuck.`
          : `${freeCount} free moves · ${exercises.length} with Pro.`}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <FilterChip label="All" active={area === "all"} onClick={() => setArea("all")} />
        {BODY_AREAS.map((id) => (
          <FilterChip
            key={id}
            label={BODY_AREA_LABELS[id]}
            active={area === id}
            onClick={() => setArea(id)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nothing in this filter"
            body="Try another body area, or All."
          />
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {filtered.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              locked={isExerciseLocked(exercise, state.entitlement)}
              onLocked={() => {
                track("locked_program_clicked", {
                  exercise_id: exercise.id,
                  need: exercise.needs[0],
                });
                router.push(`/app/pro?from=library&need=${exercise.needs[0]}`);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "min-h-11 rounded-full px-4 text-sm font-semibold transition-colors",
        active ? "bg-ink text-paper" : "bg-white text-ink/60 shadow-[0_2px_0_rgba(28,25,23,0.06)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ExerciseCard({
  exercise,
  locked,
  onLocked,
}: {
  exercise: Exercise;
  locked: boolean;
  onLocked: () => void;
}) {
  const body = (
    <div className="flex items-center gap-3">
      <CharacterArt
        pose={locked ? "locked" : "exercise"}
        exerciseId={locked ? undefined : exercise.id}
        size={64}
        alt=""
      />
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold text-ink">{exercise.name}</p>
        <p className="mt-0.5 text-sm text-ink/55">
          {BODY_AREA_LABELS[exercise.bodyArea]} · {formatDose(exercise.defaultDose)}
        </p>
        {!locked && exercise.feelIt ? (
          <p className="mt-1 text-xs leading-relaxed text-ink/50">
            Feel it: {exercise.feelIt}
          </p>
        ) : null}
      </div>
      {locked ? (
        <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-paper">
          Pro
        </span>
      ) : null}
    </div>
  );

  if (!locked) {
    return (
      <li className="rounded-[22px] bg-white px-4 py-3.5 shadow-[0_2px_0_rgba(28,25,23,0.06)]">
        {body}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={onLocked}
        className="w-full rounded-[22px] bg-white px-4 py-3.5 text-left shadow-[0_2px_0_rgba(28,25,23,0.06)] transition-transform duration-200 active:translate-y-[2px] active:shadow-none"
      >
        {body}
      </button>
    </li>
  );
}
