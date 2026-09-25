import manifestJson from "../../design/blog-visuals/v1/asset-manifest.json";

/**
 * Research figures for /blog.
 *
 * The design handoff in design/blog-visuals/v1/ owns the figure text, the
 * checked study values and the export dimensions. This module is the only way
 * the app reads it, so a figure can never drift from the manifest the source
 * check was run against.
 *
 * Rules that go with the assets (see the handoff's EDITORIAL.md):
 * - `sourceChecked` records a DOI and value check. It is not clinical review,
 *   and `clinicallyReviewed` is false for every asset in this version.
 * - The image is never the only way to reach a finding. Caption, source links
 *   and the text equivalent carry it; BlogFigure renders all three.
 * - Only WebP ships. The SVG masters stay in the handoff as vector originals;
 *   loading both formats would download the same figure twice.
 */

export type BlogFigureId =
  | "break-frequency-protocol"
  | "break-frequency-interpretation"
  | "eye-break-mnemonic"
  | "eye-break-study"
  | "standing-desk-trial"
  | "standing-desk-results";

const FIGURE_IDS: BlogFigureId[] = [
  "break-frequency-protocol",
  "break-frequency-interpretation",
  "eye-break-mnemonic",
  "eye-break-study",
  "standing-desk-trial",
  "standing-desk-results",
];

export type BlogFigureRendition = {
  /** Vector original, kept in the handoff. Not served. */
  svg: string;
  /** Path under BLOG_FIGURE_BASE_PATH, e.g. "webp/eye-break-study--mobile.webp". */
  webp: string;
  width: number;
  height: number;
};

export type BlogFigureDataTable = {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
  note: string;
};

export type BlogFigureAsset = {
  id: BlogFigureId;
  title: string;
  postSlug: string;
  placement: { afterHeading: string | null; afterParagraphStartsWith: string };
  sourceIds: string[];
  alt: string;
  caption: string;
  longDescription: string[];
  dataTable?: BlogFigureDataTable;
  files: { desktop: BlogFigureRendition; mobile: BlogFigureRendition };
  sourceChecked: boolean;
  clinicallyReviewed: boolean;
};

export const BLOG_FIGURE_BASE_PATH = "/blog/figures/v1";

/** Below this width the mobile composition is used. Matches Tailwind's sm. */
export const BLOG_FIGURE_MOBILE_MAX_WIDTH = 640;

function fail(message: string): never {
  throw new Error(`blog figure manifest: ${message}`);
}

function requireText(value: unknown, what: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${what} must be a non-empty string`);
  return value;
}

/**
 * A manifest path is joined onto a public base path, so it has to stay a
 * relative path inside that directory. Traversal or an absolute/remote origin
 * would point the figure somewhere the source check never covered.
 */
function requireRelativePath(value: unknown, what: string): string {
  const path = requireText(value, what);
  if (path.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.split("/").includes("..")) {
    fail(`${what} must be a relative path inside the figure directory, got ${path}`);
  }
  return path;
}

function requireRendition(value: unknown, what: string): BlogFigureRendition {
  if (typeof value !== "object" || value === null) fail(`${what} must be an object`);
  const raw = value as Record<string, unknown>;
  const width = raw.width;
  const height = raw.height;
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) fail(`${what}.width must be a positive number`);
  if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) fail(`${what}.height must be a positive number`);
  return {
    svg: requireRelativePath(raw.svg, `${what}.svg`),
    webp: requireRelativePath(raw.webp, `${what}.webp`),
    width,
    height,
  };
}

function requireDataTable(value: unknown, what: string): BlogFigureDataTable {
  if (typeof value !== "object" || value === null) fail(`${what} must be an object`);
  const raw = value as Record<string, unknown>;
  const columns = raw.columns;
  if (!Array.isArray(columns) || columns.length === 0) fail(`${what}.columns must be a non-empty array`);
  columns.forEach((column, index) => requireText(column, `${what}.columns[${index}]`));
  const rows = raw.rows;
  if (!Array.isArray(rows) || rows.length === 0) fail(`${what}.rows must be a non-empty array`);
  rows.forEach((row, index) => {
    if (!Array.isArray(row)) fail(`${what}.rows[${index}] must be an array`);
    // A short row would silently shift values under the wrong column header.
    if (row.length !== columns.length) {
      fail(`${what}.rows[${index}] has ${row.length} cells but there are ${columns.length} columns`);
    }
    row.forEach((cell, cellIndex) => {
      if (typeof cell === "string") return;
      if (typeof cell === "number" && Number.isFinite(cell)) return;
      fail(`${what}.rows[${index}][${cellIndex}] must be a string or a finite number`);
    });
  });
  return {
    caption: requireText(raw.caption, `${what}.caption`),
    columns: columns as string[],
    rows: rows as (string | number)[][],
    note: requireText(raw.note, `${what}.note`),
  };
}

function requireAsset(value: unknown, index: number): BlogFigureAsset {
  if (typeof value !== "object" || value === null) fail(`assets[${index}] must be an object`);
  const raw = value as Record<string, unknown>;
  const id = raw.id;
  if (typeof id !== "string" || !(FIGURE_IDS as string[]).includes(id)) {
    fail(`assets[${index}].id ${String(id)} is not a known figure id`);
  }
  const what = `${id}`;

  const placement = raw.placement;
  if (typeof placement !== "object" || placement === null) fail(`${what}.placement must be an object`);
  const rawPlacement = placement as Record<string, unknown>;
  const afterHeading = rawPlacement.afterHeading;
  if (afterHeading !== null && (typeof afterHeading !== "string" || afterHeading.trim() === "")) {
    fail(`${what}.placement.afterHeading must be null or a non-empty string`);
  }

  const sourceIds = raw.sourceIds;
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) fail(`${what}.sourceIds must be a non-empty array`);
  sourceIds.forEach((sourceId, sourceIndex) => requireText(sourceId, `${what}.sourceIds[${sourceIndex}]`));

  const longDescription = raw.longDescription;
  if (!Array.isArray(longDescription) || longDescription.length === 0) {
    fail(`${what}.longDescription must be a non-empty array`);
  }
  longDescription.forEach((paragraph, paragraphIndex) =>
    requireText(paragraph, `${what}.longDescription[${paragraphIndex}]`),
  );

  const files = raw.files;
  if (typeof files !== "object" || files === null) fail(`${what}.files must be an object`);
  const rawFiles = files as Record<string, unknown>;

  if (typeof raw.sourceChecked !== "boolean") fail(`${what}.sourceChecked must be a boolean`);
  if (typeof raw.clinicallyReviewed !== "boolean") fail(`${what}.clinicallyReviewed must be a boolean`);

  return {
    id: id as BlogFigureId,
    title: requireText(raw.title, `${what}.title`),
    postSlug: requireText(raw.postSlug, `${what}.postSlug`),
    placement: {
      afterHeading: (afterHeading as string | null) ?? null,
      afterParagraphStartsWith: requireText(
        rawPlacement.afterParagraphStartsWith,
        `${what}.placement.afterParagraphStartsWith`,
      ),
    },
    sourceIds: sourceIds as string[],
    alt: requireText(raw.alt, `${what}.alt`),
    caption: requireText(raw.caption, `${what}.caption`),
    longDescription: longDescription as string[],
    dataTable: raw.dataTable === undefined ? undefined : requireDataTable(raw.dataTable, `${what}.dataTable`),
    files: {
      desktop: requireRendition(rawFiles.desktop, `${what}.files.desktop`),
      mobile: requireRendition(rawFiles.mobile, `${what}.files.mobile`),
    },
    sourceChecked: raw.sourceChecked,
    clinicallyReviewed: raw.clinicallyReviewed,
  };
}

function loadManifest(): Map<BlogFigureId, BlogFigureAsset> {
  const raw = manifestJson as unknown as Record<string, unknown>;
  requireText(raw.version, "version");
  const assets = raw.assets;
  if (!Array.isArray(assets)) fail("assets must be an array");

  const byId = new Map<BlogFigureId, BlogFigureAsset>();
  assets.forEach((asset, index) => {
    const parsed = requireAsset(asset, index);
    if (byId.has(parsed.id)) fail(`duplicate asset id ${parsed.id}`);
    byId.set(parsed.id, parsed);
  });

  for (const id of FIGURE_IDS) {
    if (!byId.has(id)) fail(`manifest is missing ${id}`);
  }
  return byId;
}

const FIGURES = loadManifest();

/** Every figure, in manifest order. */
export const BLOG_FIGURES: BlogFigureAsset[] = FIGURE_IDS.map((id) => FIGURES.get(id)!);

/** The manifest version the shipped figures came from. */
export const BLOG_FIGURE_VERSION = (manifestJson as unknown as { version: string }).version;

/** Throws on an unknown id: a missing figure fails the build, never renders a different one. */
export function getBlogFigure(id: BlogFigureId): BlogFigureAsset {
  const figure = FIGURES.get(id);
  if (!figure) throw new Error(`Unknown blog figure: ${id}`);
  return figure;
}

/** The served URL for one rendition, e.g. "/blog/figures/v1/webp/....webp". */
export function blogFigureSrc(rendition: BlogFigureRendition): string {
  return `${BLOG_FIGURE_BASE_PATH}/${rendition.webp}`;
}
