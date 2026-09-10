import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { getExercises, getPrograms } from "../src/lib/content";
import { resolveExerciseArt, resolvePoseArt } from "../src/lib/character-art";
import type { SetupId } from "../src/lib/types";

const ART_DIR = join(process.cwd(), "public", "character");
const SETUPS: SetupId[] = ["seated", "standing"];

function publicPathExists(url: string): boolean {
  return existsSync(join(process.cwd(), "public", url.replace(/^\//, "")));
}

test.describe("exercise art", () => {
  test("every program move resolves to a file that exists", async () => {
    for (const program of getPrograms()) {
      for (const step of program.steps) {
        for (const setup of SETUPS) {
          const art = resolveExerciseArt(step.exerciseId, setup);
          expect(
            publicPathExists(art.start),
            `${program.id}/${step.exerciseId} (${setup}) -> missing ${art.start}`,
          ).toBe(true);
          if (art.end) {
            expect(
              publicPathExists(art.end),
              `${program.id}/${step.exerciseId} (${setup}) -> missing ${art.end}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  test("every catalog exercise resolves to real art or the neutral fallback", async () => {
    for (const exercise of getExercises()) {
      for (const setup of SETUPS) {
        const art = resolveExerciseArt(exercise.id, setup);
        expect(publicPathExists(art.start), `${exercise.id}: ${art.start}`).toBe(true);
        if (art.isFallback) {
          expect(art.start).toBe("/character/stretch-fallback.svg");
        }
      }
    }
  });

  test("free routines all ship dedicated art, never the fallback", async () => {
    // Free is the product's proof. A generic blob there costs conversions.
    for (const program of getPrograms().filter((entry) => entry.access === "free")) {
      for (const step of program.steps) {
        const art = resolveExerciseArt(step.exerciseId, program.setup);
        expect(
          art.isFallback,
          `free program ${program.id} falls back for ${step.exerciseId}`,
        ).toBe(false);
      }
    }
  });

  test("art never borrows another exercise's pose", async () => {
    for (const exercise of getExercises()) {
      const art = resolveExerciseArt(exercise.id, "seated");
      if (art.isFallback) continue;
      const stem = art.start.replace("/character/", "").replace(".svg", "");
      expect(
        stem === exercise.id || stem === `${exercise.id}-standing`,
        `${exercise.id} resolved to unrelated art ${stem}`,
      ).toBe(true);
    }
  });

  test("every pose has a file", async () => {
    for (const pose of ["idle", "ready", "done", "locked", "fallback"] as const) {
      for (const setup of SETUPS) {
        expect(publicPathExists(resolvePoseArt(pose, setup)), pose).toBe(true);
      }
    }
  });

  test("every SVG is well-formed and on-brand", async () => {
    const files = readdirSync(ART_DIR).filter((name) => name.endsWith(".svg"));
    expect(files.length).toBeGreaterThan(40);

    for (const file of files) {
      const contents = readFileSync(join(ART_DIR, file), "utf8");
      // A raw control character silently breaks the SVG in strict parsers.
      expect(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(contents), `${file} has a control character`).toBe(
        false,
      );
      expect(contents, `${file} is missing a viewBox`).toContain('viewBox="0 0 512 512"');
      expect(contents, `${file} has no accessible label`).toContain("aria-label=");
    }
  });
});
