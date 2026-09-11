#!/usr/bin/env node
/**
 * Reports which catalog moves have no dedicated artwork.
 *
 * These fall back to the neutral Stretch pose at runtime, which is correct but
 * not ideal. This is the list to hand an illustrator.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const { exercises } = JSON.parse(
  readFileSync(join(root, "data", "exercises.json"), "utf8"),
);
const { programs } = JSON.parse(
  readFileSync(join(root, "data", "programs.json"), "utf8"),
);
const stems = new Set(
  readdirSync(join(root, "public", "character"))
    .filter((name) => name.endsWith(".svg"))
    .map((name) => name.slice(0, -4)),
);

const inFreePrograms = new Set(
  programs
    .filter((program) => program.access === "free")
    .flatMap((program) => program.steps.map((step) => step.exerciseId)),
);

const missing = [];
const noMotionFrame = [];
for (const exercise of exercises) {
  if (!stems.has(exercise.id) && !stems.has(`${exercise.id}-standing`)) {
    missing.push(exercise);
  } else if (!stems.has(`${exercise.id}-b`)) {
    noMotionFrame.push(exercise);
  }
}

const covered = exercises.length - missing.length;
console.log(`art coverage: ${covered}/${exercises.length} moves have dedicated art`);

if (missing.length) {
  console.log("\nno artwork (falls back to the neutral Stretch pose):");
  for (const exercise of missing) {
    const flag = inFreePrograms.has(exercise.id) ? "  <-- in a FREE program" : "";
    console.log(`  ${exercise.id} [${exercise.access}] ${exercise.name}${flag}`);
  }
}

if (noMotionFrame.length) {
  console.log("\nsingle frame only (no -b motion frame):");
  for (const exercise of noMotionFrame) {
    console.log(`  ${exercise.id}`);
  }
}

const freeGaps = missing.filter((exercise) => inFreePrograms.has(exercise.id));
if (freeGaps.length) {
  console.error(
    `\n${freeGaps.length} move(s) in free programs have no artwork. Free is the product's proof; these should be drawn first.`,
  );
  process.exitCode = 1;
}
