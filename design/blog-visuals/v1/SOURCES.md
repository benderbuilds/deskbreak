# Source verification for original blog visuals

Verified September 25, 2026. Numeric fields and figure-to-study mappings are in [study-data.json](source/study-data.json). Source IDs match the existing evidence registry. These files document scientific provenance, not clinical approval.

## Dunstan 2012: walking protocol and interpretation

[DOI](https://doi.org/10.2337/dc11-1931) · [Primary full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC3329818/) · Registry: `dunstan-2012`

Use the same participants across all three conditions, not three independent groups. The active conditions contained 14 walking bouts. A schematic must not imply 15 bouts. Keep laboratory blood markers separate from long-term health or product effects. Phrase the limitation as “This experiment did not compare break intervals,” rather than attributing a universal guideline conclusion to this paper.

Location: Abstract; Research Design and Methods, experimental conditions.

## Talens-Estarelles 2023: eye-break mnemonic and study timeline

[DOI](https://doi.org/10.1016/j.clae.2022.101744) · [Publisher](https://www.sciencedirect.com/science/article/pii/S1367048422001990) · Registry: `talens-estarelles-2023`

The complete timeline includes baseline monitoring. A shortened intervention/follow-up graphic must disclose that omission. The authors describe a controlled longitudinal study, but there was no separate parallel control group. Preserve the distinction between reported symptoms and examination results. Do not label all objective findings unchanged or claim all improvement vanished after reminders stopped. The mnemonic is not a proven optimal schedule.

Location: Sections 2.2 (software), 2.4 (procedure), Results and Discussion. Publisher full text was available through indexed search extracts; direct page retrieval was blocked.

## Edwardson 2022: trial arms and sitting differences

[DOI](https://doi.org/10.1136/bmj-2021-069288) · [Primary full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC9382450/) · Registry: `edwardson-2022`

The chart uses Table 2's adjusted differences versus usual practice, not raw changes from baseline. The outcome spans daily sitting inside and outside work. Show confidence intervals and identify the behavior program in both intervention arms. Avoid converting sitting-time changes into health benefits.

Location: Results, primary outcome; Table 2. Preserve the stored negative signs unless every chart label and confidence limit is consistently converted to fewer minutes.

## Verification record and limits

- **PASS:** All three live DOI requests returned HTTP 302 to matching publisher records. Crossref independently matched each DOI to the intended title. Exact redirect targets are recorded in the JSON.
- **PASS:** Dunstan and Edwardson full texts returned HTTP 200 from PMC; methods and the chart's Table 2 values were inspected. Eye-study publisher methods/results were inspected in indexed primary-source excerpts.
- **FAIL:** Direct publisher content retrieval returned 403 for the Dunstan and BMJ targets. The eye DOI reached a valid publisher locator with HTTP 200, but that response is not the full paper; direct full-text retrieval was also blocked. These failures do not invalidate the DOI identity checks.
- **PASS:** The six proposals use only the three requested registry IDs.
- **NOT RUN:** Licensed clinician review, a systematic update of the literature, and verification of any health effect for DeskBreak itself.

The graphics must be original compositions. Do not reproduce or trace publisher figures. Use concise original labels, source captions, and accessible text equivalents. This package supports developer handoff; publication claims still need the project's normal editorial review. A source check does not authorize a PT-reviewed or medically approved badge.
