# DeskBreak pilot figure editorial handoff

This package adds six explanatory figures to three existing articles. The figures explain study protocols and interpretation; they do not establish that DeskBreak reproduces a study intervention or result. `asset-manifest.json` is the source of truth for each figure's final text, alternative text, transcript, caption, study identifiers and numerical data. `SOURCES.md` and `source/study-data.json` record the supporting paper locations, checked values and limits of verification. Do not retype numbers from a screenshot.

There are twelve responsive layouts across those six figures, each exported as SVG and WebP. Live-text SVG masters are in `source/editable/`, alongside the generator and data files. A Canva working copy was imported with owner approval; independent text-layer editing remains unverified. See README.md for its link and QA.md for the complete verification record.

## Responsibility and publication readiness

The developer implements rendering and preserves the supplied content. The editorial owner verifies the source-to-claim relationship and approves any adjacent prose corrections. The owner decides when to merge the implementation PR. Asset creation, source checking, editorial approval and licensed clinical review are separate activities; record only what actually happened.

A missing clinician name does not block the figure component or require a fabricated byline. Keep the current organization authorship or omit a personal byline until a real writer is supplied. Never display “PT-reviewed,” “clinically reviewed,” approval badges or professional credentials without written sign-off on the exact content version. These study diagrams do not require adding a new exercise demonstration.

## Review each figure in context

| Figure ID | Editorial job | Keep visible beside the finding |
| --- | --- | --- |
| `break-frequency-protocol` | Explain the study's activity, conditions and timing. | The study population, laboratory setting and measured time window; walking is not stretching; a tested interval is not an official recommendation. |
| `break-frequency-interpretation` | Separate what the selected evidence supports from what it leaves unresolved. | No official guideline sets a break interval. DeskBreak's three-minute format is a product choice, not an experimentally proven optimum. |
| `eye-break-mnemonic` | Explain the familiar 20-20-20 memory aid. | The numbers describe the mnemonic; they are not proven biologically optimal values or a treatment for an eye condition. |
| `eye-break-study` | Explain the study sequence and distinguish reported symptoms from clinical measurements. | The same 29 people completed two baseline weeks without reminders, two weeks with reminders and a one-week follow-up. There was no separate control group. |
| `standing-desk-trial` | Explain the trial groups and follow-up. | A behavioral programme plus a desk is a combined intervention. Its result cannot be assigned to the desk alone. |
| `standing-desk-results` | Present the checked outcome and its uncertainty accurately. | Preserve the outcome unit, time point, comparison and direction. Reduced sitting time does not by itself establish a long-term health benefit. |

For each figure, compare the desktop SVG, mobile SVG, WebP exports, manifest transcript and HTML rendering. All must express the same finding. A shorter mobile layout may reorder material, but it must retain the relevant qualification and source.

The standing-results artwork expresses reductions as positive “fewer minutes”; the source data table preserves the published negative differences. These are equivalent only when the labels and confidence limits are interpreted consistently. Preserve the table's explanatory note and do not change a sign or interval endpoint in isolation.

## Source check before publication

- [ ] Match every manifest evidence identifier to an existing `data/evidence.json` record and to the actual paper title. Confirm that the DOI resolves to that paper.
- [ ] Open the original source, record the supporting abstract passage, table or figure location, and check the population, study design, activities, comparator and time point.
- [ ] Compare each plotted value with the source. Keep confidence intervals, units, rounding and effect direction consistent. Use the final manifest data, never estimated pixel positions or a new reconstruction from memory.
- [ ] Check captions and the HTML transcript against the same source. Preserve study qualifiers beside the claim rather than only in the references section.
- [ ] Treat any quotation as verbatim source text. Prefer clear paraphrases in diagrams; do not turn a paraphrase into a quotation.
- [ ] Recheck surrounding prose in the three articles for contradictions introduced or exposed by the figures. Record the final content review date separately from any clinician review.

The existing source registry's `verified` flag is not proof that this editorial pass occurred. Reuse the package's documented source checks where they apply; repeat them when a claim or value changes. The source ledger records successful DOI identity checks for all three papers, full texts for the walking and standing trials, and indexed publisher methods/results for the eye study. Direct publisher retrieval failures remain recorded separately. A successful DOI identity check is not the same as obtaining the full paper.

## Adjacent prose requiring attention

In `does-the-20-20-20-rule-work`, replace the existing paragraph beginning “The objective measurements didn't change” before publishing the eye-study figure. The source check confirmed improvement in accommodative facility, so the current paragraph's claim that the eyes did not measurably change is too broad. Use this replacement prose, which is a paraphrase rather than a study quotation:

> Dry-eye signs did not improve over two weeks; most binocular vision measures did not change, although accommodative facility improved.

Append `{cite:talens-estarelles-2023}` to that paragraph and distinguish reported symptoms from clinical measurements. Do not imply causation from the uncontrolled design. This is a required correction for the eye pilot, not an unresolved request for an expert's name.

Expand the first study paragraph to include the two-week baseline without reminders before the two weeks with reminders and the one-week follow-up. All phases involved the same 29 people, without a separate control group. Across the article's metadata description, study section, reminder interpretation and any accompanying caption, describe symptom improvements after reminders stopped as **not clearly sustained**. Replace “the improvement was gone,” “came back once they stopped,” and any equally categorical statement about disappearance or causation. Preserve the distinction between what this design observed and what it can establish.

In `are-standing-desks-worth-it`, the pilot chart reports adjusted total daily sitting at 12 months versus usual practice. Use that exact outcome and comparator throughout the section, caption, labels and accessible table. The final manifest holds the estimates and confidence intervals. Preserve the programme-plus-desk wording; do not apply this trial's values to the earlier review or to a desk bought without the programme.

In `how-often-should-you-get-up-from-your-desk`, keep the study protocol visibly separate from the practical choices near “So what should you do?”. Do not let the new visual make the existing 20–30-minute discussion read as an official or universally optimal interval.

These corrections are part of reconciling the three pilot articles, not an invitation to expand the PR into a broad medical-content rewrite. If an unsupported claim cannot be resolved, remove or narrow that claim and record the reason.

## Copy and accessibility rules

Use DeskBreak's existing plain language and brand. Do not add promises of pain relief, reduced or prevented injury, corrected posture, or replacement of regular exercise. Keep any practical movement instruction consistent with setup restrictions, discomfort guidance, both-side timing and the stop rule. Do not add a new routine or silently change a movement to match an illustration.

Every figure needs concise alternative text identifying its purpose, a visible caption and linked source names. Longer explanations belong in accessible HTML. For numeric results, include the exact data as a semantic HTML table with row and column labels. Do not make the image the only way to access a finding. On a phone, the reader must be able to understand the figure without zooming or horizontal page scrolling.

The supplied figure transcript is content, not a hidden SEO field. Render it visibly or within an ordinary keyboard-operable “Read figure details” disclosure. Keep source links outside a closed disclosure. Avoid repeatedly announcing identical alt text, transcript and caption through excessive ARIA attributes.

Use a genuine `updatedAt` date when the revised article is released. Do not overwrite its original `published` date or change dates on every build. Add a personal author or reviewer only when the person's name, role and permission are known. Preserve existing reference lists, guardrails, pain notes and product calls to action.

## Separate follow-up tickets

These are later projects, not dependencies for rendering the six figures:

1. **Complete the illustrated research catalog.** Reuse the pilot format for the remaining five articles, then select distinct new questions from the research-library report. Assign research and review owners before setting a production cadence.
2. **Verify acquisition-to-completion measurement.** Choose the reporting system, verify receipt on localhost or a preview, and avoid counting the two existing completion event names twice. Do not add analytics changes to the figure PR.
3. **Prepare shareable versions and distribution.** Adapt approved figures into useful cards or printables with sources and readable qualifications. Review asset-specific permissions. Outreach requires separate authorization; no outreach has been sent.
4. **Formalize author and review information.** Add real author profiles, a corrections route and documented review scope as those details become available. A name or credential must never be invented to satisfy a layout.

## Handoff verification

**PASS:** three current article bodies, their headings, content types, citation validation, renderer and existing metadata inspected for this handoff.

The completed asset/source/repository checks are consolidated in QA.md and SOURCES.md. **NOT RUN:** clinical review and application implementation/integration tests. Asset and gallery checks do not constitute application verification. No article or application file was changed by this handoff.
