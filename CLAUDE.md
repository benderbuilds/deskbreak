# DeskBreak

Three-minute desk resets for people who sit all day. Next.js 16 App Router,
React 19, TypeScript, Tailwind 4, Supabase (PostgREST), Stripe, Resend, Web
Push. Live at https://deskbreak.co on Vercel Hobby. Read README.md for the
architecture; this file is the rules that are easy to get wrong.

## Commands

```
npm run lint                 # eslint
npx tsc --noEmit             # typecheck
npm run test:server          # server unit tests, in-memory store (fast)
npm run test:server:postgres # same suite on real Postgres via tests/postgres/
npm run test:security        # HTTP ownership and rate-limit suite
npm run test:unit            # engine, planner, migration, art
npm test                     # full Playwright suite, mobile and desktop
npm run build                # must pass before any push
npm run art:audit            # lists moves still on the neutral illustration
```

Before every push: lint, typecheck, `test:server`, and `build`. Run
`test:security` when touching anything under `src/app/api` or
`src/lib/server`. Run the Postgres suite when touching `store.ts`, `auth.ts`,
deliveries, or `supabase/schema.sql`.

## Identity and ownership

- The signed session cookie is the only thing that names an account. A
  caller-supplied email, profile id or anonymous id is never authentication.
- Anonymous browsers write only to their own shell profile. An anonymous id
  that belongs to a signed-in account gets nothing.
- Sign-in links are single use, expire, and are claimed atomically. Pending
  preferences and merges apply only when the link is opened by the browser
  that requested it, proven by the nonce cookie.
- Merging moves only ownerless data. Rows owned by another signed-in account
  never move. A paid shell profile keeps its Pro unless the nonce-verified
  flow moves it.
- Billing portal requires a session and resolves the Stripe customer from that
  account alone.

## Scheduling

- Exactly one scheduler: cron-job.org POSTs `/api/push/send` every 5 minutes
  and `/api/reminders/send` every 15 minutes with `Authorization: Bearer
  $CRON_SECRET`. `.github/workflows/scheduler.yml` is a manual fallback only.
  Never add a `schedule` trigger back and never add a `vercel.json` crons
  entry; GitHub fired hours late and Hobby only allows daily crons.
- Every send is claimed first as a `notification_deliveries` row with a unique
  dedupe key. Keep that invariant: no send without a claimed row.
- Decisions happen in the profile's time zone on its working days. Never read
  the runner's clock.

## Data and schema

- `supabase/schema.sql` is additive and idempotent over V2. Never drop or
  rename a column; add and migrate.
- The browser storage key `deskbreak.app.v2` in `src/lib/storage.ts` must never
  change. Renaming it orphans every visitor's local progress.
- Session ids are UUIDs. The `sessions.id` column is `uuid`; reject anything
  else at the API.
- Never reset the production database or run destructive suites against it.
  The test harness in `tests/postgres/` is the only place `DELETE` runs.
- Exercise ids appear in saved history, synced sessions and `/moves/*` URLs.
  When moves are merged or renamed, keep the old id resolving to the new one.

## Movement safety

- Every recommendation path respects discomfort, "Worse" outcomes and the
  "Go easy on" flags: first session, fallback, authored programs, adapted
  programs and swap candidates. A new path that skips these is a bug.
- "Doesn't feel right" replaces a move from a different body area or a
  breathing move, never a neighbour in the same region.
- Floor moves never appear in seated or standing desk routines unless the
  person opted in. Check `setup` and constraints when adding a move.
- Each-side moves get time for both sides and a switch cue. A dose label must
  fit the slot it is shown in.
- The stop rule is shown on the workout screen, not only on move pages.

## Health claims and evidence

- Every health claim on the site maps to a source in `data/evidence.json`
  whose DOI resolves to that paper. Check the DOI before adding a citation;
  one entry once pointed at an unrelated paper.
- Quotes are verbatim from the abstract or full text, with the study's own
  qualifiers kept ("in a lab trial", "reported", "small"). Summarise what the
  study tested, not what DeskBreak would like it to show.
- Only cite a study on a move page when that move, or a close analogue, was
  studied. No per-move evidence grades.
- Until a licensed PT signs off in writing on a pinned content version, never
  write: PT-reviewed, physical therapist approved, clinically reviewed or
  proven, an unqualified "evidence-based" badge, relief, reduces or prevents
  pain or injury, fix or correct posture, or any comparison implying desk
  breaks replace regular exercise. Posture copy is about changing positions;
  there is no single correct posture.
- No official guideline sets a break interval. Don't claim one.

## Configuration

- Production means `VERCEL_ENV=production` or `DESKBREAK_ENV=production`. In
  production the app refuses to run on the memory store or without an email
  provider; it reports `store_not_configured` or `email_not_configured`.
- Dev sign-in links (`AUTH_DEV_LINKS=1`) are returned only outside production.
- `NEXT_PUBLIC_*` values are public by design; everything else is a secret.
  Never print a secret in logs, tests, commits, PR bodies, or chat.
- Canonical origin is `NEXT_PUBLIC_APP_URL` (https://deskbreak.co). Code
  fallbacks also say deskbreak.co. `www` redirects to the apex.
- GA4 falls back to the live property when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is
  unset. Local and test runs set it to an empty string and leave
  `NEXT_PUBLIC_POSTHOG_KEY` empty, so the owner's funnel only counts real
  visitors. Local sign-in needs `AUTH_SECRET` plus `AUTH_DEV_LINKS=1`.
- Review and test flows run against localhost or a preview, never
  deskbreak.co: resets, ratings, sign-ins and push subscriptions there write
  production data.
- Sending address is `hello@deskbreak.co` through Resend; the mailbox forwards
  via Cloudflare Email Routing.

## Hosting

- Vercel Hobby, single project. Do not change the plan or add paid services
  without an explicit ask.
- Stripe production is live mode. Never run a checkout on production to test.
  Test billing on a preview deployment with test-mode keys.
- Preview deployments have Deployment Protection on. Turn it off only for a
  named test, and back on afterwards.

## Git

- Work on a branch, open a PR, merge only when the owner says so. No pushes
  to `main`.
- Commit messages: imperative subject, why in the body when it is not obvious.
  No model identifiers in commits, code, or comments.
- Never rewrite history on a shared branch. A merged branch is restarted from
  `main`, not reused.

## Session conduct

- Do not schedule self check-ins, wakeups, or routines unless the owner asks
  for them in that session. A watch on a PR ends the moment it merges.
- Give dashboard steps one at a time and wait for the result before the next.
- Report PASS, FAIL, or NOT RUN for every verification. Never substitute a
  mock and call it verified.
