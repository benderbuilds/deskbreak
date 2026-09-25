# DeskBreak blog visuals: developer handoff

Version 1.1.0, September 25, 2026. Plain-language revision.

This package contains six original research figures for three existing blog articles. It is an asset and implementation handoff, not a deployed website change. No article routes, application code, production data, or analytics settings have been changed.

## Start here

1. Open [index.html](index.html) for the responsive visual preview, captions, accessible descriptions and the numerical chart's data table.
2. Read [IMPLEMENTATION.md](IMPLEMENTATION.md) for three scoped development tasks and acceptance checks.
3. Read [EDITORIAL.md](EDITORIAL.md) before integrating the pilot articles. The eye article needs specific corrections alongside the new visuals.
4. Use [asset-manifest.json](asset-manifest.json) as the source of filenames, dimensions, article placements, alt text, captions, source IDs and text equivalents.
5. Consult [SOURCES.md](SOURCES.md) and [source/study-data.json](source/study-data.json) for the evidence checks. Source checking is not clinical approval.
6. Read [QA.md](QA.md) for completed checks and remaining implementation checks.
7. Apply [PILOT-COPY.md](PILOT-COPY.md) for the three articles' replacement passages. Use [COPY-STANDARD.md](COPY-STANDARD.md) for the catalog's writing and reader-testing standard.

## Canva working copy

[Open the current six-page Canva copy, version 1.1](https://www.canva.com/d/UjXQzx5Mr87e9B1). It includes the plain-language revision and supersedes the earlier version 1.0 working copy. The existing approval covers uploading these six figure layouts and their research text. All six desktop pages and their updated dimensions were confirmed. The import uses SVG artwork, and independent Canva text-layer editing is not verified. Use `source/editable/` SVG masters and the builder for reliable edits; the developer delivery files are the checked local exports.

## What is included

| Article | Figures |
| --- | --- |
| How often should you get up from your desk? | Walking experiment; interpreting its limits |
| Does the 20-20-20 rule work? | Mnemonic; complete five-week study timeline |
| Are standing desks worth it? | Three trial groups; adjusted sitting differences with confidence intervals |

Every figure has a wide desktop composition and a separately arranged mobile composition, each as SVG and compressed WebP. Version 1.1 simplifies headings, labels, captions and text explanations. It also removes decoration that could be mistaken for data, explains chart uncertainty, and keeps source links visible in the gallery. Study values and the full five-week eye-study sequence are preserved.

- `webp/`: delivery-ready raster exports. Use these by default in the proposed `<picture>` component.
- `svg/`: vector exports with outlined Archivo lettering, so rendering does not depend on installed fonts. The embedded title and description identify the image, but still use the manifest's HTML text equivalents.
- `source/editable/`: editable SVG masters with live text and vector shapes.
- `source/fonts/`: the existing project's Archivo fonts and license information. Install these when editing the live-text masters in a design application.
- `source/build-assets.mjs`: reproducible asset builder. The numerical chart reads its estimates from the verified study-data file.
- `source/canva-import.html`: six annotated design pages for a Canva import. This is an interchange file; import fidelity and layer editability require separate verification.
- `preview/`: desktop and mobile contact sheets for a quick review.

The web exports use the site's existing colors: paper `#F7F9FC`, ink `#18233D`, cobalt `#3155D9`, pale cobalt `#EDF0FF`, sunshine `#FFE08A`, and muted text `#536078`. The figures are original diagrams, not reproductions of journal figures. No stock images or AI-generated anatomy are used.

## Implementation boundaries

Copy web assets to the proposed `public/blog/figures/v1/` location, preserving filenames. Keep the handoff's relative file paths and the manifest's proposed public base path distinct. Follow the detailed plan for the runtime manifest and citation validation.

Do not publish the entire handoff directory. Source notes, editable masters, font files and developer documents are build/edit resources. The preview is an offline review artifact with no tracking scripts.

Always ship a visible caption, source links and a readable text equivalent. The standing-results figure also needs its HTML data table. Do not rely on text baked into an image for accessibility or indexing. Do not replace an article's publication date with the asset creation date.

## Rebuild

From the repository root, with the existing dependencies installed:

```sh
node design/blog-visuals/v1/source/build-assets.mjs
```

The builder uses the repository's existing `sharp` dependency and the font parser bundled with Next.js. It creates no network requests or production events. It is a design utility, not application runtime code. A Next.js upgrade could require adapting that font-parser import; the exported assets remain usable independently.

After any edit, compare the new figures to the primary source, inspect desktop and mobile exports, recheck dimensions and file sizes, and update the manifest and source record together. Clinical sign-off remains separate and must never be inferred from source checks.

## Remaining work and ownership

| Owner | Next deliverable |
| --- | --- |
| Development | Figure support, source-linked captions, text/data equivalents, three article integrations and preview QA |
| Editorial | Required eye-study corrections; final article copy and actual author attribution; review current literature before describing an overview as current |
| Appropriate subject specialist | Review practical instructions and health interpretation; document the exact version and review scope |
| Product/analytics | Verify a single canonical reset-completion event in the chosen analytics system as a separate ticket |
| Owner | Review the preview and authorize the eventual production merge |

The broader catalog expansion follows after the three pilots meet the agreed publishing standard. No external messages, outreach or recurring automations are part of this package.
