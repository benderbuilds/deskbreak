# Free-reset redesign: handoff

Implementation of `docs/superpowers/specs/2026-09-22-free-reset-redesign.md`,
reconciled with the code in Section 17 of that spec. 23 September 2026.

## Branches

| PR | Branch | What it is |
| --- | --- | --- |
| #21 | `codex/free-reset-truthfulness-fixes` | Six defects that were live on `main`, independent of the redesign |
| #22 | `codex/cobalt-phase-a` | Visual system, icon family, homepage, phone start bar |
| #23 | `codex/phase-b` | Safety step, completion flow, reminder honesty, Today |
| #24 | `codex/phase-c` | Sharing, social cards, plan comparison, new events |

#23 stacks on #21 and #22; #24 stacks on #23. Merging in number order keeps
each diff small. Nothing has been merged or deployed.

## Analytics event map

Five different things used to be easy to confuse. They are now distinct:

| Moment | Event | Where |
| --- | --- | --- |
| Someone clicks a start button | `primary_cta_clicked` | Header, hero, focus chips, closing CTA, phone start bar. `cta` carries the placement (`landing_hero`, `landing_closing`, `landing_sticky`, `seo_<slug>_sticky`, `need_card`, `header`) |
| A routine is chosen, before the safety step | `recommendation_started` | `StartFlow`, `TodayView`. Not a movement start |
| Movement actually begins | `reset_started` | `WorkoutView`, after the safety gate lets it mount |
| The reset is finished | `reset_completed`, `recommendation_completed` | `WorkoutView` |
| The return invitation is shown or dismissed | `return_prompt_viewed`, `return_prompt_dismissed` | `ReminderAsk`, counted once per finished reset |
| A reset is passed on | `share_reset_clicked`, then `share_reset_result` | `ShareReset`. Results: `native_invoked`, `copied`, `cancelled`, `failed` |

None of the share results means a recipient received anything, and a resolved
native-share promise only means the sheet closed.

`day_1_return` still means "returned the next calendar day". The spec's
next-working-day metric is a different question and belongs in an analytics
query, not in app code: nothing here was relabelled.

## Verification

Run locally against a production build, with `NEXT_PUBLIC_GA_MEASUREMENT_ID`
and `NEXT_PUBLIC_POSTHOG_KEY` set to empty strings.

| Check | Result |
| --- | --- |
| `npm run lint` | PASS, 2 pre-existing warnings |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm test` | PASS, 340 tests, mobile and desktop |
| `npm run test:unit` | PASS, included in the full run |
| `npm run test:server` | PASS, 45 tests |
| `npm run test:security` | PASS, 9 tests |
| `npm run test:server:postgres` | NOT RUN. No change to `store.ts`, `auth.ts`, deliveries or `supabase/schema.sql` |
| `npm run art:audit` | PASS |
| Contrast of every token pairing | PASS, computed from the tokens; cobalt on the navy field is 2.6:1, which is why the field uses white and yellow |
| Icon dimensions, ICO entries, maskable safe area | PASS, measured on the generated files. Furthest mark pixel is 36.6% of width from centre |
| Horizontal overflow at 320, 390, 768, 1024, 1440 | PASS on `/`, an intent page, Science, Today, Explore, Progress, You and Pro |
| Existing service-worker client updating without losing progress | NOT RUN. Needs a deployed origin |
| Installed launcher icon refresh on a device | NOT RUN. OS-controlled timing |
| Real email, push or share delivery | NOT RUN. Nothing was sent |
| Live checkout | NOT RUN. No checkout was started |
| Conversion effect | NOT MEASURED. No before/after data exists yet |

Tests that stub entitlement or notifications verify the interface only. They
do not verify billing, OS push, or production mail.

## Known gaps

- **Keyboard-only and 200% zoom were not walked through.** The sweep measured
  layout overflow and target sizes, not focus order.
- **The founding offer** says "$59/year after the first 100 members". That is
  a price commitment rather than a fake countdown, so it was left alone, but
  it is only honest if the price actually rises after 100 members.
- **`FREE_HISTORY_DAYS` was removed rather than enforced.** The 14-day free
  limit existed only as copy. Enforcing it would be an entitlement change,
  which the spec puts out of scope.
- **Energy and stress have no public page**, so sharing those resets shares
  the homepage with generic wording.
- **The stale `LandingNeed` type** in `seo-content.ts` is now identical to
  `PrimaryNeed` and its comment is wrong. Left for a cleanup pass.
