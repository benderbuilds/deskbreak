/**
 * Rasterize Jesse’s locked mark from SVG masters.
 *
 * Live mark: public/icons/logo-mark.svg
 * (coral squircle + white seated silhouette — not the old scribble).
 *
 * Requires rsvg-convert (librsvg) and ImageMagick `convert` for the .ico
 * and for downsampling smaller PNGs.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const mark = path.join(root, "public/icons/logo-mark.svg");
const maskable = path.join(root, "public/icons/logo-mark-maskable.svg");
const fullbleed = path.join(root, "public/icons/logo-mark-fullbleed.svg");
const faviconSvg = path.join(root, "public/favicon.svg");
const outDir = path.join(root, "public/icons");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.error) {
    throw new Error(
      `Could not run ${cmd}: ${result.error.message}. Install librsvg / ImageMagick to regenerate icons.`,
    );
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${result.status}`);
  }
}

function which(cmd) {
  return spawnSync("which", [cmd], { encoding: "utf8" }).status === 0;
}

if (!fs.existsSync(mark)) {
  throw new Error(`Missing SVG master: ${mark}`);
}

if (!which("rsvg-convert")) {
  console.error(
    "rsvg-convert not found. Icons are authored in public/icons/logo-mark.svg; rasters are committed.",
  );
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

function raster(svg, dest, size, { downsampleFrom = size } = {}) {
  const srcSize = downsampleFrom;
  const tmp = path.join(os.tmpdir(), `deskbreak-icon-${size}-${path.basename(dest)}`);
  run("rsvg-convert", ["-w", String(srcSize), "-h", String(srcSize), svg, "-o", tmp]);
  if (srcSize === size || !which("convert")) {
    fs.copyFileSync(tmp, dest);
  } else {
    run("convert", [tmp, "-resize", `${size}x${size}`, dest]);
  }
  fs.unlinkSync(tmp);
}

raster(mark, path.join(outDir, "icon-192.png"), 192, { downsampleFrom: 768 });
raster(mark, path.join(outDir, "icon-512.png"), 512);
raster(maskable, path.join(outDir, "icon-512-maskable.png"), 512);
raster(fullbleed, path.join(root, "public/apple-touch-icon.png"), 180, {
  downsampleFrom: 720,
});

if (which("convert")) {
  run("convert", [
    "-background",
    "none",
    faviconSvg,
    "-define",
    "icon:auto-resize=64,48,32,16",
    path.join(root, "public/favicon.ico"),
  ]);
} else {
  console.warn("ImageMagick convert not found; skipped favicon.ico");
}

const staleApple = path.join(outDir, "apple-touch-icon.png");
if (fs.existsSync(staleApple)) fs.unlinkSync(staleApple);

console.log("wrote icons from SVG masters");
