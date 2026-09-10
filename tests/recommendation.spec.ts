import { expect, test } from "@playwright/test";
import { getExercise, getPrograms } from "../src/lib/content";
import {
  adaptProgramToSetup,
  buildProgram,
  getRecommendedProgram,
  resolveProgram,
} from "../src/lib/recommendation";
import { PRIMARY_NEEDS, type PrimaryNeed, type SetupId } from "../src/lib/types";

const SETUPS: SetupId[] = ["seated", "standing"];

test.describe("recommendation engine", () => {
  test("a seated user is never handed a standing-only move", async () => {
    for (const need of PRIMARY_NEEDS) {
      const { program } = getRecommendedProgram({
        need,
        setup: "seated",
        durationMinutes: 2,
      });
      for (const step of program.steps) {
        const exercise = getExercise(step.exerciseId);
        expect(exercise, `${need}: ${step.exerciseId} missing from catalog`).toBeTruthy();
        expect(
          exercise!.setup,
          `${need} seated routine contains standing-only ${exercise!.id}`,
        ).not.toBe("standing");
      }
    }
  });

  test("back_hips + seated returns a usable seated routine", async () => {
    const { program } = getRecommendedProgram({
      need: "back_hips",
      setup: "seated",
      durationMinutes: 2,
    });
    expect(program.steps.length).toBeGreaterThanOrEqual(4);
    for (const step of program.steps) {
      expect(getExercise(step.exerciseId)!.setup).not.toBe("standing");
    }
  });

  test("free users only ever get free movements", async () => {
    for (const need of PRIMARY_NEEDS) {
      for (const setup of SETUPS) {
        const { program } = getRecommendedProgram({ need, setup, durationMinutes: 2 });
        for (const step of program.steps) {
          expect(
            getExercise(step.exerciseId)!.access,
            `${need}/${setup} gave a free user ${step.exerciseId}`,
          ).toBe("free");
        }
      }
    }
  });

  test("routines land within a few seconds of the advertised duration", async () => {
    for (const need of PRIMARY_NEEDS) {
      for (const setup of SETUPS) {
        const program = buildProgram({ need, setup, durationMinutes: 2 });
        const total = program.steps.reduce((sum, step) => sum + step.durationSec, 0);
        expect(Math.abs(total - 120), `${need}/${setup} ran ${total}s`).toBeLessThanOrEqual(2);
      }
    }
  });

  test("the routine matches the need it was asked for", async () => {
    for (const need of PRIMARY_NEEDS.filter((entry) => entry !== "general")) {
      for (const setup of SETUPS) {
        const { program } = getRecommendedProgram({ need, setup, durationMinutes: 2 });
        const onTopic = program.steps.filter((step) =>
          getExercise(step.exerciseId)!.needs.includes(need as PrimaryNeed),
        );
        expect(
          onTopic.length,
          `${need}/${setup}: only ${onTopic.length}/${program.steps.length} moves address it`,
        ).toBeGreaterThanOrEqual(Math.ceil(program.steps.length / 2));
      }
    }
  });

  test("recent moves are rotated out", async () => {
    const first = buildProgram({ need: "neck_shoulders", setup: "seated", durationMinutes: 2 });
    const recent = first.steps.map((step) => step.exerciseId);
    const second = buildProgram({
      need: "neck_shoulders",
      setup: "seated",
      durationMinutes: 2,
      recentExerciseIds: recent,
    });
    const repeated = second.steps.filter((step) => recent.includes(step.exerciseId));
    expect(repeated.length).toBeLessThan(second.steps.length);
  });

  test("adapting an authored program to standing keeps it runnable", async () => {
    for (const program of getPrograms()) {
      const adapted = adaptProgramToSetup(program, "standing");
      expect(adapted.steps.length).toBeGreaterThan(0);
      for (const step of adapted.steps) {
        const exercise = getExercise(step.exerciseId);
        expect(exercise, `${program.id} -> ${step.exerciseId}`).toBeTruthy();
        expect(
          exercise!.setup,
          `${program.id} standing version keeps seated-only ${exercise!.id}`,
        ).not.toBe("seated");
      }
    }
  });

  test("generated program ids round-trip", async () => {
    const program = buildProgram({
      need: "energy",
      setup: "standing",
      durationMinutes: 2,
    });
    const resolved = resolveProgram(program.id, "standing", false);
    expect(resolved).toBeTruthy();
    expect(resolved!.steps.map((step) => step.exerciseId)).toEqual(
      program.steps.map((step) => step.exerciseId),
    );
  });
});
