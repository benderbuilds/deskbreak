import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { getExercises, getPrograms } from "../src/lib/content";
import sharp from "sharp";
import manifest from "../data/art-manifest.json";
import {
  demonstrationAlt,
  illustrationBackup,
  resolveExerciseArt,
  resolvePoseArt,
} from "../src/lib/character-art";
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
        const art = resolveExerciseArt(
          step.exerciseId,
          program.setup === "either" ? "seated" : program.setup,
        );
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
      const stem = art.start.replace("/character/", "").replace(/\.(svg|webp)$/, "");
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
      // The player treats a loaded image with no width as broken; keep SVGs sized.
      expect(contents, `${file} has no intrinsic width`).toMatch(/<svg[^>]*\swidth="512"/);
      expect(contents, `${file} has no accessible label`).toContain("aria-label=");
    }
  });

  test("the manifest matches what is on disk, per format", async () => {
    const names = readdirSync(ART_DIR);
    const stems = (ext: string) =>
      names.filter((name) => name.endsWith(ext)).map((name) => name.slice(0, -ext.length)).sort();
    expect(manifest.svg, "run npm run art:manifest").toEqual(stems(".svg"));
    expect(manifest.webp, "run npm run art:manifest").toEqual(stems(".webp"));
    expect(manifest.files).toEqual([...new Set([...manifest.svg, ...manifest.webp])].sort());
  });

  test("a move never mixes a photo frame with an illustrated frame", async () => {
    for (const exercise of getExercises()) {
      for (const setup of SETUPS) {
        const art = resolveExerciseArt(exercise.id, setup);
        const frames = [art.start, art.end].filter((frame): frame is string => Boolean(frame));
        const photos = frames.filter((frame) => frame.endsWith(".webp"));
        expect(photos.length === 0 || photos.length === frames.length, `${exercise.id} (${setup})`).toBe(true);
        expect(art.isPhoto, `${exercise.id} (${setup})`).toBe(photos.length > 0);
      }
    }
  });

  test("every photo frame is square, sharp enough for a phone, light, and matches its pair", async () => {
    const files = readdirSync(ART_DIR).filter((name) => name.endsWith(".webp"));
    for (const file of files) {
      const meta = await sharp(join(ART_DIR, file)).metadata();
      expect(meta.format, file).toBe("webp");
      expect(meta.width, `${file} is not square`).toBe(meta.height);
      // The player stage tops out near 300 CSS px; below 480 it blurs on a phone.
      expect(meta.width ?? 0, `${file} is too small`).toBeGreaterThanOrEqual(480);
      expect(meta.size ?? readFileSync(join(ART_DIR, file)).length, `${file} is too heavy`).toBeLessThan(200 * 1024);

      const stem = file.slice(0, -".webp".length);
      if (stem.endsWith("-b")) {
        const startFile = `${stem.slice(0, -2)}.webp`;
        expect(files, `${file} has no start frame`).toContain(startFile);
        const start = await sharp(join(ART_DIR, startFile)).metadata();
        // Same crop for both frames: the camera must not move mid-movement.
        expect([meta.width, meta.height], `${file} vs ${startFile}`).toEqual([start.width, start.height]);
      }
    }
  });

  test("a photo that fails falls back to the illustration it replaced", async () => {
    for (const stem of manifest.webp) {
      const backup = illustrationBackup(`/character/${stem}.webp`);
      if (manifest.svg.includes(stem)) {
        expect(backup).toBe(`/character/${stem}.svg`);
        expect(publicPathExists(backup!)).toBe(true);
      } else {
        expect(backup).toBeNull();
      }
    }
    expect(illustrationBackup("/character/calf-raise.svg")).toBeNull();
  });

  test("seated cat-cow uses the instructor photos, labelled as a person, not Stretch", async () => {
    const art = resolveExerciseArt("seated-cat-cow", "seated");
    expect(art).toMatchObject({
      start: "/character/seated-cat-cow.webp",
      end: "/character/seated-cat-cow-b.webp",
      isPhoto: true,
      isFallback: false,
    });
    expect(demonstrationAlt("seated-cat-cow", "Seated cat-cow")).toBe("Instructor demonstrating Seated cat-cow");
    expect(demonstrationAlt("calf-raise", "Calf raise")).toBe("Stretch demonstrating Calf raise");
  });
});
