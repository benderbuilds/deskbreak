#!/usr/bin/env node
/**
 * Audits exercise artwork for every catalog move, free and Pro.
 *
 * A move without art renders the neutral "follow the written steps" card,
 * which shows no body. That is acceptable for simple moves the text fully
 * describes, and never acceptable for:
 *   - a move in a FREE program (free is the product's proof), or
 *   - a move with a specific pose (strength and isometric holds, floor,
 *     balance, weight-bearing or neck-rotation moves, standing stretches),
 *     where a picture is what stops someone copying the wrong position.
 *
 * Specific-pose moves already waiting on an illustrator are listed in
 * PENDING_ART. Anything else that falls back fails the audit, so a new move
 * can't ship without art.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const { exercises } = JSON.parse(readFileSync(join(root, "data", "exercises.json"), "utf8"));
const { programs } = JSON.parse(readFileSync(join(root, "data", "programs.json"), "utf8"));
const stems = new Set(JSON.parse(readFileSync(join(root, "data", "art-manifest.json"), "utf8")).files);

/**
 * Specific-pose Pro moves known to need art, in the PT review's priority
 * order. Remove an entry once its SVG lands. Do not add to this list to get a
 * new move past the audit: draw it, or keep it out of the catalog.
 */
const PENDING_ART = new Set([
  "glute-bridge",
  "standing-hip-hinge-desk",
  "hamstring-hinge",
  "standing-quad-stretch",
  "desk-plank-lean",
  "neck-rotation",
  "chin-tuck-hold",
  "scap-pack-hold",
  "short-foot-grip",
]);

const POSE_CONSTRAINTS = new Set(["floor", "balance", "weight_through_wrists", "neck_rotation"]);

function hasSpecificPose(exercise) {
  return (
    exercise.movementType === "strength" ||
    exercise.movementType === "isometric" ||
    (exercise.setup === "standing" && exercise.movementType === "mobility") ||
    (exercise.constraints ?? []).some((constraint) => POSE_CONSTRAINTS.has(constraint))
  );
}

const programsByMove = new Map();
for (const program of programs) {
  for (const step of program.steps) {
    const list = programsByMove.get(step.exerciseId) ?? new Set();
    list.add(program);
    programsByMove.set(step.exerciseId, list);
  }
}
const inFreeProgram = (id) => [...(programsByMove.get(id) ?? [])].some((program) => program.access === "free");

const missing = [];
const noMotionFrame = [];
for (const exercise of exercises) {
  if (!stems.has(exercise.id) && !stems.has(`${exercise.id}-standing`)) {
    missing.push(exercise);
  } else if (!stems.has(`${exercise.id}-b`) && !stems.has(`${exercise.id}-standing-b`)) {
    noMotionFrame.push(exercise);
  }
}

const count = (access) => exercises.filter((exercise) => exercise.access === access).length;
const missingCount = (access) => missing.filter((exercise) => exercise.access === access).length;
console.log(`art coverage: ${exercises.length - missing.length}/${exercises.length} moves have dedicated art`);
console.log(`  free: ${count("free") - missingCount("free")}/${count("free")}`);
console.log(`  pro:  ${count("pro") - missingCount("pro")}/${count("pro")}`);

const failures = [];
if (missing.length) {
  console.log('\nno artwork (renders the "follow the written steps" card):');
  for (const exercise of missing) {
    const notes = [];
    const specific = hasSpecificPose(exercise);
    if (specific) notes.push("specific pose");
    if (PENDING_ART.has(exercise.id)) notes.push("pending art");
    const used = [...(programsByMove.get(exercise.id) ?? [])].map((program) => program.id);
    if (used.length) notes.push(`in ${used.join(", ")}`);
    console.log(`  ${exercise.id} [${exercise.access}] ${exercise.name}${notes.length ? `  (${notes.join("; ")})` : ""}`);

    if (inFreeProgram(exercise.id)) {
      failures.push(`${exercise.id} is in a FREE program with no artwork. Free is the product's proof; draw it first.`);
    } else if (specific && !PENDING_ART.has(exercise.id)) {
      failures.push(`${exercise.id} has a specific pose and would fall back to the text card. Add its artwork.`);
    }
  }
}

const stale = [...PENDING_ART].filter((id) => {
  const exercise = exercises.find((entry) => entry.id === id);
  return !exercise || !missing.includes(exercise);
});
if (stale.length) {
  console.log(`\nPENDING_ART entries that now have art or left the catalog (remove them): ${stale.join(", ")}`);
}

if (noMotionFrame.length) {
  console.log("\nsingle frame only (no -b motion frame):");
  for (const exercise of noMotionFrame) console.log(`  ${exercise.id}`);
}

if (failures.length) {
  console.error(`\n${failures.length} art failure(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
}
