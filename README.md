# DeskBreak

The workout for people who sit all day.

Short, guided workouts made for computer workers. No equipment. No planning.
Open DeskBreak, press Start, follow a three-minute reset, feel better, get back
to work. Underneath, DeskBreak learns which movements, lengths and times help
this specific person and increasingly makes the decision for them.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional; everything in it is opt-in
npm run dev
```

Desktop and phone are both first-class targets: the app uses a left rail at
wide widths and a bottom bar on phones, and never simply stretches the mobile
layout.

```bash
npm run lint
npx tsc --noEmit
npm run build
npm test          # Playwright, mobile + desktop, against a production build
npm run test:unit # engine, planner, migration and art checks; no server needed
npm run test:server   # sign-in tokens, ownership merges, delivery records, scheduler decisions
npm run test:security # ownership at the HTTP boundary, against the built server
npm run art:audit # fails if a free routine uses a move with no artwork
npm run push:keys # prints a VAPID key pair for Web Push
```

`GET /api/health` says which capabilities a deployment has (store, auth,
email, Stripe, push, cron) as booleans, and in production returns 503 with
`missingForProduction` until all of them are set. Nothing in it is secret.

## The shape of the app

**Public, server-rendered, indexable**: `/`, the intent pages (`/desk-exercises`,
`/office-workout`, `/desk-workout`, `/neck-shoulder-exercises`,
`/back-stretches-desk-workers`, `/wrist-exercises-desk-workers`,
`/standing-desk-exercises`, `/workplace-stretching`), the older
`/desk-exercises/*` and `/guides/*` pages, one page per movement at `/moves/*`,
`/science`, and the legal pages. Nothing here reads local storage. Every page
ends in a button that starts the matching guided reset, with the need and
length preloaded, so a visitor from a search result is moving within a second.

**The app** (`/app/*`), excluded from the index, with four destinations:

- **Today**: one recommended reset and a Start button, four targeted overrides
  (neck + shoulders, back + hips, wrists + hands, energy), a Change control for
  length and position, the next planned break, today's activity and a soft
  weekly summary. Two columns on desktop.
- **Explore**: recommended, by body area, by goal, by time, routines, every
  movement (searchable) and favourites. Each movement has a detail page.
- **Progress**: resets, active workdays, what helped, and patterns drawn only
  from the person's own answers. No XP.
- **You**: account, default reset, movements to avoid, workday plan,
  notifications, subscription, app preferences, science and help.

### The core loop

```
Today recommends a reset -> user presses Start -> guided workout
  -> "How do you feel?" (Better / About the same / Worse)
  -> DeskBreak learns -> next reset improves -> DeskBreak reminds them later
```

No account before the first workout. No questionnaire. The first time only,
after the first reset, DeskBreak asks where desk work usually lands and offers
to remember what works (a magic link by email).

## Content

Content lives in four JSON files under `data/`, never in components:

- `exercises.json`: the movement library. Each move carries its body areas,
  movement type (mobility, strength, isometric, aerobic, breathing, position
  change, eye break), the routine phases it can fill, functional constraints it
  conflicts with, a safer swap, cue, what you should feel, common mistake, make
  it easier, avoid-if, rationale and evidence category.
- `programs.json`: hand-authored routines, including the free 3-minute Desk
  Reset (seated and standing), the targeted 3-minute resets, the micro-breaks
  the planner uses, and the Pro 5- and 10-minute workouts.
- `templates.json`: routine templates by need and length, with phases (reset,
  mobilize, activate, move, return) and per-slot seconds.
- `evidence.json`: the curated reference list behind `/science`.

Content bugs fail at import: a free program using a Pro move, a move with a
constraint but no safer swap, a template whose seconds do not add up.

Character art resolves by exercise id from `data/art-manifest.json`. Run
`npm run art:manifest` after adding an SVG. Free routines must have dedicated
art; the audit enforces it.

## Recommendation engine

`src/lib/recommendation.ts` is the one place that decides what a user should do
next, and it is pure: no network, no storage. The same engine runs on the
server (`POST /api/recommendations`) and in the browser as the offline
fallback, so a reset never depends on a round trip.

For each slot in the template it scores eligible moves:

| Signal | Weight |
| --- | --- |
| Body-area / need relevance | 30% |
| Historical helpfulness | 25% |
| Routine structure fit | 15% |
| Preferences (position, intensity) | 10% |
| Avoiding repetition | 10% |
| Time of day | 5% |
| Variety | 5% |

Hard constraints override score: a move the user has asked to avoid, a
standing move for a seated user, a Pro move for a free user, or a move they
reported as uncomfortable is never shown. Routines are then sequenced so nobody
stands up, sits down and stands up again, scaled to the advertised length, and
validated (time, constraints, position, sequence, repetition, balance, access,
safety). If validation fails, an authored routine is used instead. The first
couple of resets use an authored routine on purpose: those are illustrated and
hand-sequenced, and there is nothing to personalize yet.

Every recommendation carries an id, `algorithm_version` (`3.0.0`), its inputs
and its exercises, stored locally and in `recommendations` +
`recommendation_exercises`, so a later outcome can be attributed to it.

### What it learns from

`src/lib/personalization.ts` turns history into signals: per-move completed,
skipped, swapped, discomfort, and how often sessions containing it were rated
better or worse; outcomes by position, need and time of day; the length a
person actually does; when they move. "Better" credits every completed move;
"Worse" debits them, twice for anything skipped or swapped. Two swaps or one
"doesn't feel right" suppresses a move. When someone clearly does better
standing, the engine says so on Today, occasionally.

## Workout

`src/lib/use-workout-engine.ts` keeps time against wall-clock timestamps, so a
throttled tab or a locked phone comes back to the right second. The screen
supports pause, next, previous, skip, swap, "Doesn't feel right" (swaps to the
safer alternative immediately, then optionally asks why), countdown tones,
spoken cues, optional auto-advance, Screen Wake Lock, reduced motion and the
desktop shortcuts Space, arrows and S. Every move's outcome is recorded in
`session_exercises`.

## Workday planner and reminders

Pro. The user gives their hours and how much help they want (minimal,
balanced, active); the planner turns that into a day of movement opportunities
in 30-minute windows: Desk Resets, stand breaks, walk breaks, eye breaks and an
afternoon energy reset. A reset done near a window satisfies it. Windows drift
toward the times a person actually responds and away from ones they ignore.
Skipping is a normal action.

Reminders are real Web Push: `public/sw.js` handles push and notification
actions (Start, 15 min, Skip); `POST /api/push/subscribe` stores subscriptions;
`POST /api/push/send` is the scheduler and `POST /api/reminders/send` the
daily email mailer, both behind `Authorization: Bearer $CRON_SECRET`. Push
needs VAPID keys from `npm run push:keys`. While the app is open, an in-tab
runner covers the same windows. Email is opt-in (the "Daily reminder" toggle
under You, for signed-in users) and goes out once per local day in the
14:00-16:00 window of the person's own time zone, on their working days.

### One scheduler

`.github/workflows/scheduler.yml` is the only scheduler. It calls both
endpoints every 15 minutes from GitHub Actions; set the `APP_URL` and
`CRON_SECRET` repository secrets to turn it on. Vercel Cron is not configured
(there is no `vercel.json` crons entry) and must not be added alongside it:
the Hobby plan only allows daily jobs, and two drivers for the same endpoints
is one too many.

The endpoints do not care when or how often they are called. Every send is
first claimed as a row in `notification_deliveries` with a unique dedupe key
(push: break, day, device and snooze attempt; email: profile and local day).
An overlapping run, a retried run, a run that fires late, or a run that fires
twice finds the claim and skips. Decisions are made in the profile's time
zone, never the runner's, so a delayed workflow inside the window still sends
and one outside it does not. Failed sends retry after a delay inside the same
record; a dead push endpoint is marked and never retried.

Reminder emails also carry a Resend `Idempotency-Key` derived from the
delivery record (`deskbreak-email-<id>`), and the rendered message is stored
on the record on the first attempt so a retry sends identical bytes under the
same key. Resend honours a key for 24 hours; retries are confined to the same
local-day window, well inside that. Sign-in emails use `deskbreak-login-<token
row id>` the same way.

## Accounts and sync

"Save my progress" sends a one-time sign-in link (`/api/auth/magic-link`,
`/api/auth/verify`). Opening it sets an HMAC-signed session cookie; there is no
password anywhere. For anonymous users the browser is the source of truth; for
signed-in users the server is, and local storage becomes a cache. Requires
`AUTH_SECRET`; in production also a durable store and an email provider, and
the API says which is missing (`store_not_configured`, `email_not_configured`)
rather than pretending a link was sent.

### Who may touch what

The rule for every endpoint: a caller-supplied email address, profile id or
anonymous id is not authentication. Only the signed session cookie names an
account.

- Requesting a link never changes an existing account. Preferences, movements
  to avoid and the browser's anonymous id travel on the token row and are
  applied only when the link is opened by the browser that asked for it,
  which proves that with a short-lived nonce cookie. Opened anywhere else, the
  link signs in and merges nothing.
- Merging moves only ownerless data (anonymous sessions, push subscriptions,
  recommendations, or a profile that never signed in). Rows that belong to
  another signed-in account never move. A device-bound Pro purchase moves only
  in the nonce-verified flow.
- Tokens are single-use, expire (`AUTH_LINK_TTL_MINUTES`, default 30), and are
  claimed atomically so two opens of the same link admit one.
- `/api/auth/me`, `/api/profile` (GET), `/api/planned-breaks` and the Stripe
  Customer Portal (`/api/billing/portal`) require a session. Anonymous
  browsers may write to their own shell profile only; an anonymous id that
  belongs to a signed-in account gets nothing.
- `/api/sessions` records ownership from the cookie alone; feedback and
  rewrites are accepted only from the row's owner.
- "Restore Pro" is a sign-in link. The address Stripe collected at checkout is
  kept as `billing_email` on the profile that paid and is claimed by a verified
  sign-in with that address; typing an address never unlocks anything.
- Outside production, `AUTH_DEV_LINKS=1` returns the link in the API response
  so the flow can be tested without email. Production ignores it.
- Link requests are rate limited through the database (`auth_requests`, hashes
  only), so the limits hold across instances: a resend cooldown per address
  measured from the last link actually sent (`AUTH_LINK_COOLDOWN_SECONDS`,
  default 60), an hourly cap per address (`AUTH_LINK_HOURLY_CAP`, default 5)
  and a more generous hourly cap per requester IP (`AUTH_LINK_IP_HOURLY_CAP`,
  default 30). A throttled request gets 429 `rate_limited` with `Retry-After`,
  identical for known and unknown addresses, creates nothing, and leaves
  existing links valid.

`tests/api-security.spec.ts` and `tests/server/*.spec.ts` are the regression
suite for all of the above. Both can run against a real Postgres instead of
the in-memory store (`tests/postgres/README.md`), which is how the unique
constraints and atomic claims were verified. `docs/acceptance-checklist.md` is
the staging pass with real Resend, Stripe test mode and push.

Local state is versioned (`APP_STATE_VERSION = 3`). The V2 blob migrates in
place, keeping history, feedback (mapped to better / same / worse), the plan
and the challenge, and rebuilds the personalization signals from history.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| 2-minute Quick Resets | Unlimited | Unlimited |
| 3-minute Daily Desk Reset | Yes | Fully adaptive |
| Targeted resets | Yes | Yes |
| 5- and 10-minute workouts | Visible, locked | Included |
| Movement library | Free moves | Full |
| Workday plan + Web Push | - | Yes |
| Reminders | One daily | Around your plan |
| Progress insights | Last 14 days | Full, synced |
| Favourites, 5-Day Desk Reset | Yes | Yes |

The paywall appears after DeskBreak has demonstrated something (three sessions
rated Better), leads with the person's own numbers, and sells automation and
personalization rather than locked stretches. Pricing lives in
`src/lib/pricing.ts`, fed by env. Subscription management goes through the
Stripe Customer Portal (`/api/billing/portal`), not a support email.

## Entitlement

Unchanged from V2 and deliberately so. `POST /api/checkout` creates the Stripe
session, `POST /api/stripe/webhook` is the only writer of `subscriptions`, and
`GET /api/entitlement` is what the client asks on load. Local storage caches
the answer with a short grace window and never decides it.

## Data

`supabase/schema.sql` is additive and idempotent over V2. Tables: profiles,
subscriptions, sessions, session_exercises, recommendations,
recommendation_exercises, functional_constraints, workday_preferences,
planned_breaks, favorites, push_subscriptions, login_tokens,
notification_deliveries. Without Supabase credentials everything falls back to
an in-memory store so local dev and CI work with no secrets. Production is
different: with `VERCEL_ENV=production` (or `DESKBREAK_ENV=production`) and no
store, sign-in and checkout refuse with `store_not_configured` instead of
saving to memory, and `/api/health` reports it.

## Analytics

`src/lib/analytics.ts` is the only place that talks to PostHog. Every
recommendation-level event carries recommendation id, algorithm version, need,
duration, position, program, source, anonymous/authenticated, free/pro and
generated/authored. The north-star metric is helpful DeskBreaks per active
user per week.

## Claims and safety

DeskBreak is general movement guidance for healthy desk workers. It does not
diagnose, does not treat, and does not say "fix your posture" or "clinically
proven". The science page and every movement page say what the evidence
looked at, not what DeskBreak does to your body. A licensed physical therapist
review of the library is planned before DeskBreak describes itself as
clinically reviewed; until then it does not.

## Stack

Next.js App Router, TypeScript, Tailwind CSS. Stripe for billing, Supabase for
persistence, PostHog for measurement, Resend for email, web-push for
notifications. Every one of those is optional in development.
