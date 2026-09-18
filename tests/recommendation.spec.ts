import { expect, test } from "@playwright/test";
import { getExercise, getExercises, getExercisesById, getPrograms } from "../src/lib/content";
import { NEED_BY_ID, NEED_OPTIONS, TARGETED_OPTIONS } from "../src/lib/constants";
import { isHoldDose, MIN_STEP_SEC, scaleStepsToTarget, stepBounds } from "../src/lib/dose";
import { formatActiveDose, formatDose, resolveProgramSteps } from "../src/lib/format";
import {
  applyFeedbackToSignals,
  applySessionToSignals,
  emptySignal,
  emptySignals,
  signalsFromHistory,
} from "../src/lib/personalization";
import {
  ALGORITHM_VERSION,
  adaptProgram,
  areaAvoidanceNotice,
  buildProgram,
  canOpenRoutine,
  discomfortCandidates,
  discomfortReplacement,
  getRecommendedProgram,
  isExerciseEligible,
  isStaticHold,
  programFromStored,
  recommend,
  resolveProgram,
  safeFallbackProgram,
  swapCandidates,
  templateFor,
  toStoredRecommendation,
  validateProgram,
} from "../src/lib/recommendation";
import { excludedBySafety, SAFETY_FLAG_OPTIONS, safetyFlagLabel } from "../src/lib/safety";
import {
  OFFERED_DURATIONS,
  PRIMARY_NEEDS,
  SAFETY_FLAGS,
  TARGETED_NEEDS,
  type FunctionalConstraint,
  type PrimaryNeed,
  type Program,
  type SetupRequest,
  type WorkoutSession,
} from "../src/lib/types";

const SETUPS: SetupRequest[] = ["seated", "standing", "either"];

function learned(sessionCount = 5) {
  const signals = emptySignals();
  signals.sessionCount = sessionCount;
  return signals;
}

test.describe("recommendation engine v3", () => {
  test("a seated user is never handed a standing-only move", async () => {
    for (const need of PRIMARY_NEEDS) {
      for (const durationMinutes of OFFERED_DURATIONS) {
        const { program } = getRecommendedProgram({ need, setup: "seated", durationMinutes, pro: true, signals: learned() });
        for (const step of program.steps) {
          const exercise = getExercise(step.exerciseId);
          expect(exercise, `${need}: ${step.exerciseId} missing from catalog`).toBeTruthy();
          expect(exercise!.setup, `${need} seated routine contains standing-only ${exercise!.id}`).not.toBe("standing");
        }
      }
    }
  });

  test("free users only ever get free movements", async () => {
    for (const need of PRIMARY_NEEDS) {
      for (const setup of SETUPS) {
        for (const durationMinutes of [2, 3] as const) {
          const { program } = getRecommendedProgram({ need, setup, durationMinutes, signals: learned() });
          for (const step of program.steps) {
            expect(getExercise(step.exerciseId)!.access, `${need}/${setup} gave a free user ${step.exerciseId}`).toBe("free");
          }
        }
      }
    }
  });

  test("every generated routine passes validation and lands on its duration", async () => {
    for (const need of PRIMARY_NEEDS) {
      for (const setup of SETUPS) {
        for (const durationMinutes of OFFERED_DURATIONS) {
          for (const pro of [false, true]) {
            const context = { need, setup, durationMinutes, pro, signals: learned() };
            const program = buildProgram(context);
            const result = validateProgram(program, context);
            expect(result.ok, `${need}/${setup}/${durationMinutes}/${pro ? "pro" : "free"}: ${result.issues.join(",")}`).toBe(true);
            const total = program.steps.reduce((sum, step) => sum + step.durationSec, 0);
            expect(Math.abs(total - durationMinutes * 60)).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });

  test("the first resets use an authored, illustrated routine", async () => {
    const first = recommend({ need: "general", setup: "seated", durationMinutes: 3 });
    expect(first.authored).toBe(true);
    expect(first.program.generated).toBeFalsy();
    expect(first.algorithmVersion).toBe(ALGORITHM_VERSION);
    expect(first.id).toMatch(/^rec_/);
  });

  test("hard constraints override score", async () => {
    const constraints: FunctionalConstraint[] = ["overhead", "leave_chair"];
    const context = {
      need: "energy" as PrimaryNeed,
      setup: "either" as SetupRequest,
      durationMinutes: 3 as const,
      pro: true,
      constraints,
      signals: learned(),
    };
    const recommendation = recommend(context);
    for (const step of recommendation.program.steps) {
      const exercise = getExercise(step.exerciseId)!;
      expect(exercise.constraints.some((c) => constraints.includes(c)), `${exercise.id} violates a constraint`).toBe(false);
      expect(exercise.setup, `${exercise.id} needs the chair left`).not.toBe("standing");
    }
    expect(recommendation.validation.ok).toBe(true);
  });

  test("a move the user said doesn't feel right is never shown again", async () => {
    const signals = learned();
    signals.exercises["chin-tuck"] = { ...emptySignal(), discomfort: 1 };
    signals.exercises["seated-figure-4"] = { ...emptySignal(), swapped: 2 };
    for (const setup of SETUPS) {
      const program = buildProgram({ need: "general", setup, durationMinutes: 3, signals });
      const ids = program.steps.map((step) => step.exerciseId);
      expect(ids).not.toContain("chin-tuck");
      expect(ids).not.toContain("seated-figure-4");
    }
  });

  test("helpful moves rise and recent moves rotate out", async () => {
    const plain = buildProgram({ need: "neck_shoulders", setup: "seated", durationMinutes: 3, signals: learned() });
    const recent = plain.steps.map((step) => step.exerciseId);

    const rotated = emptySignals();
    rotated.sessionCount = 5;
    rotated.recentExerciseIds = recent;
    const second = buildProgram({ need: "neck_shoulders", setup: "seated", durationMinutes: 3, signals: rotated });
    const repeated = second.steps.filter((step) => recent.includes(step.exerciseId));
    expect(repeated.length).toBeLessThan(second.steps.length);

    const loved = learned();
    loved.exercises["unshrug"] = { ...emptySignal(), completed: 6, better: 6 };
    const favoured = buildProgram({ need: "neck_shoulders", setup: "seated", durationMinutes: 2, signals: loved });
    expect(favoured.steps.map((step) => step.exerciseId)).toContain("unshrug");
  });

  test("standing outcomes shift a mixed routine toward standing, with an explanation", async () => {
    const signals = learned(8);
    signals.setupOutcomes.standing = { better: 5, same: 0, worse: 0, rated: 5 };
    signals.setupOutcomes.seated = { better: 1, same: 2, worse: 1, rated: 4 };
    const recommendation = recommend({ need: "general", setup: "either", durationMinutes: 3, signals });
    const standing = recommendation.program.steps.filter((step) => getExercise(step.exerciseId)!.setup === "standing");
    expect(standing.length).toBeGreaterThan(0);
    expect(recommendation.personalized).toBe(true);
    expect(recommendation.reason).toMatch(/standing/i);
  });

  test("routines never bounce between sitting and standing", async () => {
    for (const need of PRIMARY_NEEDS) {
      for (const durationMinutes of OFFERED_DURATIONS) {
        const program = buildProgram({ need, setup: "either", durationMinutes, pro: true, signals: learned() });
        let transitions = 0;
        let last: boolean | null = null;
        for (const step of program.steps) {
          const standing = getExercise(step.exerciseId)!.setup === "standing";
          if (last !== null && standing !== last) transitions += 1;
          last = standing;
        }
        expect(transitions, `${need}/${durationMinutes}: ${program.steps.map((s) => s.exerciseId).join(", ")}`).toBeLessThanOrEqual(2);
      }
    }
  });

  test("the routine matches the need it was asked for", async () => {
    for (const need of PRIMARY_NEEDS.filter((entry) => entry !== "general")) {
      for (const setup of SETUPS) {
        const { program } = getRecommendedProgram({ need, setup, durationMinutes: 3, signals: learned() });
        const onTopic = program.steps.filter((step) => getExercise(step.exerciseId)!.needs.includes(need));
        expect(onTopic.length, `${need}/${setup}: only ${onTopic.length}/${program.steps.length} moves address it`).toBeGreaterThanOrEqual(
          Math.floor(program.steps.length * 0.4),
        );
      }
    }
  });

  test("the safer swap leads the alternatives", async () => {
    // A routine where the safer alternative is not already in use.
    const program = { ...buildProgram({ need: "back_hips", setup: "seated", durationMinutes: 3, signals: learned() }) };
    program.steps = [
      { exerciseId: "seated-cat-cow", durationSec: 60 },
      { exerciseId: "seated-figure-4", durationSec: 60 },
      { exerciseId: "long-exhale-reset", durationSec: 60 },
    ];
    const candidates = swapCandidates("seated-figure-4", program, { need: "back_hips", setup: "seated", durationMinutes: 3 });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].id).toBe(getExercise("seated-figure-4")!.saferSwapId);
    expect(candidates.map((c) => c.id)).not.toContain("seated-figure-4");
  });

  test("adapting an authored program to standing keeps it runnable", async () => {
    for (const program of getPrograms()) {
      const adapted = adaptProgram(program, { setup: "standing", pro: true });
      expect(adapted.steps.length).toBeGreaterThan(0);
      for (const step of adapted.steps) {
        const exercise = getExercise(step.exerciseId);
        expect(exercise, `${program.id} -> ${step.exerciseId}`).toBeTruthy();
        expect(exercise!.setup, `${program.id} standing version keeps seated-only ${exercise!.id}`).not.toBe("seated");
      }
    }
  });

  test("a stored recommendation resumes as exactly the same routine", async () => {
    const recommendation = recommend({ need: "energy", setup: "either", durationMinutes: 3, signals: learned() });
    const stored = toStoredRecommendation(recommendation, "client");
    const rebuilt = programFromStored(stored);
    expect(rebuilt).toBeTruthy();
    expect(rebuilt!.steps.map((s) => [s.exerciseId, s.durationSec])).toEqual(
      recommendation.program.steps.map((s) => [s.exerciseId, s.durationSec]),
    );
    const resolved = resolveProgram(stored.programId, "either", false, { stored });
    expect(resolved!.steps.map((s) => s.exerciseId)).toEqual(stored.exerciseIds);
  });

  test("generated program ids round-trip without a stored copy", async () => {
    const program = buildProgram({ need: "energy", setup: "standing", durationMinutes: 2 });
    const resolved = resolveProgram(program.id, "standing", false);
    expect(resolved).toBeTruthy();
    expect(resolved!.steps.map((step) => step.exerciseId)).toEqual(program.steps.map((step) => step.exerciseId));
  });

  test("a broken generated routine falls back to an authored one", async () => {
    // Every eligible move suppressed: generation cannot satisfy the template.
    const signals = learned();
    const recommendation = recommend({
      need: "wrists_hands",
      setup: "seated",
      durationMinutes: 3,
      constraints: ["weight_through_wrists", "overhead", "neck_rotation", "balance", "floor", "deep_knee_bend", "leave_chair"],
      signals,
    });
    expect(recommendation.program.steps.length).toBeGreaterThan(0);
    expect(recommendation.validation.ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Safety: PT review V3 (floor work, suppression on every path,
 * "Doesn't feel right", "Go easy on", doses, sequencing).
 * ------------------------------------------------------------------ */

const DURATIONS = [2, 3, 5, 10] as const;

function neckSession(index: number, now: Date, effect: "worse" | "better" = "worse"): WorkoutSession {
  const finished = new Date(now.getTime() - (index + 1) * 3 * 60 * 60 * 1000);
  const ids = ["chin-tuck", "shoulder-rolls", "seated-scap-squeeze", "unshrug", "neck-side-stretch", "long-exhale-reset"];
  return {
    sessionId: `neck-${index}`,
    programId: "neck-shoulder-reset-3min",
    programName: "3-Minute Neck + Shoulder Reset",
    primaryNeed: "neck_shoulders",
    setup: "seated",
    durationMin: 3,
    completedExerciseIds: ids,
    skippedExerciseIds: [],
    exercises: ids.map((exerciseId, sequence) => ({
      exerciseId,
      sequence,
      plannedSec: 30,
      actualSec: 30,
      completed: true,
      skipped: false,
      swapped: false,
      swappedToExerciseId: null,
      discomfortReported: false,
      discomfortReason: null,
    })),
    elapsedSec: 180,
    startedAt: new Date(finished.getTime() - 180_000).toISOString(),
    finishedAt: finished.toISOString(),
    perceivedEffect: effect,
    recommendationId: null,
    algorithmVersion: null,
    source: "targeted",
    plannedBreakId: null,
    generated: false,
  };
}

/** Signals exactly as the app builds them from a history. */
function signalsFor(history: WorkoutSession[], now: Date) {
  let exercises: Record<string, ReturnType<typeof emptySignal>> = {};
  for (const session of [...history].reverse()) {
    exercises = applySessionToSignals(exercises, session);
    if (session.perceivedEffect) exercises = applyFeedbackToSignals(exercises, session, session.perceivedEffect);
  }
  return signalsFromHistory(history, exercises, 60, now);
}

function ids(program: { steps: { exerciseId: string }[] }): string[] {
  return program.steps.map((step) => step.exerciseId);
}

test.describe("floor work is opt-in", () => {
  test("the glute bridge is a floor move and never appears in a desk routine by default", async () => {
    expect(getExercise("glute-bridge")!.setup).toBe("floor");
    for (const need of PRIMARY_NEEDS) {
      for (const setup of SETUPS) {
        for (const durationMinutes of DURATIONS) {
          const recommendation = recommend({ need, setup, durationMinutes, pro: true, signals: learned() });
          expect(ids(recommendation.program), `${need}/${setup}/${durationMinutes}`).not.toContain("glute-bridge");
          const alternatives = swapCandidates("seated-figure-4", recommendation.program, { need, setup, durationMinutes, pro: true }, 20);
          expect(alternatives.map((entry) => entry.id)).not.toContain("glute-bridge");
        }
      }
    }
  });

  test("opting in makes floor work eligible, but never in an Energy reset", async () => {
    expect(isExerciseEligible("glute-bridge", { need: "back_hips", setup: "either", durationMinutes: 10, pro: true })).toBe(false);
    expect(isExerciseEligible("glute-bridge", { need: "back_hips", setup: "either", durationMinutes: 10, pro: true, allowFloor: true })).toBe(true);
    for (const setup of SETUPS) {
      for (const durationMinutes of DURATIONS) {
        const program = buildProgram({ need: "energy", setup, durationMinutes, pro: true, allowFloor: true, signals: learned() });
        expect(ids(program)).not.toContain("glute-bridge");
      }
    }
  });

  test("energy resets hold no static stretches or seated stillness", async () => {
    for (const setup of SETUPS) {
      for (const durationMinutes of DURATIONS) {
        const program = buildProgram({ need: "energy", setup, durationMinutes, pro: true, signals: learned() });
        for (const id of ids(program)) {
          expect(isStaticHold(getExercise(id)!), `energy ${setup}/${durationMinutes} holds ${id}`).toBe(false);
        }
      }
    }
  });
});

test.describe("suppression holds on every path", () => {
  test("discomfort in the first session keeps the move out of the authored second session", async () => {
    const signals = learned(1);
    signals.exercises["chin-tuck"] = { ...emptySignal(), discomfort: 1 };
    for (const need of ["neck_shoulders", "general"] as const) {
      for (const setup of SETUPS) {
        const recommendation = recommend({ need, setup, durationMinutes: 3, signals });
        expect(recommendation.authored, `${need}/${setup} still uses an authored routine`).toBe(true);
        expect(ids(recommendation.program), `${need}/${setup}`).not.toContain("chin-tuck");
        expect(recommendation.validation.ok).toBe(true);
      }
    }
  });

  test("PT case 3: six 'Worse' neck sessions do not return the identical routine", async () => {
    const now = new Date("2026-09-18T15:00:00");
    const history = Array.from({ length: 6 }, (_, index) => neckSession(index, now));
    const signals = signalsFor(history, now);
    const before = history[0].completedExerciseIds;

    expect(signals.avoidAreas).toEqual(expect.arrayContaining(["neck", "shoulders"]));
    const seen = new Set<string>();
    for (const setup of SETUPS) {
      for (const pro of [false, true]) {
        const recommendation = recommend({ need: "neck_shoulders", setup, durationMinutes: 3, pro, signals, seed: "x" });
        const routine = ids(recommendation.program);
        seen.add(routine.join(","));
        expect(routine, `${setup}/${pro}`).not.toEqual(before);
        for (const id of routine) {
          const exercise = getExercise(id)!;
          expect(["neck", "shoulders"], `${setup}/${pro} kept ${id}`).not.toContain(exercise.bodyArea);
          // Every move that was rated worse six times is out.
          expect(before.filter((entry) => entry !== "long-exhale-reset"), `${setup}/${pro}`).not.toContain(id);
        }
        expect(recommendation.program.steps.length).toBeGreaterThan(0);
        expect(recommendation.reason).toMatch(/neck/);
        expect(recommendation.personalized).toBe(true);
      }
    }
    expect(areaAvoidanceNotice(signals)?.suggestClinician).toBe(true);
  });

  test("an area rated worse once is kept but de-prioritised; a week later it is back", async () => {
    const now = new Date("2026-09-18T15:00:00");
    const once = signalsFor([neckSession(0, now)], now);
    expect(once.avoidAreas).toEqual([]);
    expect(once.easeAreas).toEqual(expect.arrayContaining(["neck"]));

    const later = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const stale = signalsFor(Array.from({ length: 3 }, (_, index) => neckSession(index, now)), later);
    expect(stale.avoidAreas).toEqual([]);
  });

  test("'Painful' leaves that area alone for a week, on every path", async () => {
    const now = new Date("2026-09-18T15:00:00");
    const session = neckSession(0, now, "better");
    session.exercises[0] = { ...session.exercises[0], completed: false, swapped: true, swappedToExerciseId: "shoulder-rolls", discomfortReported: true, discomfortReason: "painful" };
    const signals = signalsFor([session], now);
    expect(signals.painfulAreas).toEqual(["neck"]);
    expect(signals.avoidAreas).toEqual(["neck"]);
    // Discomfort is attributed to the planned move, not its replacement.
    expect(signals.exercises["chin-tuck"].discomfort).toBe(1);
    expect(signals.exercises["shoulder-rolls"].discomfort).toBe(0);

    const context = { need: "neck_shoulders" as const, setup: "seated" as const, durationMinutes: 3 as const, signals };
    for (const program of [
      recommend(context).program,
      buildProgram(context),
      safeFallbackProgram(context),
      adaptProgram(getPrograms().find((entry) => entry.id === "neck-shoulder-reset-3min")!, context),
    ]) {
      for (const id of ids(program)) expect(getExercise(id)!.bodyArea, id).not.toBe("neck");
    }
    for (const alternative of swapCandidates("shoulder-rolls", buildProgram(context), context, 20)) {
      expect(alternative.bodyArea).not.toBe("neck");
    }
  });

  test("the safe fallback keeps exclusions even when generation fails", async () => {
    const signals = learned();
    signals.exercises["wrist-circles"] = { ...emptySignal(), discomfort: 1 };
    signals.recentExerciseIds = ["wrist-flexor-stretch", "wrist-extensor-stretch", "finger-fans", "shoulder-rolls", "seated-scap-squeeze", "unshrug"];
    const context = {
      need: "wrists_hands" as const,
      setup: "seated" as const,
      durationMinutes: 3 as const,
      constraints: ["weight_through_wrists", "overhead", "neck_rotation", "balance", "floor", "deep_knee_bend", "leave_chair"] as FunctionalConstraint[],
      signals,
    };
    const fallback = safeFallbackProgram(context);
    expect(ids(fallback)).not.toContain("wrist-circles");
    expect(ids(recommend(context).program)).not.toContain("wrist-circles");
  });

  test("a stored recommendation drops a move the person has since said hurts", async () => {
    const recommendation = recommend({ need: "general", setup: "seated", durationMinutes: 3, signals: learned() });
    const stored = toStoredRecommendation(recommendation, "client");
    const first = stored.exerciseIds[0];
    const signals = learned();
    signals.avoidAreas = [getExercise(first)!.bodyArea];
    const resolved = resolveProgram(stored.programId, "seated", false, { stored, signals })!;
    expect(ids(resolved)).not.toContain(first);
    const flagged = resolveProgram(stored.programId, "seated", false, { stored, safetyFlags: ["neck"] })!;
    for (const id of ids(flagged)) expect(flagged && getExercise(id)!.skipIf.includes("acute_neck_injury"), id).toBe(false);
  });
});

test.describe("Doesn't feel right", () => {
  test("the replacement rests the area, keeps the position and stays in the plan", async () => {
    for (const pro of [false, true]) {
      for (const setup of ["seated", "standing"] as const) {
        const context = { need: "general" as const, setup, durationMinutes: 3 as const, pro, signals: learned() };
        for (const exercise of getExercises()) {
          if ((!pro && exercise.access !== "free") || !isExerciseEligible(exercise.id, context)) continue;
          const program = { ...buildProgram(context), steps: [{ exerciseId: exercise.id, durationSec: 30 }] };
          const replacement = discomfortReplacement(exercise.id, program, context);
          expect(replacement, `${exercise.id} (${setup}, ${pro ? "pro" : "free"}) has no replacement`).toBeTruthy();
          const restsArea =
            replacement!.movementType === "breathing" ||
            (replacement!.bodyArea !== exercise.bodyArea && !replacement!.bodyAreas.includes(exercise.bodyArea));
          expect(restsArea, `${exercise.id} -> ${replacement!.id} works the same area`).toBe(true);
          expect(isExerciseEligible(replacement!.id, context), `${exercise.id} -> ${replacement!.id}`).toBe(true);
          if (setup === "seated") expect(replacement!.setup, `${exercise.id} -> ${replacement!.id}`).not.toBe("standing");
        }
      }
    }
  });

  test("chin tuck no longer swaps to the same motion", async () => {
    const context = { need: "neck_shoulders" as const, setup: "seated" as const, durationMinutes: 3 as const, pro: true };
    const program = { ...buildProgram(context), steps: [{ exerciseId: "chin-tuck", durationSec: 30 }] };
    const candidates = discomfortCandidates("chin-tuck", program, context).map((entry) => entry.id);
    expect(candidates).not.toContain("suboccipital-nod");
    expect(candidates).not.toContain("chin-tuck-hold");
    expect(candidates.some((id) => getExercise(id)!.movementType === "breathing")).toBe(true);
  });

  test("safer swaps stay free for free moves and never make a seated move stand", async () => {
    for (const exercise of getExercises()) {
      if (!exercise.saferSwapId) continue;
      const target = getExercise(exercise.saferSwapId)!;
      if (exercise.access === "free") expect(target.access, `${exercise.id} -> ${target.id}`).toBe("free");
      if (exercise.setup === "seated") expect(target.setup, `${exercise.id} -> ${target.id}`).not.toBe("standing");
    }
    expect(getExercise("chin-tuck")!.saferSwapId).toBeTruthy();
    expect(getExercise("seated-march")!.saferSwapId).not.toBe("ankle-circles");
  });
});

test.describe("Go easy on", () => {
  test("every flag has a label and rules something out", async () => {
    expect(SAFETY_FLAG_OPTIONS.map((option) => option.id).sort()).toEqual([...SAFETY_FLAGS].sort());
    for (const flag of SAFETY_FLAGS) {
      expect(safetyFlagLabel(flag).length).toBeGreaterThan(3);
      const excluded = getExercises().filter((exercise) => excludedBySafety(exercise, [flag]));
      expect(excluded.length, `${flag} excludes nothing`).toBeGreaterThan(0);
    }
    // The clinically specific ones.
    const out = (flag: (typeof SAFETY_FLAGS)[number]) =>
      getExercises().filter((exercise) => excludedBySafety(exercise, [flag])).map((exercise) => exercise.id);
    expect(out("osteoporosis")).toEqual(expect.arrayContaining(["thoracic-extension", "seated-cat-cow"]));
    expect(out("pregnancy")).toEqual(expect.arrayContaining(["glute-bridge", "seated-thoracic-rotation", "desk-plank-lean"]));
    expect(out("neck")).toEqual(expect.arrayContaining(["neck-side-stretch", "neck-rotation", "upper-trap-release"]));
    expect(out("arm_tingling")).toEqual(expect.arrayContaining(["neck-side-stretch", "wrist-flexor-stretch", "chest-opener"]));
    expect(out("knee_hip")).toEqual(expect.arrayContaining(["seated-figure-4", "sit-to-stand-glute"]));
    expect(out("wrist")).not.toContain("wrist-circles");
  });

  test("no routine, swap or replacement ever includes a move a flag rules out", async () => {
    for (const flag of SAFETY_FLAGS) {
      for (const need of PRIMARY_NEEDS) {
        for (const setup of SETUPS) {
          for (const durationMinutes of [2, 3, 5] as const) {
            for (const sessionCount of [0, 5]) {
              // Through signals.screening, the way the app passes it.
              const signals = learned(sessionCount);
              signals.screening = { safetyFlags: [flag], allowFloorWork: true };
              const context = { need, setup, durationMinutes, pro: true, signals };
              const recommendation = recommend(context);
              const label = `${flag}: ${need}/${setup}/${durationMinutes}/${sessionCount}`;
              expect(recommendation.program.steps.length, label).toBeGreaterThan(0);
              for (const id of ids(recommendation.program)) {
                expect(excludedBySafety(getExercise(id)!, [flag]), `${label} served ${id}`).toBe(false);
              }
              const first = recommendation.program.steps[0].exerciseId;
              for (const alternative of [
                ...swapCandidates(first, recommendation.program, context, 10),
                ...discomfortCandidates(first, recommendation.program, context, 10),
              ]) {
                expect(excludedBySafety(alternative, [flag]), `${label} offered ${alternative.id}`).toBe(false);
              }
            }
          }
        }
      }
    }
  });

  test("flags passed directly on the context work too", async () => {
    const program = buildProgram({ need: "neck_shoulders", setup: "seated", durationMinutes: 5, pro: true, safetyFlags: ["neck", "arm_tingling"], signals: learned() });
    for (const id of ids(program)) {
      expect(excludedBySafety(getExercise(id)!, ["neck", "arm_tingling"]), id).toBe(false);
    }
  });
});

test.describe("posture reset", () => {
  test("posture is a targeted need with its own label, templates and authored routines", async () => {
    expect(TARGETED_NEEDS).toContain("posture");
    expect(NEED_BY_ID.posture.label).toBe("Posture reset");
    expect(TARGETED_OPTIONS.map((option) => option.id)).toContain("posture");
    for (const durationMinutes of DURATIONS) {
      expect(templateFor("posture", durationMinutes).need).toBe("posture");
    }
    const first = recommend({ need: "posture", setup: "seated", durationMinutes: 3 });
    expect(first.authored).toBe(true);
    expect(first.program.primaryNeed).toBe("posture");
    const standing = recommend({ need: "posture", setup: "standing", durationMinutes: 3 });
    expect(standing.program.id).toBe("posture-reset-3min-standing");
  });

  test("nothing frames posture as something to fix or correct", async () => {
    // "There's no one correct posture" is the framing; "correct your posture" is not.
    const text = JSON.stringify([getExercises(), getPrograms(), NEED_OPTIONS]).toLowerCase();
    expect(text).not.toMatch(/(?<!one )(fix|correct|improve)(s|es|ing)? (your |my |bad |poor )?posture/);
    expect(text).not.toMatch(/posture (fix|correction)/);
    expect(text).not.toMatch(/stack ears over shoulders/);
  });
});

test.describe("doses fit the timer", () => {
  function allRoutines() {
    const routines: { label: string; program: Program }[] = [];
    for (const program of getPrograms()) {
      routines.push({ label: `authored ${program.id}`, program });
      for (const setup of SETUPS) {
        routines.push({ label: `authored ${program.id} as ${setup}`, program: adaptProgram(program, { setup, pro: true }) });
      }
    }
    for (const need of PRIMARY_NEEDS) {
      for (const setup of SETUPS) {
        for (const durationMinutes of DURATIONS) {
          for (const pro of [false, true]) {
            routines.push({
              label: `generated ${need}/${setup}/${durationMinutes}/${pro ? "pro" : "free"}`,
              program: recommend({ need, setup, durationMinutes, pro, signals: learned() }).program,
            });
          }
        }
      }
    }
    return routines;
  }

  test("every step runs at least its move's minimum, never below 20 s", async () => {
    for (const { label, program } of allRoutines()) {
      for (const step of resolveProgramSteps(program, getExercisesById())) {
        const min = step.exercise.minSec ?? MIN_STEP_SEC;
        expect(step.durationSec, `${label}: ${step.exercise.id}${step.side ? ` (${step.side})` : ""}`).toBeGreaterThanOrEqual(min);
        expect(min).toBeGreaterThanOrEqual(20);
      }
    }
    expect(getExercise("box-breathing")!.minSec).toBeGreaterThanOrEqual(30);
    expect(getExercise("long-exhale-reset")!.minSec).toBeGreaterThanOrEqual(30);
    expect(getExercise("short-walk")!.minSec).toBeGreaterThanOrEqual(45);
  });

  test("no routine opens on a static end-range stretch; the neck side stretch is never first", async () => {
    for (const { label, program } of allRoutines()) {
      const first = getExercise(program.steps[0].exerciseId)!;
      expect(canOpenRoutine(first), `${label} opens on ${first.id}`).toBe(true);
    }
    expect(canOpenRoutine(getExercise("neck-side-stretch")!)).toBe(false);
  });

  test("the neck side stretch runs 20 s each side, with the PT's cue", async () => {
    const stretch = getExercise("neck-side-stretch")!;
    expect(stretch.defaultDose).toMatchObject({ type: "holdSecEachSide", seconds: 20 });
    expect(stretch.cue).toBe(
      "Sit tall, hold the chair seat with your left hand. Tip your right ear toward your right shoulder until the left side of your neck feels long. Hand on head only if you want, resting, not pulling. Switch sides at the chime.",
    );
    const program = getPrograms().find((entry) => entry.id === "neck-shoulder-reset-3min")!;
    const sides = resolveProgramSteps(program, getExercisesById()).filter((step) => step.exercise.id === "neck-side-stretch");
    expect(sides.map((step) => step.side)).toEqual(["left", "right"]);
    for (const side of sides) expect(side.durationSec).toBeGreaterThanOrEqual(20);
  });

  test("a set of short holds is labelled as reps × seconds, never as one long hold", async () => {
    const squeeze = getExercise("seated-scap-squeeze")!;
    expect(formatActiveDose({ durationSec: 45, exercise: squeeze, dose: squeeze.defaultDose })).toBe("10 × 3 s");
    expect(formatActiveDose({ durationSec: 60, exercise: squeeze, dose: { type: "holdSecEachSide", seconds: 25 } })).toBe("10 × 3 s");
    expect(formatDose({ type: "repsHold", reps: 6, holdSec: 5 })).toBe("6 × 5 s");
    const hold = getExercise("desk-plank-lean")!;
    expect(formatActiveDose({ durationSec: 25, exercise: hold, dose: hold.defaultDose })).toBe("25s hold");
  });

  test("scaling pins short moves at their minimum and lands exactly on the target", async () => {
    const steps = [
      { exerciseId: "chin-tuck", durationSec: 30 },
      { exerciseId: "short-walk", durationSec: 20 },
      { exerciseId: "long-exhale-reset", durationSec: 10 },
    ];
    const scaled = scaleStepsToTarget(steps, 120, (step) => stepBounds(getExercise(step.exerciseId)));
    expect(scaled.reduce((sum, step) => sum + step.durationSec, 0)).toBe(120);
    expect(scaled[1].durationSec).toBeGreaterThanOrEqual(45);
    expect(scaled[2].durationSec).toBeGreaterThanOrEqual(30);
  });

  test("breath and walk doses match what the timer allows", async () => {
    expect(getExercise("box-breathing")!.defaultDose).toMatchObject({ breaths: 3 });
    expect(getExercise("box-breathing")!.cue).toMatch(/in .*4.*out .*6/i);
    expect(getExercise("box-breathing")!.cue).not.toMatch(/hold 4/i);
    expect(getExercise("ankle-pumps")!.defaultDose).toMatchObject({ reps: 15 });
    expect(isHoldDose(getExercise("standing-overhead-reach")!.defaultDose)).toBe(false);
  });
});

test.describe("standing users and the default reset", () => {
  test("a standing user gets the hand-authored standing routine, hip flexor included", async () => {
    const first = recommend({ need: "general", setup: "standing", durationMinutes: 3 });
    expect(first.program.id).toBe("desk-reset-3min-standing");
    expect(ids(first.program)).toContain("standing-hip-flexor");
  });

  test("the free seated default stands you up, and falls back to a march when you can't leave the chair", async () => {
    const either = recommend({ need: "general", setup: "either", durationMinutes: 3 });
    expect(either.program.id).toBe("desk-reset-3min");
    expect(ids(either.program)).toContain("sit-to-stand-glute");
    const stay = recommend({ need: "general", setup: "either", durationMinutes: 3, constraints: ["leave_chair"] });
    expect(ids(stay.program)).not.toContain("sit-to-stand-glute");
    expect(ids(stay.program)).toContain("seated-march");
  });
});

test.describe("retired exercise ids", () => {
  test("merged moves still resolve, in content, programs and history", async () => {
    expect(getExercise("walk-to-water-march")!.id).toBe("short-walk");
    expect(getExercise("short-foot-grip")!.id).toBe("foot-tripod-toe-spread");
    expect(getExercise("ankle-circles")!.id).toBe("ankle-pumps");
    expect(getExercises().map((exercise) => exercise.id)).not.toContain("walk-to-water-march");

    const old = {
      id: "old",
      access: "pro" as const,
      name: "Old",
      shortLabel: "Old",
      durationMin: 2 as const,
      tagline: "",
      primaryNeed: "energy" as const,
      setup: "standing" as const,
      steps: [
        { exerciseId: "walk-to-water-march", durationSec: 60 },
        { exerciseId: "short-foot-grip", durationSec: 60 },
      ],
    };
    expect(resolveProgramSteps(old, getExercisesById()).map((step) => step.exercise.id)).toEqual(["short-walk", "foot-tripod-toe-spread"]);

    const signals = applySessionToSignals({}, { ...neckSession(0, new Date()), exercises: [], completedExerciseIds: ["ankle-circles"] });
    expect(signals["ankle-pumps"]?.completed).toBe(1);
  });
});
