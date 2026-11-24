#!/usr/bin/env node
/**
 * Builds the instructor photo shot list from data/exercises.json.
 *
 *   node scripts/art-shot-list.mjs
 *
 * Writes design/instructor/shot-list.json (for whatever generates the frames)
 * and docs/art/instructor-shot-list.md (for people). Rerun it after a move is
 * added or its cue changes; DIRECTION below must cover every move or it fails.
 *
 * Camera angle comes from the move, not taste: the plane in which its "avoid"
 * fault shows up decides it. A sagging hip or rounded back only reads from the
 * side; a shrug, tilt, knee cave or twist only reads from the front.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const { exercises } = JSON.parse(readFileSync(join(root, "data", "exercises.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(root, "data", "art-manifest.json"), "utf8"));
const webp = new Set(manifest.webp);
const svg = new Set(manifest.svg);

export const PILOT = ["seated-cat-cow", "calf-raise", "wrist-circles", "desk-plank-lean", "glute-bridge"];

const INSTRUCTOR =
  "the same woman in every frame: mid-30s, warm olive skin with light freckles, dark brown curly shoulder-length hair tied in a low loose ponytail with a few loose curls at the face, " +
  "fitted navy ribbed short-sleeve crew-neck tee, stone-beige tapered cotton chinos at ankle length, rust-orange crew socks, off-white low-top leather sneakers; calm, friendly expression; no jewellery, no logos";

const SETTING = {
  seated:
    "a light oak chair with a slatted curved back, fixed legs, no wheels, set on a natural jute rug over a pale concrete floor; warm cream plaster wall; behind her a slim oak console desk with stacked books, a pencil cup and a framed muted landscape print; trailing pothos from above right; a potted olive tree on the left edge",
  standing:
    "standing beside a sturdy solid oak desk at hip height (fixed legs, no casters) on a natural jute rug over a pale concrete floor; warm cream plaster wall; a pencil cup and stacked books on the desk; trailing pothos above right; a potted olive tree on the left edge",
  desk:
    "seated at a light oak desk, forearms on the desk; warm cream plaster wall behind, softly out of focus; a pencil cup and stacked books at the edge of frame",
  floor:
    "lying on a thin sage exercise mat laid on a natural jute rug over a pale concrete floor, the oak chair and slim oak desk visible behind her; warm cream plaster wall; trailing pothos above right",
};

const LIGHT =
  "soft warm daylight from a window at camera left, gentle dappled leaf shadows on the wall, low contrast, natural colour, photographic realism, 50mm lens look, eye-level unless stated";

const FRAMING = {
  close: "tight framing on the moving part so it reads at phone size",
  medium: "framed from mid-thigh up (seated: from the seat up) so the trunk and arms fill the frame",
  full: "full body in frame head to feet with a small margin, feet fully visible",
};

const NEGATIVE =
  "no text, no letters, no captions, no labels, no arrows, no watermark, no logo, no split panels, no grid, no collage, single photograph, no extra people, no mirror reflections, same clothes and hair as the reference";

/**
 * Per-move direction: [angle, framing, start pose, end pose, why this angle].
 * Angles: side (camera at 90 degrees, instructor facing frame right), front,
 * three-quarter (45 degrees from front, toward her right), overhead-three-quarter.
 */
const DIRECTION = {
  // --- pilot five ---------------------------------------------------------
  "seated-cat-cow": ["side", "full", "seated tall, hands on thighs, breathing out with the mid-back rounded, chin tucked slightly, eyes down toward her knees (cat)", "seated, chest lifted and spine lengthened, a small arch through the mid-back, eyes forward and level, shoulders soft (cow)", "Flexion and extension happen in the sagittal plane; only a side view shows the spine round and lift. The avoid (forcing end range) is judged by the curve of the back, so both frames stay at a moderate range."],
  "calf-raise": ["three-quarter, camera at knee height", "full", "standing tall facing the desk, fingertips resting lightly on the desk edge, feet hip-width, heels down", "same stance, risen onto the balls of both feet, heels clearly lifted about 5 cm, knees straight but not locked, body tall", "Front view hides the heel lift; pure side hides that both feet rise together. Three-quarter at knee height shows both heels and the desk hold. Full body so the feet are never cropped. The avoid (bouncing) is a tempo fault the player cue covers, not the picture."],
  "wrist-circles": ["front", "close", "seated at the desk, forearms resting on the desk edge, both hands in loose fists, wrists bent up (top of the circle)", "same, both wrists bent down and out to the side (bottom of the circle), fists still loose, forearms still on the desk", "Circles happen in front of the body, so a front view at desk height shows the path. Framed on forearms and hands only (shoulder edge in frame) so a 56 px thumbnail still reads. One shot serves seated and standing: the setup is invisible at this framing."],
  "desk-plank-lean": ["side", "full", "standing upright close to the desk, hands on the desk edge shoulder-width, arms straight", "walked feet back into a straight line from head to heels, hands on the desk edge, arms straight under the shoulders, hips level with the line (not sagging, not piked), shoulders away from the ears", "The avoid (sagging hips) is only visible as a broken head-to-heel line from the side. Full body so heels and head are both in frame. The desk must read as solid and fixed: oak legs, no casters, per the cue."],
  "glute-bridge": ["side, camera at mat height", "full", "lying on her back on the mat, knees bent about 90 degrees, feet flat hip-width, arms long by her sides palms down, head resting", "hips lifted so shoulders, hips and knees form one straight line, ribs down, head and shoulders still on the mat; not arched past the line", "The line from shoulders to knees is the whole cue and only reads in profile. Camera low (mat height) and level so the hip lift is not foreshortened. Floor setting, because this move is only offered to people who opted in to floor work."],

  // --- neck ---------------------------------------------------------------
  "chin-tuck": ["side", "close", "seated tall, head and shoulders in profile, eyes level, chin in its natural position", "chin glided straight back into a soft double chin, eyes still level, nose not tipped down", "The fault (nodding instead of gliding) is a sagittal movement; profile shows the glide."],
  "chin-tuck-hold": ["side", "close", "seated tall, head and shoulders in profile, eyes level", "chin glided straight back and held, eyes level", "Same plane as chin tuck; the hold is the end frame."],
  "suboccipital-nod": ["side", "close", "seated, fingertips resting at the base of the skull, eyes level", "tiny yes-nod with the chin slightly in, fingertips still resting, no big chin-to-chest", "A small nod is only visible in profile; close framing keeps it readable."],
  "neck-side-stretch": ["front", "medium", "seated tall, left hand holding the chair seat edge, head level", "right ear tipped toward the right shoulder, chin still facing forward, left shoulder down", "The fault (turning the chin as you tip) shows from the front."],
  "neck-rotation": ["front", "close", "seated tall, head facing camera", "head turned to look over her right shoulder, chin level", "Rotation reads from the front; overhead would hide the face."],
  "upper-trap-release": ["front", "medium", "seated tall, left hand holding the chair seat, head level", "right ear toward the right shoulder, nose turned slightly down toward the right armpit, left shoulder relaxed down", "The fault (shrugging the stretching shoulder) shows from the front."],

  // --- shoulders and upper back -------------------------------------------
  "shoulder-rolls": ["side", "medium", "seated tall, shoulders lifted toward the ears", "shoulders rolled back and dropped down, chest open, neck long", "The backward roll is a sagittal arc; profile shows lift, back, drop."],
  "unshrug": ["front", "medium", "seated, shoulders lifted toward the ears, face relaxed", "shoulders dropped and slid down away from the ears, breathing out", "Shoulder height is a frontal-plane cue."],
  "seated-scap-squeeze": ["three-quarter", "medium", "seated tall, arms relaxed by her sides", "shoulder blades drawn together and slightly down, chest open, shoulders not shrugged", "Shrugging shows from the front, the squeeze from behind; three-quarter rear shows both."],
  "scap-pack-hold": ["three-quarter", "medium", "seated tall, arms relaxed", "shoulder blades drawn slightly together and down, held, shoulders level", "As above: three-quarter rear shows the blades and the shoulder height."],
  "chest-opener": ["three-quarter", "full", "standing beside a doorway frame, right forearm on the frame with the elbow at shoulder height", "same-side foot stepped through, chest turned gently away from the arm, shoulder relaxed", "The elbow height and the step both need to read; three-quarter from the open side."],
  "chair-open-chest": ["side", "medium", "seated with mid-back against the chair back, hands lightly behind the head, elbows wide", "breastbone lifted slightly over the chair back, ribs not flared, low back neutral", "The fault (flaring ribs, overarching) is sagittal."],
  "elbows-pinned-er-scap": ["front", "medium", "seated, elbows at her sides bent 90 degrees, forearms forward, palms up", "forearms rotated outward with elbows still pinned to her sides, shoulder blades down", "Elbow flare and shrug both show from the front."],
  "wall-angels": ["front", "full", "standing with her back against the cream wall, feet a small step forward, arms in a goal-post shape against the wall", "arms slid up the wall overhead, ribs quiet, low back still near the wall", "Arm path reads from the front; the low-back fault is noted in the cue."],
  "thoracic-extension": ["side", "medium", "seated with the mid-back against the top of a fixed chair back, hands behind the head", "mid-back extended gently over the chair back, low back not arched", "Extension is sagittal; profile shows where it bends."],
  "seated-thoracic-rotation": ["front", "medium", "seated tall, arms crossed over the chest, facing camera", "mid-back turned to look over her right shoulder, hips and knees still facing camera", "Hips staying square against a turned trunk only reads from the front."],
  "seated-side-bend": ["front", "medium", "seated tall, right arm reaching overhead", "leaning gently to the left, side body long, not collapsing forward", "Side bending is frontal-plane."],

  // --- core and hips ------------------------------------------------------
  "seated-pelvic-tilts": ["side", "medium", "seated tall, low back flattened toward the chair", "pelvis tipped forward into a small low-back curve", "Pelvic tilt is sagittal and small; profile at seat height."],
  "seated-lumbar-support-reset": ["side", "medium", "seated on the sit bones, a small towel roll behind the low back", "same, settled with a gentle natural curve, ribs not thrust out", "Spinal curve only reads in profile."],
  "seated-figure-4": ["front", "full", "seated tall, right ankle crossed over the left knee", "hinged slightly forward from the hips with a long spine, hands resting, not pressing the knee", "The fault (pressing the knee down) and the cross both read from the front."],
  "seated-hip-opener": ["front", "full", "seated tall, feet planted, knees together", "both knees opened outward, feet still planted, back tall", "Knee path is frontal."],
  "seated-hip-windshield-wipers": ["front", "full", "seated tall, feet planted wider than hips, knees pointing forward", "both knees swept to her left, feet planted, trunk tall", "Sweep is frontal."],
  "standing-hip-flexor": ["side", "full", "standing tall holding the desk, feet together", "short lunge with the right foot back, back knee soft, pelvis tucked, trunk upright", "The fault (arching the low back) is sagittal."],
  "standing-hip-hinge-desk": ["side", "full", "standing tall with soft knees, hands light on the desk", "hips pushed back, trunk hinged forward with a long flat spine", "Rounding versus hinging only reads in profile."],
  "standing-glute-squeeze": ["three-quarter", "full", "standing tall, soft knees, relaxed", "glutes squeezed, knees still soft, posture unchanged", "Locked knees read from the side, the squeeze from behind; three-quarter rear."],
  "sit-to-stand-glute": ["three-quarter", "full", "seated toward the front of the chair, feet planted, hands on thighs", "standing tall, glutes squeezed, knees over toes", "Knee cave shows from the front, momentum from the side; three-quarter front."],

  // --- legs and feet ------------------------------------------------------
  "hamstring-hinge": ["side", "full", "standing tall with soft knees, hands light on the desk", "hinged forward from the hips, long spine, feeling the back of the legs", "Rounding the low back is sagittal."],
  "seated-march": ["front", "full", "seated tall, hands resting on the seat edges, both feet down", "right knee lifted, foot off the floor, trunk upright", "Matches the reference sheet: the knee lift and upright trunk read from the front."],
  "standing-quad-stretch": ["side", "full", "standing tall holding the desk with the left hand", "right knee bent, holding the right ankle behind, knees close together", "Knees together and the bent leg read best in profile; the cue covers rotation."],
  "ankle-pumps": ["side", "close", "seated, legs extended slightly, toes pointed down", "toes pulled up toward her shins", "Ankle motion is sagittal; framed on lower legs and feet."],
  "foot-tripod-toe-spread": ["overhead-three-quarter", "close", "bare feet flat on the jute rug, toes relaxed", "toes spread wide, arch gently lifted, all three points down", "Toe spread reads from above and in front; framed on the feet only. Bare feet for this move only."],
  "standing-posture-reset": ["side", "full", "standing, weight slightly back", "standing tall, soft knees, head floating up, relaxed arms", "Locked knees show in profile."],
  "standing-overhead-reach": ["side", "full", "standing tall, arms at her sides", "both arms reaching overhead, ribs soft, shoulders not shrugged", "Rib flare is sagittal."],

  // --- wrists and hands ---------------------------------------------------
  "wrist-flexor-stretch": ["side", "close", "right arm forward at shoulder height, elbow soft, palm up", "left hand gently easing the right fingers toward the floor", "The bend at the wrist and the soft elbow read in profile."],
  "wrist-extensor-stretch": ["side", "close", "right arm forward, elbow soft, palm down, fingers pointing to the floor", "left hand easing the back of the right hand toward her", "As above."],
  "finger-fans": ["front", "close", "both hands up in front, fingers spread wide", "both hands closed into soft fists", "Spread versus fist is frontal; hands only."],
  "standing-wrist-shake": ["front", "medium", "standing, arms relaxed and hanging", "hands shaking loosely in front of the hips, shoulders down", "The fault (shoulders up by the ears) is frontal."],

  // --- breathing, posture, eyes, walking ----------------------------------
  "long-exhale-reset": ["three-quarter", "medium", "seated soft and tall, breathing in through the nose, chest gently risen", "sighing out through the mouth, shoulders soft and lowered", "Breath shows as shoulder and chest change; three-quarter keeps the face readable."],
  "box-breathing": ["three-quarter", "medium", "seated soft and tall, eyes softly open, breathing in", "breathing out slowly, shoulders soft", "As above."],
  "sit-bones-find": ["side", "full", "seated, rocked slightly back onto the tailbone", "balanced tall on both sit bones", "Perching versus balanced is sagittal."],
  "desk-wiggle-reset": ["front", "medium", "seated at the desk, small easy shift of the ribs to her right", "small easy shift of the ribs to her left", "A micro movement reads in the frontal plane."],
  "screen-distance-blink": ["three-quarter", "medium", "seated at the desk looking at a laptop screen", "turned slightly to look out toward a far window, eyes soft", "Shows the gaze change from screen to far point."],
  "short-walk": ["three-quarter", "full", "stepping away from the desk, mid-stride", "further across the room, mid-stride, no phone in hand", "Walking reads in three-quarter."],
  "stand-and-shift": ["front", "full", "standing, weight shifted onto her right foot", "weight shifted onto her left foot, hips moved with it", "Weight shift is frontal."],
};

const EACH_SIDE = new Set(["holdSecEachSide", "repsEachSide"]);

function setupsFor(exercise, framing) {
  if (exercise.setup === "floor") return ["floor"];
  if (exercise.setup === "either") return framing === "close" ? ["seated"] : ["seated", "standing"];
  return [exercise.setup];
}

function stemFor(id, setup, exerciseSetup) {
  return setup === "standing" && exerciseSetup === "either" ? `${id}-standing` : id;
}

function status(stem) {
  if (webp.has(stem)) return "photo";
  if (svg.has(stem)) return "illustration";
  return "none";
}

function prompt(exercise, setup, angle, framing, pose) {
  return [
    `Photograph of ${INSTRUCTOR}.`,
    `She is doing "${exercise.name}": ${pose}.`,
    `Setting: ${SETTING[framing === "close" && /desk/.test(pose) ? "desk" : setup]}.`,
    `Camera angle: ${angle.replace(/-/g, " ")}; ${FRAMING[framing]}; square 1:1 composition. Light: ${LIGHT}.`,
    `Keep the camera position, lens, lighting, instructor, clothing and props identical to the paired frame; only her body position changes.`,
    `Negative: ${NEGATIVE}.`,
  ].join(" ");
}

const missing = exercises.filter((exercise) => !DIRECTION[exercise.id]).map((exercise) => exercise.id);
if (missing.length) {
  console.error(`DIRECTION has no entry for: ${missing.join(", ")}`);
  process.exit(1);
}

const shots = [];
for (const exercise of exercises) {
  const [angle, framing, start, end, why] = DIRECTION[exercise.id];
  for (const setup of setupsFor(exercise, framing)) {
    const stem = stemFor(exercise.id, setup, exercise.setup);
    shots.push({
      id: exercise.id,
      name: exercise.name,
      access: exercise.access,
      pilot: PILOT.includes(exercise.id),
      setup,
      angle,
      framing,
      why,
      eachSide: EACH_SIDE.has(exercise.defaultDose.type),
      cue: exercise.cue,
      avoid: exercise.avoid,
      frames: [
        { file: `public/character/${stem}.webp`, role: "start", current: status(stem), prompt: prompt(exercise, setup, angle, framing, start) },
        { file: `public/character/${stem}-b.webp`, role: "end", current: status(`${stem}-b`), prompt: prompt(exercise, setup, angle, framing, end) },
      ],
    });
  }
}

/** Non-exercise poses the resolver serves. The fallback stays an illustration on purpose. */
const POSES = [
  { stem: "stretch-ready", setup: "seated", pose: "sitting on the edge of the chair, hands on knees, smiling, about to start", keep: false },
  { stem: "stretch-idle", setup: "seated", pose: "sitting relaxed and tall, hands resting on thighs, friendly look at camera", keep: false },
  { stem: "stretch-idle-standing", setup: "standing", pose: "standing relaxed beside the desk, one hand resting on it, friendly look at camera", keep: false },
  { stem: "stretch-done", setup: "seated", pose: "sitting back, shoulders easy, content small smile, eyes closed briefly", keep: false },
  { stem: "stretch-done-standing", setup: "standing", pose: "standing tall and loose beside the desk, content small smile", keep: false },
  { stem: "stretch-locked", setup: "seated", pose: "(recommend keeping the illustrated lock mark: it is an icon at 56 px, not a demonstration)", keep: true },
  { stem: "stretch-fallback", setup: "seated", pose: "(keep the neutral illustrated card: it must not show a body, because it means 'no demonstration yet')", keep: true },
];

const poseShots = POSES.map((entry) => ({
  ...entry,
  file: `public/character/${entry.stem}.webp`,
  current: status(entry.stem),
  prompt: entry.keep
    ? null
    : [
        `Photograph of ${INSTRUCTOR}.`,
        `She is ${entry.pose}.`,
        `Setting: ${SETTING[entry.setup]}.`,
        `Camera angle: front; framed from the knees up; square 1:1 composition. Light: ${LIGHT}.`,
        `Negative: ${NEGATIVE}.`,
      ].join(" "),
}));

mkdirSync(join(root, "docs", "art"), { recursive: true });
writeFileSync(
  join(root, "design", "instructor", "shot-list.json"),
  `${JSON.stringify({ note: "Generated by scripts/art-shot-list.mjs from data/exercises.json.", references: { character: "design/instructor/reference-turnaround.png", lightingAndSetting: "design/instructor/reference-seated-sheet.png" }, shots, poses: poseShots }, null, 2)}\n`,
);

const frameCount = shots.reduce((sum, shot) => sum + shot.frames.length, 0);
const done = shots.flatMap((shot) => shot.frames).filter((frame) => frame.current === "photo").length;
const lines = [
  "# Instructor photo shot list",
  "",
  "Generated by `node scripts/art-shot-list.mjs` from `data/exercises.json`. Do not edit by hand; change `DIRECTION` in the script.",
  "",
  "- Character reference: `design/instructor/reference-turnaround.png`",
  "- Lighting and setting reference: `design/instructor/reference-seated-sheet.png`",
  `- ${exercises.length} moves, ${shots.length} setups, ${frameCount} frames. ${done} frames are photos today.`,
  "",
  "## Rules for every frame",
  "",
  "- Square, at least 1024 px, no text of any kind. Import with `node scripts/import-art-frames.mjs <stem>` after adding a recipe to `design/instructor/frames.json`; it writes WebP and rebuilds the manifest.",
  "- Start (`<stem>.webp`) and end (`<stem>-b.webp`) share camera, lens, light, instructor and props. Only the body moves.",
  "- Each-side moves are shot once, exactly as the cue describes; that frame is the Left side step. The player mirrors it for the Right side step and gives both sides time and a switch cue.",
  "- Close-framed moves that are the same seated or standing get one shot; the resolver uses it for both setups.",
  "- Floor moves are shot on the mat and only appear for people who opted in to floor work.",
  "- Keep the SVG until the photo has been checked on a preview. A photo that fails to load falls back to it.",
  "",
  "## Moves",
  "",
  "| Move | Access | Setup | Angle | Framing | Each side | Start file | End file | Today |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...shots.map(
    (shot) =>
      `| ${shot.pilot ? "**" : ""}${shot.name}${shot.pilot ? "** (pilot)" : ""} | ${shot.access} | ${shot.setup} | ${shot.angle} | ${shot.framing} | ${shot.eachSide ? "yes" : ""} | \`${shot.frames[0].file.replace("public/character/", "")}\` | \`${shot.frames[1].file.replace("public/character/", "")}\` | ${shot.frames.map((frame) => frame.current).join(" / ")} |`,
  ),
  "",
  "## Ready, idle, done and locked",
  "",
  "| File | Setup | Direction | Today |",
  "| --- | --- | --- | --- |",
  ...poseShots.map((entry) => `| \`${entry.stem}.webp\` | ${entry.setup} | ${entry.pose} | ${entry.current} |`),
  "",
  "## Pilot prompts",
  "",
];
for (const shot of shots.filter((entry) => entry.pilot)) {
  lines.push(`### ${shot.name} (${shot.setup})`, "", `Cue: ${shot.cue}`, "", `Avoid: ${shot.avoid}`, "", `Angle: ${shot.angle}, ${shot.framing}. ${shot.why}`, "");
  for (const frame of shot.frames) {
    lines.push(`**${frame.file.replace("public/character/", "")}** (${frame.role}, today: ${frame.current})`, "", "```text", frame.prompt, "```", "");
  }
}
lines.push("## All other moves", "", "Prompts for every frame are in `design/instructor/shot-list.json`. The angle reasoning:", "");
for (const shot of shots.filter((entry) => !entry.pilot)) {
  lines.push(`- **${shot.name}** (${shot.setup}): ${shot.angle}, ${shot.framing}. ${shot.why}`);
}
writeFileSync(join(root, "docs", "art", "instructor-shot-list.md"), `${lines.join("\n")}\n`);

console.log(`shot list: ${exercises.length} moves, ${shots.length} setups, ${frameCount} frames (${done} already photos), ${poseShots.length} poses`);
