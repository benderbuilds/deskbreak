# DeskBreak free-reset redesign

## Implementation specification and handoff

**Owner:** Jesse Bender  
**Date:** September 22, 2026  
**Audience:** Claude Code implementing changes in the DeskBreak repository  
**Status:** The owner approved the cobalt-and-sunshine color direction and requested this detailed handoff. This document specifies the implementation; it does not claim that the changes have shipped.  
**Repository baseline inspected:** `739f552`, on `main` at the time of review. Reconcile with the current repository before implementation.  
**Visual reference:** [Approved color and homepage concept](assets/deskbreak-cobalt-concept.html).

### Read this first

Implement a cleaner, more professional DeskBreak that retains the existing movement character and a small amount of office humor. Optimize first for discovering, starting, completing, and returning to the free product. Paid conversion follows demonstrated value.

Use the cobalt palette specified here. The reference includes exploratory alternatives in its source, but the production app must not gain a palette picker. The reference is a visual study, not production code or the complete user flow. Its preview-only dialog, fixed sample timer, external-link behavior, and annotation controls must not be copied into the app. The icon in the reference predates the requested icon recoloring; Section 4 is authoritative for all brand assets.

Read `AGENTS.md` and `README.md` before editing. This spec supplements them. Existing security, account ownership, recommendation safety, scheduling, billing, and data-preservation rules remain mandatory.

## 1. Goals, priorities, and scope

### Product priorities

1. A new visitor immediately understands that DeskBreak is a free, guided, three-minute movement break that runs in a browser.
2. A new visitor can enter the reset without an account, payment information, app installation, or a required personalization questionnaire.
3. The first-run safety step remains effective, optional answers remain optional, and movement does not start behind it.
4. A completed reset leads naturally to a return invitation instead of a series of enrollment screens.
5. Returning users see their actual activity acknowledged.
6. Pro is presented as added planning and convenience once the product has shown value.
7. Every brand surface, including favicon and installed-app icons, uses the approved visual identity.

### Delivery order

| Phase | Deliverable | Priority |
| --- | --- | --- |
| A | Global visual system, complete icon family, homepage, mobile free-start access, matching public-page styling | Ship first |
| B | First-run expectation copy, completion flow, truthful reminder invitation, Today completion state | Next |
| C | Routine sharing, social previews, concise plan comparison, funnel instrumentation and final cross-surface checks | Complete the handoff |

All three phases are in scope. They can be separate reviewable commits or PRs. Finish each phase with its acceptance checks; do not describe later phases as implemented when only Phase A exists.

### Explicitly outside this project

- Price changes, new subscriptions, trials, entitlement changes, a paywall before the first free reset, or removal of existing free features.
- A new recommendation algorithm, changes to exercise duration or dose, or rewriting movement-safety advice.
- New reminder channels or scheduling infrastructure. This project clarifies and presents existing capabilities.
- Database redesign, authentication changes, a new analytics vendor, a UI framework replacement, or a new animation library.
- New health claims, invented testimonials, invented user counts, claims of clinical review, or urgency unsupported by real product terms.
- Publishing campaigns, sending email, purchasing services, merging a PR, or testing against production.

## 2. Findings that motivate the changes

These observations came from the live homepage at desktop and phone widths, the live neck-and-shoulder guide, a local first-reset walkthrough, and the inspected source. Conversion impact has not been measured.

| Observed behavior | Required response |
| --- | --- |
| The hero CTA says “Start my reset”; free access is not prominent. | Put “free” in the main action and explain the free offering plainly. |
| At phone width, the tall demo follows substantial copy and five focus chips. | Shorten the hero, use a compact demonstration, and put optional focus choices after it. |
| Five research summaries are the first section after the hero. | Explain the product experience and free access before the detailed evidence. |
| The long homepage has no closing free-start CTA or persistent mobile action. | Add a closing CTA and a contextual mobile start bar. |
| “No questions” precedes the safety screen. | Describe the quick safety check accurately and preserve all protections. |
| Feedback is followed by a focus question and an email request before the return prompt. | Make the return prompt available immediately after feedback. |
| Today asks for another reset immediately after one has finished. | Show a prominent, truthful completed-today state. |
| Reminder limitations are mostly explained after enabling them. | Explain the channel and delivery limitations before the user opts in. |
| The existing mark has a locked source image; icons, metadata, email, and social images contain slate colors separately. | Preserve mark geometry and explicitly update every output and cache reference. |

## 3. Approved visual system

### 3.1 Color tokens

Keep the existing semantic CSS-variable API where possible. Components already use `paper`, `sheet`, `ink`, `muted`, `pen`, and related tokens. Add the few missing semantic roles rather than scattering literal colors through JSX.

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Page background | `--paper` | `#F7F9FC` | Cool, almost-white canvas |
| Main surface | `--sheet` | `#FFFFFF` | Cards, inputs, navigation |
| Primary text | `--ink` | `#18233D` | Deep navy text and strong structural elements |
| Secondary text | `--muted` | `#536078` | Supporting copy that still needs to be read |
| Primary action | `--pen` | `#3155D9` | Main buttons, links, active navigation, logo background |
| Action hover | `--pen-hover` | `#2748C1` | Hover state for cobalt buttons |
| Action pressed | `--pen-deep` | `#2443B5` | Pressed state; not a thick button pedestal |
| Soft accent surface | `--accent-soft` | `#EDF0FF` | Demo background, selected-row tint, small supporting accents |
| Celebration accent | `--note` | `#FFE08A` | Small celebratory notes and character accents |
| Decorative divider | `--line` | `#DCE2EC` | Nonessential card boundaries and separators |
| Essential control edge | `--line-strong` | `#78859D` | Input/control outlines where their shape is needed to identify them |
| Error or caution text | `--signal` | `#B4233C` | Existing error/caution role; never the default accent |
| Focus ring | `--focus` | `#3155D9` | Visible focus on light surfaces |
| Workout surface | `--field` | `#18233D` | Calm, dark workout background |
| Drained workout surface | `--field-drained` | `#111C33` | Existing countdown-field treatment |

Do not repurpose the pale divider color as the only boundary of a white input on a white page. Do not put white text on yellow or pale lavender. Decorative legacy `mist`, `rose`, and `teal` tokens need not become additional prominent brand colors; keep them only where a real chart or existing illustration needs them. Preserve original character artwork unless a specific surface requires a small presentation adjustment.

Checked reference pairings: white on cobalt is approximately 6.12:1; muted text on the page background is approximately 6.01:1; navy on yellow is approximately 12.09:1. Recheck actual rendered states, including opacity, hover, error, focus, and workout controls. The pairings are not a blanket accessibility certification. Normal text must meet 4.5:1; qualifying large text must meet 3:1. [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

### 3.2 Typography, geometry, and motion

- Retain Archivo through the existing `next/font` setup. Do not add a font service or a second font family.
- Use normal width for body copy, labels, buttons, navigation, and most card headings. Use the condensed cut selectively for short display headings and the workout timer.
- Suggested desktop hero: 56–64 px, weight 800, line-height about 1.05. Phone hero: 38–44 px with intentional wrapping. Do not achieve fitting by shrinking important copy below readable sizes.
- Body copy: 16–18 px. Supporting UI copy: 14 px. Small metadata: 12–13 px only when it is genuinely secondary. Form input text remains at least 16 px on phones.
- Use 12–14 px corner radii for controls and 18–22 px for main cards. Not every text group needs a card.
- Remove thick bottom shadows and 3 px button jumps. Use color change plus a restrained pressed state. Preserve disabled and loading states.
- Retain a generous 44 px minimum interaction target, with 52 px primary buttons where space permits.
- Use 20–24 px phone page gutters and a centered desktop content width around 1,040–1,120 px. Retain the app's desktop rail and mobile bottom navigation.
- Keep whitespace purposeful. Shorten repeated copy instead of packing more text into smaller type.
- Keep animation to the movement demonstration and brief responses to deliberate actions. Respect `prefers-reduced-motion` everywhere. No looping confetti, bouncing CTAs, parallax, or scroll-reveal dependency.
- Feedback buttons for Worse, About the same, and Better must have equal visual weight. Do not color Better as the preferred answer.

### 3.3 Personality

The existing character, Stretch, carries the personality. Use occasional office humor such as “Your 37 open tabs can wait.” Limit the hero to one such line, visually subordinate to the promise and action. Completion can be playful when the person did not report discomfort. Safety, error recovery, billing, and negative feedback stay literal and calm.

Do not substitute emoji or an unrelated generated mascot for the locked brand mark or movement illustrations.

## 4. Logo, favicon, installed-app icons, and cache handling

### 4.1 Preserve the locked mark

`scripts/locked-mark-source.png` is the canonical, owner-approved silhouette. `scripts/generate-icons.py` currently recolors that original source and generates the raster family; `scripts/generate-icons.mjs` wraps it. Preserve the silhouette, pose, proportions, and recognizable square mark. Recolor its background to `#3155D9`, keeping the figure white and preserving antialiased edges. Do not redraw, rotate, add a yellow background, or invent a new logo.

Change the generator's `MARK` value to `(0x31, 0x55, 0xD9)` and update stale slate-specific comments. Generate from the locked source, not by repeatedly recoloring already-downscaled output. Continue using the existing pipeline and its Pillow dependency; no remote image service is needed for this deterministic asset update.

### 4.2 Required outputs

| Path | Required size or content |
| --- | --- |
| `public/icons/logo-mark.png` | 128 × 128, for the visible application mark |
| `public/favicon-16.png` | 16 × 16 |
| `public/favicon-32.png` | 32 × 32 |
| `public/favicon.ico` | Real multi-resolution ICO containing 16, 32, 48, and 64 px entries |
| `public/favicon.svg` | Regenerated matching mark; the existing embedded-raster SVG wrapper is acceptable, but do not call it a newly drawn vector logo |
| `public/apple-touch-icon.png` | 180 × 180, opaque cobalt background |
| `public/icons/icon-192.png` | 192 × 192, manifest purpose `any` |
| `public/icons/icon-512.png` | 512 × 512, manifest purpose `any` |
| `public/icons/icon-512-maskable.png` | 512 × 512, opaque full-bleed cobalt with protected central artwork |

For the maskable asset, all important white mark geometry must fit within the centered circle whose radius is 40% of the image width. Check both circular and rounded-square masks; an 80%-wide bounding square alone does not establish safety. [Maskable icon guidance](https://web.dev/articles/maskable-icon).

Keep the ordinary and maskable assets separate. Inspect favicons at their actual 16 and 32 px sizes, not only enlarged. If the original mark loses readability at the smallest size, adjust raster sampling or padding without changing its silhouette.

### 4.3 Update all consumers

- `src/components/LogoMark.tsx`: visible site/app mark.
- `src/app/layout.tsx`: every favicon and Apple icon reference; viewport `themeColor` becomes `#3155D9`.
- `src/app/manifest.ts`: background `#F7F9FC`, theme `#3155D9`, and all three icon references. Preserve `start_url`, scope, shortcuts, and app identity.
- `public/sw.js`: cached shell icon URLs and push notification `icon`/`badge` references.
- `src/lib/reminders.ts`: in-tab notification icon.
- `src/lib/og-image.tsx`: the local mark used by social images.
- Inspect `src/app` for file-based icon conventions at implementation time. Do not leave a second favicon source silently overriding metadata.

Use the existing colored notification icon for this release. A platform may render notification badges as a monochrome mask; do not promise cobalt will appear in that OS-controlled treatment or add a new badge design to this scope.

### 4.4 Prevent stale branding

The service worker caches `/icons/*` before the network, so replacing image bytes alone is insufficient.

1. Introduce a stable release asset version, `cobalt-1`, in a small `src/lib/brand.ts` module. Export a URL helper or constants used by TypeScript consumers; do not add a token build system.
2. Append `?v=cobalt-1` to public-facing brand image URLs in metadata, manifest, `LogoMark`, and notifications. Keep the physical files at the existing paths, so legacy direct URLs still resolve to new artwork.
3. In the plain service-worker file, use the same literal version for icon URLs and change its cache name to `deskbreak-v3-cobalt-1`.
4. Keep the server-side social-image `readFile` path as a physical path without a query string. The regenerated PNG is what that renderer reads.
5. Verify both a clean browser and an existing service-worker client after normal update/reload. Check that progress, settings, sessions, and sign-in remain intact.

Do not clear local storage, IndexedDB, accounts, or user data to refresh icons. Do not rename the manifest or change the application's identity. Installed launcher icons can be subject to OS refresh timing; report the actual device result rather than claiming universal immediate refresh.

## 5. Homepage and public acquisition surfaces

### 5.1 Approved hero copy

| Element | Copy |
| --- | --- |
| H1 | Sit all day? Take three minutes. |
| Supporting copy | A free, guided movement break you can do right at your desk. Follow along, then get back to your day. |
| Primary CTA | Start my free reset |
| Reassurance | 3 minutes. No signup. No equipment. |
| Optional playful line | Your 37 open tabs can wait. |
| Demo title | 3-minute Desk Reset |

The hero CTA must use the real existing `/app/start?minutes=3&source=landing` path through the attribution-aware link utilities. Header and closing generic free-reset CTAs must explicitly request 3 minutes as well, so an old preferred Pro duration cannot contradict the free-three-minute promise. Do not introduce a preview dialog or extra decision screen between this CTA and the existing first-run safety flow.

Update root metadata and the homepage social card to reflect free guided desk breaks. Keep topic-specific SEO titles and existing canonical URLs. Update obsolete “No questions” or instant-movement promises on surfaces touched by this work; “No signup” remains accurate.

### 5.2 Layout and section order

Desktop:

```text
Logo                         Research   Blog   Open app   Start free

Headline + short explanation          Compact reset demonstration
Free CTA + reassurance                Character + cue + timer
One small humorous note               Preview controls

Optional focus links
How it works
What you can do free
Brief research reassurance with Science link
Small Pro introduction and comparison
Existing guide/blog discovery links
Closing free-reset CTA
Footer and safety disclaimer
```

Phone:

```text
Logo                         Start free
Headline
Short explanation
Start my free reset
3 minutes. No signup. No equipment.
Compact demonstration
Optional focus links
How it works
Free offering, research, optional Pro, guide links
Closing free-reset CTA
```

- Keep the main CTA visible in the initial 390 × 844 phone viewport at default text size.
- At 320 px, allow natural wrapping and scrolling without clipping or horizontal overflow.
- At 390 × 844, the compact demonstration should begin in the first viewport. Remove the humor line on narrow screens if needed; do not shrink the CTA or reassurance.
- Do not repeat the complete neck/shoulders/back/wrists/hips/legs list in both the hero subhead and a start card.
- Keep all existing focus shortcuts. Put them below the demonstration on phones and subordinate to the main action on desktop.
- Preserve indexable guide links. Do not remove content routes or replace searchable content with client-only navigation.

### 5.3 Compact movement preview

Refactor `WorkoutDemo.tsx` into a compact, browser-native product preview rather than a tall phone frame. Continue deriving its exercises, order, duration, and step count from the actual free routine and `CharacterArt`. Do not hardcode six forever or copy the concept's static sample values into production.

Show the movement character prominently, the catalog's movement name, a short existing cue, a timer, and meaningful progress. Keep the compact preview around 280–330 px tall on a 390 px phone where content permits.

Provide Pause/Play for any autoplay preview and an explicit next-preview action. When a person changes the preview manually, pause autoplay so it does not immediately override their choice. Use a static first frame under reduced motion. Stop background work while the page is hidden and avoid running the loop when well outside the viewport. If the timer is accelerated, label it “Preview, sped up.” If the preview is paused, label that state accurately.

A preview must never create a workout session, start the real engine, submit feedback, change preferences, or emit real workout-start/completion events. Do not send screen readers timer updates every animation tick. Retain meaningful static alternative text and labeled controls.

### 5.4 Explanation and free offering

“How it works” uses three short steps:

1. **Start with a quick safety check.** No account to create.
2. **Follow the guided moves.** Clear cues, illustrations, and a timer. Use the current catalog count if displaying a number.
3. **Tell us how it went.** One tap helps shape the next reset.

Use a compact free-access section with the heading **“A useful desk break, free.”** Explain unlimited short resets, the daily three-minute reset, and targeted free options that actually exist. Include **“No trial countdown. No card needed for free resets.”** Do not promise a permanent lifetime pricing policy.

For research, retain a short explanation and at most one or two existing, relevant cited findings. Preserve qualifiers and citations from the existing evidence model. Link prominently to Science. Do not rewrite a study into a claim that DeskBreak itself produces that outcome. Do not fabricate social proof to fill the space.

Close with **“Your next three minutes are ready.”** and the same **“Start my free reset”** CTA.

### 5.5 Mobile persistent action

Add a small reusable marketing start bar for the homepage and applicable guided-reset landing pages, visible below 768 px only.

- Start hidden. Reveal after the user passes the main free CTA and no equivalent free-start action is visible.
- Hide while the main or closing free CTA is visible. Use intersection observation instead of high-frequency scroll polling.
- On intent pages, preserve the same need, setup, free duration, routine, and attribution as that page's main CTA. A neck-page sticky CTA must not start a generic reset.
- Use the existing link abstraction and meaningful analytics placement values such as `landing_sticky` or `seo_neck-shoulder-exercises_sticky`.
- Account for safe-area insets and reserve enough bottom space to reach footer links.
- Do not cover an input, focused element, modal, or the app's bottom navigation. This bar belongs to marketing surfaces only, not workouts or `/app`.
- Retain functional server-rendered CTAs when JavaScript or intersection observation is unavailable. The sticky enhancement may remain hidden in that case.

## 6. First reset, completion, and returning users

### 6.1 First-run safety

Keep `WorkoutScreen` gating `WorkoutView` so the engine, timer, cues, and real start events begin only after the safety step is accepted. Preserve `needsSafetyCheck`, the existing seen key, every safety flag, and all downstream recommendation exclusions.

Use the heading **“A quick check before you move.”** Keep `STOP_RULE` and `FIRST_RUN_SAFETY_NOTE` unchanged. Keep **“Go easy on (optional)”** and clarify **“Select any that apply, or start when you’re ready.”** All flags remain visible and reachable; do not hide them behind an accordion to improve conversion. No answer is required.

The continue button can remain **“Start my reset”** because free access has already been established. Keep it reachable without covering the last option.

Remove the unrelated floor-work opt-in from this first desk-reset screen. Keep it in You/settings. Preserve any existing explicit floor-work preference, keep the default false, and never silently turn it on. Any future floor-routine entry must honor the existing opt-in contract.

### 6.2 Post-reset state flow

Replace the default sequence `feedback → focus → save → wrap` with:

```text
Actual reset completes
    ↓
Feedback, with equally styled Worse / About the same / Better
    ├─ Worse or painful movement → existing safety follow-up → quiet summary
    └─ Better / About the same → completion summary + immediate return invitation
                                 ├─ optional reminder action
                                 ├─ optional personalization disclosure
                                 ├─ optional Save my progress link
                                 └─ Back to Today
```

- Keep the existing honest time calculation from `activeSecondsFor`, `formatActiveTime`, and `sessionMovedLabel`. A skipped-through routine is not “3 minutes moved.”
- The return invitation is visible on the first summary after feedback, without answering a focus question or entering email.
- Keep a persistent, reachable **“Back to Today”** exit on the summary. No reminder or signup action is required.
- Move focus selection into an optional **“Personalize my next reset”** disclosure on the summary. Selecting a need must not launch another enrollment step.
- Use the existing `/app/save` page for the optional **“Save my progress”** action rather than maintaining a second forced account wizard. Keep magic-link, nonce, merge, and rate-limit behavior unchanged.
- Honor existing save/reminder dismissal state. No repeated prompt on every navigation.
- When reminders are already enabled, show the truthful enabled state or a link to manage them instead of a new permission request.
- Keep the weekly summary and optional five-day challenge below the return invitation. Avoid a stack of competing large cards.
- For Worse or a recorded painful movement, do not show celebration, humor, reminder enrollment, share prompts, challenges, or Pro promotion. Preserve the body-area follow-up and any existing clinician guidance. A neutral return-to-Today action remains available.
- Refreshing or revisiting Done must not duplicate session creation, feedback, celebration sounds, or prompt analytics. A missing session shows a neutral route back to Today.

### 6.3 Reminder invitation: truthful before consent

Use **“Make it a daily break.”** as the default heading so Friday, weekends, or a non-working day do not produce a false “tomorrow” promise. A day-specific heading may be shown only when derived from existing working-day and timezone information.

This is a presentation change over existing behavior, not a delivery redesign:

| State | Required explanation and action |
| --- | --- |
| Anonymous Free, notifications supported | Before enabling: “A weekday reminder around {time} while DeskBreak is open.” The action explicitly enables this daily reminder. Ask browser permission only after that action. |
| Browser permission denied or unavailable | Explain that reminders appear inside DeskBreak while it is open. Do not repeatedly request permission or claim background delivery. Provide the existing in-app behavior. |
| Signed-in Free | Explain both effects before the action: an in-app reminder at the chosen time while open, plus the existing weekday-afternoon email. Do not imply the email arrives at the chosen browser time. |
| iPhone/iPad or unsupported native notifications | Do not make installation a prerequisite for the in-app reminder. Do not claim installation alone grants Free background push. Present install help only for the capability that actually needs it. |
| Pro with a plan | Retain the existing plan and push setup. Describe planned reminders separately from the free daily reminder; do not overwrite the plan or imply it follows the daily chosen time. |
| Already enabled | Show what is enabled and a Manage reminders action. Do not request permission again on render. |

Keep success and failure messages specific. A locally stored preference is not proof that an email was delivered or a push subscription succeeded. Preserve working-day, profile-timezone, opt-in, and deduplication rules. Do not add or change scheduler jobs.

### 6.4 Today after a completed reset

Use the existing activity/insight helpers to derive the completed-today state. Do not infer completion merely from having opened a workout or from `firstResetComplete` without checking today's activity.

| State | Display |
| --- | --- |
| No completed reset today | The normal recommended free reset and Start action |
| At least one completed reset today | Prominent acknowledgement such as “Today’s reset complete.” and the measured total time moved today |
| Multiple resets today | Accurate reset count and summed measured active time |
| A recent Worse/painful outcome | Neutral acknowledgement and relevant existing safety notice; no celebratory language |
| Pro with a genuinely due planned break | Keep that due action visible; completion acknowledgement must not suppress the plan |

For completed-today users, label the still-available routine action **“Do another reset”** and lower its urgency. Show a next reminder or planned break only if one is actually configured. If no reminder exists, offer an optional daily-break setup rather than inventing a schedule.

Respect the established local-day helpers for anonymous activity, and the existing profile/plan timezone semantics where applicable. Do not compare raw UTC date substrings or change the scheduler's clock. Verify midnight and Friday-to-Monday cases. An acknowledgement of one completed reset is not advice that no further movement is needed that day.

### 6.5 Workout presentation

Update the workout skin to the navy field with white text, a pale illustration surface, cobalt interaction accents where they have sufficient contrast, and a small yellow progress accent. Keep the timer highly legible. A draining field must not put a distracting line through instructions; use the existing progress bar if necessary to preserve readability.

Keep pause, next, previous, skip, swap, “Doesn’t feel right,” keyboard shortcuts, audio controls, elapsed-time behavior, wake lock, side-switch cues, dose labels, resume behavior, and stop-rule visibility intact. This redesign does not alter routine sequencing or timing.

## 7. Free, Pro, sharing, and discovery

### 7.1 Plan comparison and Pro timing

Keep the existing offer threshold of three resets rated Better, repeat-offer suppression, server-authoritative entitlement, and the visible Continue free action. Check `DoneView.tsx` before modifying offer rendering so its existing logic is preserved.

Use a concise comparison grounded in current behavior:

| Capability | Free | Pro |
| --- | --- | --- |
| Quick and daily short resets | Included | Included |
| Targeted free resets | Included | Included |
| Five- and ten-minute routines | Not included | Included |
| Automated workday plan and planned push reminders | Not included | Included |
| Progress shown | Current free history window | Full history |

Do not market account creation or all cross-device saving as exclusively Pro: the code already supports free signed-in accounts and syncing behavior. Verify any finer personalization or library distinction against the implementation before displaying it.

Reuse `src/lib/pricing.ts` for all prices, periods, founding terms, and trial-dependent text. No hardcoded $39 or $5.99 copy in new components. Preserve existing terms and do not add a countdown, fake remaining-spots count, or a trial not configured in Stripe.

The homepage's free CTA remains stronger than its Pro teaser. On the Pro page, keep the workday preview, readable price/billing cadence, and an easy Continue free path. Do not run a live checkout to verify styling.

### 7.2 Share this reset

Add a small optional **“Share this reset”** action below the primary return action on the normal completion summary. Do not show it on the first-run safety screen, during a workout, or after Worse/painful feedback.

Share a public, canonical, crawlable page with a matching guided handoff, not a private workout URL:

| Reset need | Share destination |
| --- | --- |
| General | `/desk-exercises` |
| Neck and shoulders | `/neck-shoulder-exercises` |
| Back and hips | `/back-stretches-desk-workers` |
| Wrists and hands | `/wrist-exercises-desk-workers` |
| Posture / changing positions | `/posture-reset` |
| Energy, stress, or another need without a matching public page | `/` with generic free-reset wording |

Use a fixed mapping from the existing need enum; do not derive a URL from user-entered strings. Use `NEXT_PUBLIC_APP_URL` as origin, with the existing canonical fallback. No personalized recommendation id, account id, session id, email, safety flags, feedback, or originating visitor's UTM/ref values may appear in the shared URL or text.

Default share text: **“Try a free, guided 3-minute desk reset. No signup or equipment.”** For a supported targeted page, name that routine without implying a medical outcome.

Use `navigator.share` when available and triggered by the user. Fall back to copying the canonical link; if clipboard access fails, show a selectable URL and explicit copy guidance. Cancellation is not an error and must not automatically copy or send anything. A resolved native-share promise does not prove that a message was delivered. [Web Share API behavior](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).

No automatic messages, referral rewards, social posting integrations, or personal outcome cards.

### 7.3 Social images and other branded surfaces

- Refresh `src/lib/og-image.tsx` to the cobalt/navy/white/yellow system and the recolored mark. Keep 1200 × 630 output and local bundled fonts.
- On homepage and guided intent pages, make the free guided three-minute entry visible in the image's supporting text. A guide titled “5-Minute Office Workout” must still distinguish its free three-minute starter from the longer Pro routine.
- Keep article-specific headlines and evidence-oriented footnotes on blog/Science images. Do not replace research context with a misleading routine offer.
- Preserve layout support for long headlines, the existing hyphen-space fix, canonical URLs, and useful alt descriptions.
- Use the existing character where it improves a routine image, loaded from local assets without an external fetch. Do not invent therapeutic demonstrations.
- Apply the base colors to the existing email wrapper and CTA in `src/lib/server/email.ts`, including button contrast. Do not change sending logic, subjects, destinations, URLs, idempotency, consent, or delivery scheduling. Verify rendering locally without sending mail.

## 8. Measurement and event semantics

Do not claim a conversion improvement merely because this spec is implemented. Establish a before/after baseline using actual available analytics, excluding local, preview, automated, and internal review traffic.

| Metric | Definition |
| --- | --- |
| First-reset activation | Unique new visitors who finish their first real reset divided by unique new visitors in the same acquisition cohort |
| Movement-start rate | Unique first-time visitors who reach the actual mounted workout after the safety step divided by unique new visitors |
| Started-to-completed rate | Actual first reset completions divided by actual first movement starts |
| Next-working-day return | Activated visitors who return on their next configured working day; use weekday fallback only where no personal working days exist |
| Helpful resets per active user per week | Resets rated Better divided by active users for that week; preserve this existing north-star definition |
| Pro conversion | New paid subscriptions among returning users eligible for the Pro offer, with the attribution window reported |

Inspect current instrumentation before adding events:

- `primary_cta_clicked` already records placements and attribution. Keep its existing properties and add new placement values for sticky/closing actions.
- `recommendation_started` is emitted in `StartFlow` before the first-run safety gate. Do not use it as proof that someone began moving or silently change the meaning of its historical series.
- `reset_started` is emitted inside `WorkoutView`, after `WorkoutScreen` permits mounting. Use that actual-start event for the movement-start funnel.
- `WorkoutView` already owns a UUID `sessionIdRef`. Add its session id to start/completion analytics if needed for deduplication; use the existing UUID, not a new non-UUID API session id.
- Preserve recommendation id, source, need, duration, setup, identity, plan, and UTM fields on the established events. Do not transmit emails, safety flags, or free-text health information in new events.
- Add focused events only where needed: `return_prompt_viewed`, `return_prompt_dismissed`, `share_reset_clicked`, and `share_reset_result`. Define result values such as `native_invoked`, `copied`, `cancelled`, and `failed`; none means verified recipient delivery.
- Deduplicate prompt views per completed session. Rerenders must not inflate funnel counts. Preview animation never emits workout events.
- Existing `day_1_return` checks the previous calendar day; do not relabel it as next-working-day return. Create a separately named metric/query or additive event with the correct definition.
- Keep analytics non-blocking and disabled in local/test environments. Do not add a dashboard service or paid experimentation tool.

## 9. Repository implementation map

Paths are relative to the repository root. These are focused change locations, not permission to broadly refactor their unrelated behavior.

| Area | Existing files | Expected work |
| --- | --- | --- |
| Global appearance | `src/app/globals.css`, `src/components/Button.tsx`, `src/components/AppNav.tsx`, `src/components/AppShell.tsx` | Tokens, typography use, control treatment, app chrome |
| Brand assets | `scripts/generate-icons.py`, `scripts/generate-icons.mjs`, `scripts/locked-mark-source.png`, `public/favicon*`, `public/apple-touch-icon.png`, `public/icons/*` | Recolor from locked source and regenerate all outputs |
| Asset references | `src/components/LogoMark.tsx`, `src/app/layout.tsx`, `src/app/manifest.ts`, `public/sw.js`, `src/lib/reminders.ts` | Versioned image URLs, theme colors, cache refresh |
| Homepage | `src/app/page.tsx`, `src/lib/constants.ts`, `src/components/marketing/MarketingShell.tsx`, `WorkoutDemo.tsx`, `NeedCards.tsx`, `LandingCta.tsx`, `HeaderStartLink.tsx` | Copy, layout, real-data preview, free CTA consistency |
| Public intent pages | `src/app/[landing]/page.tsx`, `src/lib/seo-content.ts` | Matching sticky CTA and free-entry clarity; preserve content and metadata |
| First run | `src/components/SafetyCheck.tsx`, `src/components/WorkoutScreen.tsx`, `src/components/SettingsView.tsx` | Safety presentation, expectation copy, floor preference location |
| Completion | `src/components/DoneView.tsx`, `ReminderAsk.tsx`, `SaveProgressView.tsx`, `WeekSummary.tsx` | Immediate return invitation and optional follow-ups |
| Today/workout | `src/components/TodayView.tsx`, `WorkoutView.tsx`, `src/lib/insights.ts`, `src/lib/dates.ts` | Completed-today view and visual refresh using honest existing data |
| Pro | `src/components/PaywallView.tsx`, `src/lib/pricing.ts`, `src/lib/entitlements.ts` | Accurate comparison and styling; keep pricing/entitlements authoritative |
| Social/email | `src/lib/og-image.tsx`, all `src/app/**/opengraph-image.tsx`, `src/lib/server/email.ts` | Cohesive brand presentation without delivery changes |
| Analytics | `src/lib/analytics.ts`, `src/components/AnalyticsProvider.tsx`, relevant event call sites | Correct funnel semantics and additive UI events |

Small new files are appropriate for `src/lib/brand.ts`, a reusable `src/components/marketing/StickyStartBar.tsx`, and `src/components/ShareReset.tsx` with a pure share-URL mapping helper if it keeps rendering code clear. Avoid creating new dependencies or a general design-system framework.

## 10. Execution checklist

### Phase A: identity and acquisition

- [ ] Confirm the current branch/state; create a fresh implementation branch under `codex/` if needed. Preserve unrelated work.
- [ ] Apply tokens and button styles; audit hover, focus, disabled, error, and dark-workout variants.
- [ ] Recolor and regenerate the complete locked-mark asset family with `python3 scripts/generate-icons.py` or the existing Node wrapper.
- [ ] Update platform metadata, versioned asset references, service-worker cache version, social-image colors, and email presentation.
- [ ] Implement the approved homepage copy and section order while preserving the server-rendered start path and attribution.
- [ ] Replace the tall phone demo with the compact real-routine preview and accessible animation controls.
- [ ] Add the contextual mobile start bar, preserving intent-page destination parameters.
- [ ] Verify first-run entry, phone layout, asset sizes, favicon appearance, existing-client cache refresh, and public-page rendering.

### Phase B: first use and return use

- [ ] Update safety-screen framing without weakening stop guidance or flags; retain floor preference in settings.
- [ ] Change the post-feedback flow so the return invitation precedes optional personalization/account work.
- [ ] Verify the quiet path for Worse/painful outcomes and repeat visits to Done.
- [ ] Make the reminder channel and limitations clear before enabling it, including unsupported/denied/iOS states.
- [ ] Add accurate completed-today acknowledgement, keeping Pro's due-break behavior intact.
- [ ] Verify midnight, working-day, partial-duration, account, and already-enabled/dismissed states.

### Phase C: discovery, Pro, and handoff

- [ ] Add private-data-free routine sharing with native-share and clipboard failure/cancellation handling.
- [ ] Finish accurate social cards for homepage, intent pages, blog, and Science.
- [ ] Add the concise plan comparison and retain three-helpful-reset offer timing and Continue free.
- [ ] Verify event definitions and new CTA/prompt/share placements without recording review traffic in live analytics.
- [ ] Complete the regression/visual matrix below, update affected documentation, and provide review screenshots plus a PASS/FAIL/NOT RUN report.
- [ ] Open a PR after all required pre-push checks pass. Do not push to main or merge without the owner's instruction.

## 11. Acceptance criteria and test coverage

Use existing Playwright infrastructure. Prefer behavioral regression tests for the changed flows; do not add brittle tests that merely assert every color literal or every CSS class.

### A. Entry and activation

- A fresh visitor can see the free three-minute promise and primary CTA in the initial 390 × 844 viewport.
- Server HTML contains meaningful homepage copy and real start links before client hydration.
- Hero, header, closing, and sticky generic free CTAs request three minutes, even if a stored preference is five or ten minutes.
- All focus shortcuts keep their intended need/setup and cannot bypass the first-run safety step.
- The workout timer and real start event remain absent until the safety continue action.
- Choosing a Go easy on flag affects the very first resulting routine; floor moves remain excluded without opt-in.
- A mobile sticky action appears and disappears as specified and leaves footer/focus targets reachable.
- Preview pause/next behavior works, reduced motion is static, and the demo creates no real session or workout analytics.

### B. Completion and retention

- Better/About the same reaches the return invitation directly, without mandatory focus selection or an email form.
- Optional focus selection saves its preference and returns to the summary, not another gate.
- Back to Today is usable without signup or reminder opt-in.
- Worse and recorded pain preserve follow-up and suppression, with no promotional prompts or celebration.
- Already-enabled/dismissed reminder and account states do not repeatedly ask again.
- Denied and unavailable notification APIs are handled without false delivery success or repeat permission requests.
- Today reflects measured seconds/minutes, multiple resets, local date rollover, and relevant safety outcomes correctly.
- A Pro due break remains actionable even after another reset today.
- Existing resume, pause, swap, discomfort, side timing, and keyboard flows remain intact.

### C. Discovery and monetization

- Every shared URL is canonical, public, and free of private identifiers, feedback, safety flags, and inherited attribution.
- Native share is initiated only by a click. Cancellation does not trigger copying. Clipboard failure exposes a usable link.
- A public shared page has the correct title, preview image, and guided free-entry path.
- No early or newly mandatory paywall appears. The three-helpful-reset threshold and Continue free action still work.
- Display prices come from `pricing.ts`, and the comparison reflects actual entitlements and account capabilities.

### D. Brand and platform

- Visible logo, all favicon formats, Apple icon, PWA icons, notifications, social images, and email template colors are consistent.
- Icon outputs have their specified dimensions/formats and preserve the locked silhouette.
- The maskable icon survives its minimum safe-area crop, circle, and rounded-square masks.
- New metadata and manifest URLs return valid image responses locally/preview; no missing legacy asset path.
- Existing service-worker users receive refreshed icons without loss of progress or sign-in. Device-specific launcher refresh limitations are reported.
- Inspect light and dark browser tab chrome, even though the website remains a light theme.

### E. Accessibility, responsiveness, and performance

- Check widths 320, 390, 768, 1,024, and 1,440 px; phone portrait/landscape; keyboard-only use; and 200% zoom.
- No horizontal overflow, clipped CTA labels, obscured safety copy, hidden keyboard focus, or sticky-bar overlap.
- Check real rendered contrast, including low-emphasis copy and all control states. Color never carries meaning alone.
- Verify reduced motion, preview pause, form labels, dialog focus if any existing modal is touched, and descriptive link/button names.
- Check homepage, a long intent page, first-run safety, active/paused workout, normal/quiet completion, Today before/after a reset, Explore, Progress, You, and Pro.
- Keep critical imagery sized to avoid layout shifts. Do not load a video or large illustration library to explain a three-minute reset.
- Compare production-build homepage loading and layout stability against the current implementation with the same device/network settings. Label lab results as lab results; do not claim field performance from a dev server.

### Existing tests to update or extend

| Test file | Relevant coverage |
| --- | --- |
| `tests/first-visit.spec.ts` | Hero/CTA text, actual first-run safety sequence, post-feedback return flow, retained targeted links |
| `tests/home.spec.ts` | Updated Today states and existing home interactions |
| `tests/retention.spec.ts` | Reminder state, progress, optional account return, Pro/challenge interactions |
| `tests/helpers.ts` | `finishDoneFlow` must reflect the new summary without blindly clicking the first “Not now” |
| `tests/session.spec.ts` | Workout, discomfort, timing, and completion regressions |
| `tests/art.spec.ts` | Existing movement art integrity; add focused asset checks only where useful |
| `tests/checkout.spec.ts`, `tests/entitlement.spec.ts` | Existing Pro access, accurate price display, and Continue free behavior |

Add a focused sharing or branding spec if existing files would become unwieldy. Test user-visible transitions and data-preserving behavior. Do not replace a failing assertion with a weaker one simply because the redesigned flow differs; update it to assert the new requirement.

The current `completeReset` helper uses Next controls to finish quickly. It verifies the UI completion path, not three minutes of real movement. Keep honest elapsed-time assertions, and include one manual real-duration reset in the local walkthrough.

Tests that stub entitlement or notifications verify UI states only. They do not verify real billing, OS push delivery, or production mail. Label that distinction in the report.

## 12. Verification commands and environment

### Required before every push

```sh
npm run lint
npx tsc --noEmit
npm run test:server
npm run build
```

### Required for this redesign

```sh
npm run test:unit
npm test
npm run art:audit
npm run test:security
```

`test:security` is required because the scoped email palette update touches `src/lib/server/email.ts`. If implementation unexpectedly touches `store.ts`, `auth.ts`, deliveries, or `supabase/schema.sql`, run `npm run test:server:postgres` using the dedicated test harness and document why those changes were necessary. Do not broaden backend scope merely to implement this visual project.

Run all browser walkthroughs and tests against localhost or a preview. Use an in-memory or dedicated test store, disable live email/Stripe/push credentials, and explicitly set both `NEXT_PUBLIC_GA_MEASUREMENT_ID` and `NEXT_PUBLIC_POSTHOG_KEY` to empty strings for local/test builds and runtime. Do not assume the Playwright configuration already disables every analytics path. Follow the repository's local auth configuration only when account testing is needed.

For billing, use only a preview with test-mode keys if a real integration test is necessary. Keep Deployment Protection enabled unless a specifically named test requires an authorized temporary change, then restore it.

## 13. Non-negotiable preservation requirements

- Never change the browser storage key `deskbreak.app.v2` or reset visitor progress.
- Never change saved exercise ids or break existing `/moves/*` links. Keep aliases resolving as required by `AGENTS.md`.
- Keep session ids UUIDs. Never treat an analytics or recommendation identifier as an API session id.
- The signed cookie remains account identity. Email/profile/anonymous identifiers do not become authentication.
- Preserve magic-link single-use, expiry, nonce-bound preference/merge rules, and ownerless-only merging.
- Keep all movement-safety paths: new-user recommendations, authored/adapted routines, fallback, swaps, and uncomfortable-move replacement.
- Preserve both-side timing, switch cues, slot-appropriate dose labels, and the workout stop rule.
- Do not add health promises or imply desk breaks replace regular exercise. If existing evidence copy is moved, keep its source and qualifiers.
- Keep cron-job.org as the sole scheduler and retain claimed, deduplicated sends. Do not add GitHub schedule triggers or Vercel crons.
- No production database resets, destructive production tests, live checkout tests, or review-session production writes.
- No new paid service, plan upgrade, secret exposure, auto-emailing, or background self-check automation.
- Use a branch, preserve unrelated changes, never push to main, and merge only when the owner instructs it.

## 14. Definition of done and final handoff

The implementation is ready for review when the functional and visual criteria above are met, required checks pass, and the owner can review a coherent preview of all three phases.

Provide:

1. A PR describing the visitor's before/after experience and the implementation scope.
2. Desktop and phone screenshots of the homepage, safety step, normal and quiet completion, Today completion state, and Pro.
3. An icon contact sheet showing 16/32 px favicons at actual size, visible logo, 180/192/512 px outputs, and maskable crops.
4. An existing-client cache-update result, with progress-preservation and any actual OS icon-refresh limitation noted.
5. A concise analytics event map distinguishing CTA click, pre-safety recommendation selection, actual movement start, completion, and return/share prompts.
6. A verification report marking every check PASS, FAIL, or NOT RUN. Include environment and evidence. Never call a mocked integration verified.
7. Any remaining issue stated concretely with its user impact. No fabricated improvement percentages or performance scores.

Do not merge, deploy by changing the production branch, or schedule a follow-up monitor as part of the handoff.

## 15. Copy-and-paste instruction for Claude Code

> Implement the DeskBreak redesign specified in `docs/superpowers/specs/2026-09-22-free-reset-redesign.md`. Read `AGENTS.md` and `README.md` first. The owner selected cobalt and sunshine, with the existing locked logo recolored to match across favicon, app icons, and all brand surfaces. Use the included HTML only as a visual reference; do not copy its preview-only behavior. Work through Phases A, B, and C on a branch, preserve free access, movement safety, user data, authentication, billing, and scheduling invariants, and validate the listed acceptance criteria. Run required checks, provide screenshots and an icon contact sheet, and open a PR for owner review. Do not push to main, merge, run test activity on production, or claim measured conversion gains without data.

## 16. Status of this specification

- **PASS:** live desktop/mobile design review and local free-reset walkthrough completed before specification writing.
- **PASS:** implementation locations, locked icon source/generator, cache behavior, reminder limitations, and existing event/test structure inspected for this handoff.
- **PASS:** reference palette primary color contrast calculations and concept phone layout/preview interactions checked during design review.
- **NOT RUN:** implementation, product regression tests, billing, real email/push delivery, or conversion measurement for this proposed redesign.
- The original live review and visual concept are evidence for the design decisions, not acceptance proof for code that has not been implemented.

## 17. Reconciliation with the code, September 23 2026

The spec was checked against the repository before implementation began. It
describes the product it wants accurately; several of its descriptions of the
code as it stands are wrong. Where the two disagree, this section wins.

### Corrections to Section 3, tokens

`--field` and `--field-drained` do not exist. The workout screen uses `--pen`
for its fill and `--pen-deep` for the drained part, so recolouring `--pen` to
cobalt would turn the workout screen cobalt rather than navy. Phase A adds the
two field tokens before changing `--pen`.

### Corrections to Section 5, homepage

- The H1 is "Sitting all day? Do this.", not "Sit all day? Take three minutes."
- "No questions" exists only in a code comment in `StartFlow.tsx`. There is no
  such user-facing copy to remove.
- The header CTA (`HeaderStartLink.tsx`) and the focus chips (`NeedCards.tsx`)
  do not request `minutes=3`, and one manifest shortcut requests no duration.
  The spec's requirement stands; these are the places to fix.
- `WorkoutDemo.tsx` already derives its moves from the real free routine, stops
  while the tab is hidden, and renders a static frame under reduced motion. It
  needs pause/next controls and a "Preview, sped up" label, not a rewrite.

### Corrections to Section 7, Free and Pro

The comparison table is incomplete and partly wrong:

- Programs and exercises carry their own `access` field. Eight programs and
  about twenty-three moves are Pro-only, enforced in `entitlements.ts` and
  excluded from free recommendations. This is a real Pro difference the table
  omits.
- `FREE_HISTORY_DAYS = 14` was copy on the Progress page only. `buildInsights`
  never filtered by plan, so the limit did not exist. The claim has been
  removed rather than enforced, since entitlement changes are out of scope.
- Free accounts sign in and sync. `PRO_FEATURES` claimed sync and personalized
  resets as Pro; both have been removed.
- `FOUNDING_SPOTS` is a cap on the founding price ("$59/year after the first
  100 members"), not a remaining-spots countdown, so it is not the fake
  scarcity the spec prohibits. It is only honest if the price actually rises
  after 100 members. That is the owner's call, and nothing was changed.
- `posture` is a real `PrimaryNeed` and a Today target. The stale comment in
  `seo-content.ts` saying otherwise, and the now-redundant `LandingNeed` type,
  should be cleaned up when Phase C touches that file.

### Live defects fixed before Phase A

These were live on `main`, independent of the redesign:

1. A reset rated Worse still led to the focus question, the email prompt and
   the install prompt. Those asks are now suppressed for Worse and for a
   painful movement, as Section 6.2 requires.
2. `PRO_FEATURES`, the paywall plan preview, the You tab and the Progress
   upsell claimed sync and full history as Pro.
3. Progress counted active days by UTC date, so an evening reset could land on
   the wrong day. `activeDayKeys` in `insights.ts` now uses the local day.
4. Anonymous iPhone users were told to install the app to get reminders. The
   free daily reminder shows inside DeskBreak while it is open and needs
   neither an install nor notification permission, so it is now offered to
   everyone, with what it does stated before the button.
5. Revisiting Done re-fired `email_prompt_viewed` and replayed the celebration
   tune. Both are now marked once per session id (`src/lib/once.ts`).
6. The Playwright config did not set `NEXT_PUBLIC_GA_MEASUREMENT_ID`, so every
   test run built with the live GA property and sent hits to the owner's
   funnel. Both analytics keys are now empty in the test environment.

### Still open for Phase B

`ReminderAsk` keeps the "Same time tomorrow?" heading, which is wrong on a
Friday, and still returns nothing when a daily reminder already exists rather
than showing an enabled state with a Manage action. Section 6.3 covers both.
