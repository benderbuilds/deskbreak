import { expect, test } from "@playwright/test";
import { getExercise, getPrograms } from "../src/lib/content";
import { emptySignal, emptySignals } from "../src/lib/personalization";
import {
  ALGORITHM_VERSION,
  adaptProgram,
  buildProgram,
  getRecommendedProgram,
  programFromStored,
  recommend,
  resolveProgram,
  swapCandidates,
  toStoredRecommendation,
  validateProgram,
} from "../src/lib/recommendation";
import {
  OFFERED_DURATIONS,
  PRIMARY_NEEDS,
  type FunctionalConstraint,
  type PrimaryNeed,
  type SetupRequest,
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
