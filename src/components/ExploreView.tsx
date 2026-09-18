"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { EmptyState } from "@/components/StatusStates";
import { track } from "@/lib/analytics";
import { areaLine, BODY_AREA_LABELS } from "@/lib/body-areas";
import { NEED_BY_ID } from "@/lib/constants";
import { getExercise, getExercises, getPrograms } from "@/lib/content";
import { isExerciseLocked, isProEntitlement, isProgramLocked } from "@/lib/entitlements";
import { formatDose } from "@/lib/format";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import { useRecommendation } from "@/lib/use-recommendation";
import { workoutHref } from "@/lib/recommend-client";
import type { BodyArea, Exercise, PrimaryNeed, Program } from "@/lib/types";

const AREA_GROUPS: { id: string; label: string; need: PrimaryNeed; areas: BodyArea[] }[] = [
  { id: "neck", label: "Neck + shoulders", need: "neck_shoulders", areas: ["neck", "shoulders", "upperBack"] },
  { id: "back", label: "Back + hips", need: "back_hips", areas: ["upperBack", "core", "hips"] },
  { id: "wrists", label: "Wrists + hands", need: "wrists_hands", areas: ["wrists"] },
  // Posture here means changing position and opening the upper back, never "correcting" it.
  { id: "posture", label: "Posture reset", need: "posture", areas: ["upperBack", "shoulders"] },
  { id: "full", label: "Full body", need: "general", areas: [] },
];

const GOALS: { id: PrimaryNeed | "mobility" | "strength"; label: string }[] = [
  { id: "energy", label: "Energy" },
  { id: "mobility", label: "Mobility" },
  { id: "strength", label: "Strength" },
  { id: "stress", label: "Stress reset" },
];

const TIMES = [2, 3, 5, 10] as const;

/**
 * Explore is for discovery, never a required step.
 *
 * Recommended first, then body area, goal, time, individual movements and
 * favourites. Every card either runs a routine or opens a movement.
 */
export function ExploreView() {
  const router = useRouter();
  const isClient = useIsClient();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<BodyArea | "all">("all");

  const recommended = useRecommendation(
    { need: state.primaryNeed && state.primaryNeed !== "general" ? state.primaryNeed : "general", durationMinutes: state.preferredDuration ?? 3, setup: state.preferredSetup ?? "either" },
    { enabled: isClient, source: "explore", historyVersion: state.progress.totalWorkouts },
  );

  const programs = useMemo(
    () => getPrograms().filter((program) => program.durationMin >= 2),
    [],
  );
  const exercises = useMemo(() => getExercises(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((exercise) => {
      if (area !== "all" && !exercise.bodyAreas.includes(area)) return false;
      if (!q) return true;
      return (
        exercise.name.toLowerCase().includes(q) ||
        exercise.cue.toLowerCase().includes(q) ||
        exercise.bodyAreas.some((entry) => BODY_AREA_LABELS[entry].toLowerCase().includes(q))
      );
    });
  }, [exercises, area, query]);

  const favorites = useMemo(
    () => state.favorites.map((id) => getExercise(id)).filter((entry): entry is Exercise => Boolean(entry)),
    [state.favorites],
  );

  if (!isClient) return null;

  function startProgram(program: Program, source: string) {
    if (isProgramLocked(program, state.entitlement)) {
      track("locked_program_clicked", { program_id: program.id, need: program.primaryNeed, source });
      router.push(`/app/pro?from=${source}&program=${program.id}&need=${program.primaryNeed}`);
      return;
    }
    router.push(`/app/start?program=${program.id}&source=explore`);
  }

  function startGenerated(need: PrimaryNeed, minutes: (typeof TIMES)[number]) {
    router.push(`/app/start?need=${need}&minutes=${minutes}&source=explore`);
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] lg:px-0">
      <h1 className="font-display font-extrabold text-[2rem] leading-tight text-ink">Explore</h1>

      {recommended ? (
        <section className="mt-5" aria-labelledby="recommended">
          <h2 id="recommended" className="font-display text-xl font-extrabold text-ink">
            Recommended for you
          </h2>
          <button
            type="button"
            onClick={() => router.push(workoutHref(recommended, { source: "explore" }))}
            className="surface-elevated mt-2 flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:border-ink"
          >
            <CharacterArt pose="ready" size={64} alt="" />
            <span className="min-w-0">
              <span className="block font-display font-extrabold text-lg text-ink">{recommended.programName}</span>
              <span className="block text-sm text-muted">
                {recommended.recommendedDuration} min · {areaLine(recommended.exerciseIds.flatMap((id) => getExercise(id)?.bodyAreas ?? []))}
              </span>
            </span>
          </button>
        </section>
      ) : null}

      <section className="mt-7" aria-labelledby="by-area">
        <h2 id="by-area" className="font-display text-xl font-extrabold text-ink">
          By body area
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {AREA_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => startGenerated(group.need, (state.preferredDuration as 2 | 3 | 5 | 10 | null) ?? 3)}
              className={[
                "min-h-14 rounded-control border border-line-strong bg-sheet px-4 text-left text-sm font-semibold text-ink transition-colors hover:border-ink",
                AREA_GROUPS.length % 2 && group.id === "full" ? "col-span-2" : "",
              ].join(" ")}
            >
              {group.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7" aria-labelledby="by-goal">
        <h2 id="by-goal" className="font-display text-xl font-extrabold text-ink">
          By goal
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {GOALS.map((goal) => {
            const need: PrimaryNeed = goal.id === "mobility" ? "back_hips" : goal.id === "strength" ? "energy" : goal.id;
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => startGenerated(need, 3)}
                className="min-h-14 rounded-control border border-line-strong bg-sheet px-4 text-left text-sm font-semibold text-ink transition-colors hover:border-ink"
              >
                {goal.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-7" aria-labelledby="by-time">
        <h2 id="by-time" className="font-display text-xl font-extrabold text-ink">
          By time
        </h2>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {TIMES.map((minutes) => {
            const locked = !pro && minutes > 3;
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => {
                  if (locked) {
                    track("locked_program_clicked", { duration: minutes, source: "explore_time" });
                    router.push(`/app/pro?from=explore_time&minutes=${minutes}`);
                    return;
                  }
                  startGenerated("general", minutes);
                }}
                className="flex min-h-14 flex-col items-center justify-center rounded-control border border-line-strong bg-sheet px-2 text-sm font-semibold text-ink transition-colors hover:border-ink"
              >
                {minutes} min
                {locked ? <span className="text-xs font-semibold text-muted">Pro</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-7" aria-labelledby="routines">
        <h2 id="routines" className="font-display text-xl font-extrabold text-ink">
          Routines
        </h2>
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card border border-line bg-sheet">
          {programs.map((program) => {
            const locked = isProgramLocked(program, state.entitlement);
            return (
              <li key={program.id}>
                <button
                  type="button"
                  onClick={() => startProgram(program, "explore_routine")}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-paper"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{program.name}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {program.durationMin} min · {NEED_BY_ID[program.primaryNeed].label}
                    </span>
                  </span>
                  <span
                    className={[
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                      locked ? "bg-ink text-paper" : "text-muted",
                    ].join(" ")}
                  >
                    {locked ? "Pro" : "Free"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {favorites.length ? (
        <section className="mt-7" aria-labelledby="favorites">
          <h2 id="favorites" className="font-display text-xl font-extrabold text-ink">
            Favorites
          </h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card border border-line bg-sheet">
            {favorites.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} locked={isExerciseLocked(exercise, state.entitlement)} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-7" aria-labelledby="movements">
        <h2 id="movements" className="font-display text-xl font-extrabold text-ink">
          Individual movements
        </h2>
        <label htmlFor="explore-search" className="sr-only">
          Search movements
        </label>
        <input
          id="explore-search"
          type="search"
          placeholder="Search movements"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-[14px] border border-line-strong bg-white px-4 text-base text-ink"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="All" active={area === "all"} onClick={() => setArea("all")} />
          {(["neck", "shoulders", "upperBack", "wrists", "hips", "legs", "core", "breathing", "eyes"] as BodyArea[]).map((id) => (
            <Chip key={id} label={BODY_AREA_LABELS[id]} active={area === id} onClick={() => setArea(id)} />
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Nothing matches" body="Try another word, or clear the filter." />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-sheet">
            {filtered.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} locked={isExerciseLocked(exercise, state.entitlement)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ExerciseCard({ exercise, locked }: { exercise: Exercise; locked: boolean }) {
  return (
    <li>
      <Link
        href={`/app/explore/move/${exercise.id}`}
        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-paper"
      >
        <CharacterArt pose={locked ? "locked" : "exercise"} exerciseId={locked ? undefined : exercise.id} size={56} alt="" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{exercise.name}</span>
          <span className="mt-0.5 block text-sm text-muted">
            {BODY_AREA_LABELS[exercise.bodyArea]} · {formatDose(exercise.defaultDose)}
          </span>
        </span>
        {locked ? (
          <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-paper">
            Pro
          </span>
        ) : null}
      </Link>
    </li>
  );
}
