#!/usr/bin/env node
/**
 * Turns instructor photo frames into the square WebP files the art resolver
 * serves from public/character/, then rebuilds data/art-manifest.json.
 *
 * Recipes live in design/instructor/frames.json. A start frame and its "-b"
 * end frame must use the same crop size so the camera never moves between
 * them; this script refuses a pair that doesn't.
 *
 *   node scripts/import-art-frames.mjs            # every recipe
 *   node scripts/import-art-frames.mjs calf-raise # one stem and its -b frame
 *
 * It never deletes the SVG of the same name. Old art stays in place until the
 * photo replacing it has been checked on a preview.
 *
 * public/sw.js answers /character/ from its cache before the network, so a
 * WebP that has shipped must never be overwritten in place: returning visitors
 * would keep the old frame. Replace a shipped photo by bumping ASSET_VERSION
 * there (and in src/lib/brand.ts) in the same PR.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const OUT_DIR = join(root, "public", "character");
const QUALITY = 82;
/** Upper bound on output size; frames smaller than this are kept at source size, never upscaled. */
const MAX_SIZE = 1024;

const { frames } = JSON.parse(readFileSync(join(root, "design", "instructor", "frames.json"), "utf8"));
const only = process.argv[2];
const selected = only ? frames.filter((frame) => frame.stem === only || frame.stem === `${only}-b`) : frames;
if (!selected.length) {
  console.error(`no recipe for ${only}`);
  process.exit(1);
}

const byStem = new Map(frames.map((frame) => [frame.stem, frame]));
for (const frame of selected) {
  const partner = frame.stem.endsWith("-b") ? byStem.get(frame.stem.slice(0, -2)) : byStem.get(`${frame.stem}-b`);
  if (partner && partner.crop.size !== frame.crop.size) {
    console.error(`${frame.stem}: crop size ${frame.crop.size} differs from ${partner.stem} (${partner.crop.size}). Keep the camera fixed.`);
    process.exit(1);
  }
}

for (const frame of selected) {
  const source = join(root, frame.source);
  let image = sharp(source);

  if (frame.patches?.length) {
    const composites = [];
    for (const patch of frame.patches) {
      const input = await sharp(source)
        .extract({ left: patch.from.left, top: patch.from.top, width: patch.width, height: patch.height })
        .toBuffer();
      composites.push({ input, left: patch.to.left, top: patch.to.top });
    }
    image = sharp(await image.composite(composites).png().toBuffer());
  }

  const { left, top, size } = frame.crop;
  const outSize = Math.min(size, MAX_SIZE);
  const out = join(OUT_DIR, `${frame.stem}.webp`);
  const info = await image
    .extract({ left, top, width: size, height: size })
    .resize(outSize, outSize)
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(out);
  console.log(`${frame.stem}.webp ${info.width}x${info.height} ${(info.size / 1024).toFixed(0)} KB`);
}

execFileSync(process.execPath, [join(root, "scripts", "build-art-manifest.mjs")], { stdio: "inherit" });
