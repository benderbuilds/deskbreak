/**
 * Rasterize Jesse’s locked mark from the attached PNG (crop/resize only).
 *
 * Live artwork is scripts/locked-mark-source.png — not a redrawn stick figure
 * and not the old procedural scribble.
 *
 *   python3 scripts/generate-icons.py
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = path.join(root, "scripts/generate-icons.py");
const result = spawnSync("python3", [script], { stdio: "inherit", cwd: root });
if (result.error) {
  throw new Error(
    `Could not run python3: ${result.error.message}. Icons are cropped from scripts/locked-mark-source.png.`,
  );
}
process.exit(result.status ?? 1);
