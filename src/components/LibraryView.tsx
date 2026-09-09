"use client";

import { useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { BODY_AREA_LABELS, BODY_AREAS } from "@/lib/body-areas";
import { getExercise, getExercises } from "@/lib/content";
import { formatDose } from "@/lib/format";
import type { BodyArea } from "@/lib/types";

export function LibraryView() {
  const exercises = getExercises();
  const [area, setArea] = useState<BodyArea | "all">("all");

  const filtered = useMemo(() => {
    if (area === "all") return exercises;
    return exercises.filter((exercise) => exercise.bodyArea === area);
  }, [area, exercises]);

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-coral">
          Browse
        </p>
        <h1 className="mt-1 font-display text-[2rem] font-semibold leading-tight text-ink">
          Move library
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/60">
          {exercises.length} desk-safe moves. Filter by the bit that feels
          stuck.
        </p>

        <div className="-mx-5 mt-5 overflow-x-auto px-5">
          <div className="flex w-max gap-2 pb-1">
            <FilterChip
              label="All"
              active={area === "all"}
              onClick={() => setArea("all")}
            />
            {BODY_AREAS.map((id) => (
              <FilterChip
                key={id}
                label={BODY_AREA_LABELS[id]}
                active={area === id}
                onClick={() => setArea(id)}
              />
            ))}
          </div>
        </div>

        <ul className="mt-5 flex flex-col gap-3">
          {filtered.map((exercise) => {
            const swap = exercise.saferSwapId
              ? getExercise(exercise.saferSwapId)
              : null;
            return (
              <li
                key={exercise.id}
                className="rounded-[24px] bg-white p-4 shadow-[0_4px_0_rgba(28,25,23,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold leading-tight text-ink">
                    {exercise.name}
                  </h2>
                  <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink/55">
                    {BODY_AREA_LABELS[exercise.bodyArea]}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  {exercise.cue}
                </p>
                <p className="mt-3 text-sm font-semibold text-coral">
                  {formatDose(exercise.defaultDose)}
                </p>
                <p className="mt-1 text-xs text-ink/45">
                  Watch for: {exercise.commonMistake}
                </p>
                {swap && (
                  <p className="mt-2 text-xs text-ink/45">
                    Gentler swap: {swap.name}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </main>
      <BottomNav />
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
      className={[
        "min-h-10 rounded-full px-4 text-sm font-semibold",
        "transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] active:scale-95",
        active ? "bg-ink text-paper" : "bg-white text-ink/70",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
