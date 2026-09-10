"use client";

import { useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { CharacterArt } from "@/components/CharacterArt";
import { EmptyState } from "@/components/StatusStates";
import { UpgradeSheet } from "@/components/UpgradeSheet";
import { BODY_AREA_LABELS, BODY_AREAS } from "@/lib/body-areas";
import { getExercise, getExercises, getFreeExercises } from "@/lib/content";
import { isExerciseLocked, isProEntitlement } from "@/lib/entitlements";
import { formatDose } from "@/lib/format";
import { useAppState } from "@/lib/use-app-state";
import type { BodyArea, Exercise, SetupId } from "@/lib/types";

export function LibraryView() {
  const exercises = getExercises();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);
  const [area, setArea] = useState<BodyArea | "all">("all");
  const [upgrade, setUpgrade] = useState(false);

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
          {pro
            ? `${exercises.length} desk-safe moves. Filter by the bit that feels stuck.`
            : `${getFreeExercises().length} free moves · ${exercises.length} with Pro.`}
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
              body="Try another body area — or All."
            />
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {filtered.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                locked={isExerciseLocked(exercise, state.entitlement)}
                onLocked={() => setUpgrade(true)}
                setup={state.onboardingAnswers.setup}
              />
            ))}
          </ul>
        )}
      </main>
      <BottomNav />
      <UpgradeSheet
        open={upgrade}
        onClose={() => setUpgrade(false)}
        reason="The full library — wrists, hips, standing desk work, breathing — unlocks with Pro."
      />
    </div>
  );
}

function ExerciseCard({
  exercise,
  locked,
  onLocked,
  setup,
}: {
  exercise: Exercise;
  locked: boolean;
  onLocked: () => void;
  setup: SetupId | null;
}) {
  const swap = exercise.saferSwapId ? getExercise(exercise.saferSwapId) : null;
  const variant =
    setup === "seated" || setup === "standing"
      ? exercise.setupVariants?.[setup]
      : undefined;
  const cue = variant?.cue ?? exercise.cue;

  return (
    <li>
      <article
        className={[
          "rounded-[24px] bg-white p-4 shadow-[0_4px_0_rgba(28,25,23,0.06)]",
          locked ? "opacity-80" : "",
        ].join(" ")}
      >
        <div className="flex items-start gap-3">
          <CharacterArt
            pose={locked ? "locked" : "exercise"}
            exerciseId={locked ? undefined : exercise.id}
            bodyArea={locked ? undefined : exercise.bodyArea}
            stretchAsset={locked ? undefined : variant?.stretchAsset ?? exercise.stretchAsset}
            stretchAssetB={
              locked ? undefined : variant?.stretchAssetB ?? exercise.stretchAssetB
            }
            stretchView={locked ? undefined : variant?.stretchView ?? exercise.stretchView}
            setup={setup}
            size={72}
            alt={locked ? "Stretch — locked move" : `Stretch — ${exercise.name}`}
            className="mt-0.5 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-semibold leading-tight text-ink">
                {exercise.name}
              </h2>
              <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink/55">
                {locked ? "Pro" : BODY_AREA_LABELS[exercise.bodyArea]}
              </span>
            </div>
            {locked ? (
              <div className="mt-2">
                <p className="text-sm text-ink/55">
                  Locked on Free. Upgrade to see the cue and dose.
                </p>
                <button
                  type="button"
                  onClick={onLocked}
                  className="mt-2 min-h-11 text-sm font-semibold text-coral"
                >
                  Unlock with Pro
                </button>
              </div>
            ) : (
              <>
                {exercise.shortLabel ? (
                  <p className="mt-1 text-xs font-semibold text-coral">{exercise.shortLabel}</p>
                ) : null}
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{cue}</p>
                <p className="mt-3 text-sm font-semibold text-coral">
                  {formatDose(exercise.defaultDose)}
                </p>
                <p className="mt-1 text-xs text-ink/45">Watch for: {exercise.commonMistake}</p>
                {swap ? (
                  <p className="mt-2 text-xs text-ink/45">Gentler swap: {swap.name}</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </article>
    </li>
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
