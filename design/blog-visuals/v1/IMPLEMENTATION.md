# DeskBreak article figures implementation plan

**Goal:** Publish six accessible, responsive teaching figures in three existing blog articles while preserving their URLs, references, product actions and original publication dates.

**Architecture:** Import the versioned asset manifest through one typed content module. Add an optional `figure` article block and a server-rendered `BlogFigure` component. Serve the supplied mobile and desktop exports from the public directory, with captions, source links and full HTML equivalents.

**Tech stack:** Existing Next.js App Router, React, TypeScript, Tailwind and Playwright. No new runtime dependency or CMS is required.

**Package:** Six figures have twelve responsive variants: a desktop and mobile layout for each, supplied as both SVG and WebP, for 24 image files. Editable SVG text masters live in `source/editable/`, with the generator, manifest and checked study-data file. A six-page Canva working copy was imported and its page dimensions confirmed; independent text-layer editing is not verified. See README.md for its link and QA.md for completed checks.

**Specification:** Read `asset-manifest.json`, the gallery `index.html`, `SOURCES.md`, `source/study-data.json` and `EDITORIAL.md` in this package. The manifest is authoritative for figure text, data, dimensions and placement; the source ledger records the checked paper facts and supporting locations. The gallery demonstrates the assets; it is not application verification. Work through the three implementation tasks below in order. This is a handoff to the development team, not authorization to merge or publish without the owner's normal review.

## Scope and constraints

- Work on a new `codex/` branch from the appropriate unmerged base; use a fresh branch from `main` if the old branch was merged. Open a PR. Do not push to `main` or merge without the owner's instruction.
- Preserve all eight blog URLs, original `published` values, existing evidence references, quotes, `guardrail`, `painNote`, CTA configuration and source identifiers. Only the three pilots receive figures and necessary prose corrections.
- Do not change authentication, billing, scheduling, database/schema, cloud configuration, storage keys, exercise IDs or routine selection. In particular, `deskbreak.app.v2` stays unchanged.
- No new analytics, tracker, animation, interactive chart framework or design subscription belongs in this PR. The component can remain a React server component.
- Honor the health-claim and movement-safety rules in `AGENTS.md`. A `sourceChecked` flag is not clinical approval; `clinicallyReviewed` is false for these assets.
- Test only on localhost or a preview. Local/test runs must explicitly set `NEXT_PUBLIC_GA_MEASUREMENT_ID` and `NEXT_PUBLIC_POSTHOG_KEY` to empty strings. The existing Playwright configuration already does this; avoid reusing a server started with live tracking.

## File map

| File | Responsibility |
| --- | --- |
| `design/blog-visuals/v1/asset-manifest.json` | Keep as the single editorial source for the six assets. Import its metadata; do not maintain a second handwritten copy. |
| `design/blog-visuals/v1/source/build-assets.mjs` | Editable asset-generation source. Change only if an approved figure correction is needed, then regenerate the exports and review them together. |
| `design/blog-visuals/v1/SOURCES.md` and `source/study-data.json` | Scientific provenance, exact checked values, paper locations and verification limits. Use these to review the manifest; do not hand-copy divergent numbers into the app. |
| `public/blog/figures/v1/svg/<id>--desktop.svg` and `<id>--mobile.svg` | Copy the supplied SVGs without changing their names. |
| `public/blog/figures/v1/webp/<id>--desktop.webp` and `<id>--mobile.webp` | Copy the supplied WebP files. These are the default rendered images. |
| `src/content/blog-figures.ts` | New typed manifest adapter, figure ID type, lookup and manifest validation. |
| `src/components/marketing/BlogFigure.tsx` | New responsive figure, caption, source links, HTML description and optional data table. |
| `src/content/blog.ts` | Add the figure block, optional editorial metadata, figure-aware citations/reading time and the six pilot insertions. Apply the required eye-study corrections. |
| `src/app/blog/[slug]/page.tsx` | Render the figure block and optional genuine update/byline metadata, with matching structured data. |
| `src/app/sitemap.ts` | For blog entries only, use an actual `updatedAt` when present, otherwise `published`. Leave unrelated sitemap behavior outside this PR. |
| `tests/blog-figures-content.spec.ts` | New focused content checks for manifest validity, citation integrity and backward compatibility. |
| `tests/blog-figures.spec.ts` | New browser checks of all three pilot pages at mobile and desktop sizes. |

Each of the six IDs gets all four named image files: `break-frequency-protocol`, `break-frequency-interpretation`, `eye-break-mnemonic`, `eye-break-study`, `standing-desk-trial`, `standing-desk-results`. Copy paths relative to the package directly beneath `public/blog/figures/v1/`. For example, manifest path `webp/eye-break-study--mobile.webp` is served at `/blog/figures/v1/webp/eye-break-study--mobile.webp`. Do not publish the local preview page as a blog route.

## Task 1: Add the typed figure contract and content validation

**Deliverable:** Existing articles still load unchanged; content can safely reference one of the six figure IDs without breaking source validation or reading time.

**Files:** `src/content/blog-figures.ts`, `src/content/blog.ts`, `tests/blog-figures-content.spec.ts`, and the copied public assets.

The supplied manifest shape is:

```ts
type FigureFile = {
  svg: string;
  webp: string;
  width: number;
  height: number;
};

type BlogFigureAsset = {
  id: BlogFigureId;
  title: string;
  postSlug: string;
  placement: { afterHeading: string | null; afterParagraphStartsWith: string };
  sourceIds: string[];
  alt: string;
  caption: string;
  longDescription: string[];
  dataTable?: {
    caption: string;
    columns: string[];
    rows: (string | number)[][];
    note: string;
  };
  files: { desktop: FigureFile; mobile: FigureFile };
  sourceChecked: boolean;
  clinicallyReviewed: boolean;
};

type BlogFigureManifest = {
  version: string;
  createdAt: string;
  publicBasePath: string;
  assets: BlogFigureAsset[];
};
```

Export `BlogFigureId` as the literal union of the six IDs listed above, `BlogFigureAsset`, `BLOG_FIGURES`, `BLOG_FIGURE_BASE_PATH`, and `getBlogFigure(id: BlogFigureId): BlogFigureAsset`. Import the JSON from `../../design/blog-visuals/v1/asset-manifest.json`; check its structure and reject duplicate or unknown IDs rather than hiding invalid data behind a type assertion. The helper must throw for a missing figure. Do not silently display an unrelated asset.

Extend the existing types with:

```ts
// Add this member to BlogBlock; preserve all existing members.
| { type: "figure"; figureId: BlogFigureId }

// Optional additions to BlogPost.
updatedAt?: string;
author?: { name: string; url?: string };
```

- [ ] Validate all six IDs, unique IDs, nonempty alt/caption/description, positive dimensions, both rendition paths, source IDs and data-table row widths. Reject paths containing traversal segments, remote origins or missing files. Source links come from `getSource`, not from arbitrary manifest HTML.
- [ ] Copy the 24 image exports to the mapped public paths. Check that file names and image dimensions agree with the manifest. Do not guess a height from the gallery; desktop width is 1200 and mobile width is 600, with per-figure heights supplied in the manifest.
- [ ] Update the citation pass in `blog.ts`: figure blocks contribute every `sourceId` from `getBlogFigure`. Continue rejecting unknown, unverified or unlisted sources and unused reference entries. Do not bypass the current citation rules for figures.
- [ ] Update `blogWordCount` with an explicit figure case. Count the caption, long description and table text once; avoid counting file paths, alt text, source IDs or the same content twice. Existing paragraph/list/quote behavior stays intact.
- [ ] Before implementation, write focused failing checks for a figure-only citation missing from the post reference list, a nonexistent figure, and malformed numeric table rows. Confirm they fail for the intended reason, then implement the contract. If the existing validation is extracted for testing, preserve its module-load enforcement.
- [ ] Add a compatibility check that all eight current articles have valid references and finite positive reading times. Figure-free articles must remain valid without `updatedAt` or a named author. Check an invalid source fixture through the same validator, not an unrelated mock.
- [ ] When present, require `updatedAt` to be a valid `YYYY-MM-DD` date no earlier than `published`. Reject a blank author name; omit unknown author details rather than introducing a placeholder.

**Run:** `npx playwright test tests/blog-figures-content.spec.ts --project=mobile` and `npx tsc --noEmit`. Record actual PASS/FAIL. Review the task diff before a focused commit; never include unrelated local files.

## Task 2: Render accessible figures and honest metadata

**Deliverable:** One reusable component renders both layouts with source-linked captions and the full content available as HTML; articles without figures retain their existing presentation.

**Files:** `src/components/marketing/BlogFigure.tsx`, `src/app/blog/[slug]/page.tsx`, `src/app/sitemap.ts`, `tests/blog-figures.spec.ts`.

**Interface:** `BlogFigure({ figure }: { figure: BlogFigureAsset })` consumes a validated asset. Add an explicit `case "figure"` to the article `Block` switch and render `<BlogFigure figure={getBlogFigure(block.figureId)} />`. The figure element uses `id={figure.id}` so each image has a stable fragment anchor. The current headings do not have IDs; changing every heading is unnecessary for these insertions.

- [ ] Render a semantic `<figure>` with a `<picture>`, choosing mobile WebP below 640px and desktop WebP otherwise. Build URLs from `BLOG_FIGURE_BASE_PATH` and each manifest path. Set appropriate width/height and reserve the correct aspect ratio for each breakpoint so the different layouts do not cause a jump when the image loads. Use `loading="lazy"` for these in-article figures and `decoding="async"`. Keep the SVGs available as vector originals; do not load both formats at once.
- [ ] Place the figure within the existing article width. Make the image width responsive without cropping. Keep its text legible on a 360px-wide viewport; do not rely on pinch zoom. Do not stretch a desktop diagram into the mobile space when a dedicated mobile file exists.
- [ ] Render `caption` in `<figcaption>` and link each `sourceId` using `getSource(id).url` and `shortCitation(id)`. Preserve the references section. The linked source names and core qualification must remain visible, even if detailed text is in a disclosure.
- [ ] Render every `longDescription` paragraph as React text, not injected HTML. A visible description or a native `<details>` with a clear `<summary>` is acceptable. If present, render `dataTable` as a real `<table>` with `<caption>`, column headers, body cells and its note. Preserve the order and exact values from the manifest. A controlled table wrapper can scroll if necessary, but the whole page must not overflow.
- [ ] Use concise `alt` and avoid adding repetitive ARIA narration to ordinary figure/caption/table semantics. Check native disclosure keyboard operation. With images blocked, the caption, sources, transcript and data must still explain the finding.
- [ ] If `updatedAt` exists, display “Updated” with that date and emit `dateModified` in BlogPosting plus `modifiedTime` in Open Graph. Keep the original `datePublished` and `publishedTime`. Blog sitemap `lastModified` uses `updatedAt ?? published`; do not derive updates from `new Date()` or manifest `createdAt`.
- [ ] If a real `author` is present, render the matching visible name/link and Person structured data. Otherwise retain the existing DeskBreak Organization schema and omit the personal byline. No reviewer badge, invented professional identity or placeholder author is needed. Omit optional fields cleanly.
- [ ] Add browser checks for the component's meaningful behavior: mobile and desktop select their expected `currentSrc`, images finish loading with positive `naturalWidth`, captions have working source URLs, full figure details are keyboard accessible, the numeric table retains its labels/values, and the article stays within viewport width. Test the metadata with and without the optional fields.

**Run after the pilots are inserted in task 3:** `npx playwright test tests/blog-figures.spec.ts --project=mobile --project=desktop`. During this task, use content fixtures locally if needed; do not add a publicly indexed demonstration route or declare a fixture to be verified production behavior.

## Task 3: Insert the pilots, reconcile prose and verify the PR

**Deliverable:** Exactly two figures appear in each pilot article, with correct neighboring text, preserved CTA behavior and a reviewable PR.

**Files:** `src/content/blog.ts`, focused tests from tasks 1–2, and any necessary approved corrections to the package/source files.

| Existing post slug | Figure ID | Exact heading and paragraph prefix |
| --- | --- | --- |
| `how-often-should-you-get-up-from-your-desk` | `break-frequency-protocol` | “Every 20 minutes: the lab study”; “One of the most cited studies on breaking up sitting” |
| `how-often-should-you-get-up-from-your-desk` | `break-frequency-interpretation` | “Every 20 minutes: the lab study”; “Keep the limits in view.” |
| `does-the-20-20-20-rule-work` | `eye-break-mnemonic` | Introductory section, `afterHeading: null`; “The 20-20-20 rule is simple:” |
| `does-the-20-20-20-rule-work` | `eye-break-study` | “The study”; “Researchers recruited 29 computer users” |
| `are-standing-desks-worth-it` | `standing-desk-trial` | “A bigger trial, a year long”; “A 2022 trial published in the BMJ gave firmer numbers” |
| `are-standing-desks-worth-it` | `standing-desk-results` | “A bigger trial, a year long”; “At twelve months, the group with the desk” |

**Use each manifest `placement.afterHeading` and `placement.afterParagraphStartsWith` to identify the precise insertion point.** Find the named heading and matching paragraph in that section before inserting; `afterHeading: null` means the introduction before the first h2. Do not match a paragraph elsewhere in the article. If the content changed since this handoff and the exact location no longer exists, reconcile the section deliberately and record the placement decision. Do not silently append a figure to the end. Link review comments to the final `#<figure-id>` anchors; no existing heading anchor is assumed.

- [ ] Insert each figure once in its intended post, using blocks such as `{ type: "figure", figureId: "break-frequency-protocol" }`. Do not duplicate figure metadata in the article body. Keep the existing product CTA, `painNote`, guardrail, study quotations, references and all five other articles working.
- [ ] Apply the required eye-study corrections in `EDITORIAL.md`: include the baseline phase, describe symptom improvement after reminder cessation as not clearly sustained, and acknowledge the accommodative-facility result. Update the related metadata/guardrail if they otherwise overstate the conclusion.
- [ ] Ensure the standing chart is described as adjusted total daily sitting at 12 months compared with usual practice, with the combined programme-plus-desk intervention identified. Reconcile prose against the manifest's exact values and intervals; do not substitute workplace sitting or a desk-alone effect.
- [ ] Keep the break-frequency diagrams qualified as study protocols. Preserve the visible statement that no official guideline sets a break interval. Do not imply that the app's movements reproduce the walking-study findings.
- [ ] Add `updatedAt` only to the substantively revised pilot posts using the real release/revision date. Do not use the package creation date automatically. Add personal authorship only if real information has been supplied; its absence does not block the component.
- [ ] Review at 360px, the configured mobile viewport and desktop width. Check source/caption consistency, readable labels, no clipping, page overflow, loading/reserved space, image-blocked content and keyboard operation. Verify that each article still leads into its existing suitable routine on localhost or preview; do not start resets on production.
- [ ] In focused browser tests, assert the exact two figure IDs per pilot, zero new figures on an unchanged article, preserved CTA target, intact references, original publication dates, correct optional update metadata and the required corrected eye-study wording. Ensure the expected numeric rows come from the manifest, with editorial spot checks against the source rather than tests that merely assert a copied typo.
- [ ] Run the required pre-push checks below, record each result and attach relevant mobile/desktop screenshots plus the preview/PR link. Commit with an imperative subject describing the change. Open the PR with the owner-review requirement intact.

## Verification and acceptance

| Check | Required result or reporting |
| --- | --- |
| `npm run lint` | PASS before push. |
| `npx tsc --noEmit` | PASS before push. |
| `npm run test:server` | PASS before push, even though the change is presentational. |
| `npm run build` | PASS before push. |
| Focused figure content tests | PASS, including invalid source/figure rejection and unchanged-article compatibility. |
| Focused figure browser tests | PASS on mobile and desktop with local analytics disabled. |
| Manual figure/editorial review | Record PASS/FAIL and actual viewport/source scope; include screenshots and the six figures' review status. |
| `test:security`, Postgres suite | NOT RUN for this scope unless API/server/auth/store/delivery/schema files are touched. If scope expands there, follow `AGENTS.md` requirements. |
| Full unrelated Playwright suite | Report NOT RUN unless actually executed; do not substitute the focused checks and label the full suite passed. |

Acceptance requires six working figures, equivalent HTML content, accurate checked captions/data, the required adjacent prose corrections, preserved existing article behavior and passing required checks. The developer PR must state any remaining editorial issue explicitly. A mock render, gallery screenshot or source-code inspection alone is not application verification.

This plan was prepared through read-only inspection of the current application. **Application implementation and integration tests are NOT RUN.** The asset package's actual repository and local-gallery checks are recorded in QA.md. A Canva working copy was created with explicit owner approval. No application code, production data or deployment was changed. Later catalog expansion, measurement work and distribution are separately scoped in `EDITORIAL.md`.
