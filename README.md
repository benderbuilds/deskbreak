# DeskBreak

DeskBreak keeps your desk day from catching up with your body.

Tiny guided movement breaks for stiff necks, tight backs, tired shoulders and
desk-brain. Free proves that two minutes makes you feel better. Pro removes the
work of remembering what to do and when.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional; everything below is opt-in
npm run dev
```

Open http://localhost:3000 at a phone-width viewport (~390px). Mobile is the
primary design target.

```bash
npm run lint
npm run build
npm test          # Playwright, mobile + desktop
npm run test:unit # content and art checks only, no server needed
```

## The shape of the app

There are two halves, and they are deliberately separate.

**Public, server-rendered, indexable** (`/`, `/desk-exercises/*`, `/guides/*`,
`/privacy`, `/terms`, `/support`). Nothing here reads local storage, so a
first-time visitor gets static HTML. Every SEO page ends in a button that starts
the matching guided reset rather than just describing one.

**The app** (`/app/*`). Personal state, excluded from the index.

### The activation funnel

```
/                       landing
  -> /app/start         "What needs attention right now?"  (one tap)
  -> (only if needed)   "Can you stand right now?"
  -> /app/workout/:id   the reset starts immediately
  -> /app/done          "Did that help?" -> email -> personalised Pro offer
  -> /app               home recommends what to do next
```

No account before the first reset, and at most two decisions to get moving.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| 2-minute resets for every problem area | Unlimited | Unlimited |
| Movement library | 23 moves | Full catalog |
| Longer programs (3, 4, 5, 10 min) | Locked but visible | Included |
| Workday plan | - | Yes |
| Reminders | One daily | Scheduled around your plan |
| Progress history | Last 7 days | Full |
| 7-Day Desk Reset | - | Yes |

Pricing lives in exactly one place: `src/lib/pricing.ts`, fed by env. Launch
prices are **$5.99/month** and **$39/year** (founding). Do not hardcode a price
anywhere else.

## Entitlement

Pro is server-backed. The flow is:

1. `POST /api/checkout` creates a Stripe Checkout Session and attaches the
   profile id.
2. `POST /api/stripe/webhook` writes `subscriptions` from Stripe's own status
   and period end. **Nothing else writes that table**, and no code path invents
   an expiry date.
3. `GET /api/entitlement` is what the client asks on load.

Local storage caches the answer for a fast first paint. It is never the source
of truth, and a v1 `plan: "pro"` blob is explicitly not carried forward by the
state migration. Settings has **Restore Pro** for a new device.

`SUPABASE_URL` and `SUPABASE_SECRET_KEY` are injected by the Supabase
integration for Vercel, so there is nothing to copy by hand on a deploy. Set them
in `.env.local` only to develop against a real project.

Without them the store falls back to an in-process map so local dev and CI work
with no credentials. That is not durable, `isDurable()` reports it, and the
webhook logs loudly about it. Production needs Supabase; apply
`supabase/schema.sql` once from the SQL editor.

Without Stripe keys, checkout returns 503 and the paywall shows "Pro checkout is
temporarily unavailable." Customers never see an environment variable name.

## Recommendation engine

One module decides what a user should do next: `src/lib/recommendation.ts`.

```ts
getRecommendedProgram({ need, setup, durationMinutes, recentExerciseIds, timeOfDay, pro })
```

Deterministic rules, no machine learning. It prefers a hand-authored catalog
program when one matches the context exactly, and otherwise assembles one from
the exercise pool. It will not hand a seated user a standing-only move, will not
hand a free user a Pro move, and keeps most of a routine on the topic the user
actually picked. All of that is enforced in `tests/recommendation.spec.ts`.

Feedback ("Did that help?") is stored per session in `sessions`. V2 only
collects it; a later version can rank routines by what worked for whom.

## Content

One canonical file: `data/exercises-and-programs.json`. Types in
`src/lib/types.ts`. Content bugs fail at import: a free program that references a
Pro exercise, or a step pointing at a missing exercise, throws during the build.

## Character art (Stretch)

`public/character/{exerciseId}.svg`, with an optional `{exerciseId}-b.svg`
second frame and an optional `{exerciseId}-standing.svg` for moves that read
differently on your feet.

Art resolves **by exercise id, from `data/art-manifest.json`**, which is
generated from the files actually on disk. There are exactly two outcomes: the
exercise's own artwork, or the neutral `stretch-fallback.svg`. It never borrows
another exercise's pose, because a wrong picture teaches a wrong movement.

```bash
npm run art:manifest   # after adding or removing any SVG
npm run art:audit      # lists moves with no dedicated art
```

The audit fails if a move used by a *free* program has no artwork. Free is the
product's proof; a generic blob there costs conversions. Pro-only gaps are
listed for an illustrator and fall back gracefully in the meantime.

Keep new art at 512x512 in brand colors: `#F7F4EF` paper, `#FF5A36` coral,
`#2DD4A8` mint, `#1C1917` ink. Stretch is a helpful adult coworker, not a
cartoon mascot.

## Analytics

`src/lib/analytics.ts` is the only place that talks to PostHog. Components call
`track("reset_started", {...})`. If PostHog is not configured, events queue
briefly and then drop; analytics never blocks a reset.

The funnel to watch:

```
landing_viewed -> primary_cta_clicked -> reset_started -> reset_completed
  -> reset_feedback_submitted -> paywall_viewed -> checkout_started -> checkout_completed
```

First-touch UTM attribution is written once and never overwritten, because that
is the number a channel experiment is judged on. Latest touch is tracked
separately.

## Reminders

Level 1 is email, because a browser tab is not open at 3 PM. `POST
/api/reminders/send` is meant to be called hourly by a scheduler with
`Authorization: Bearer $CRON_SECRET`, and sends through Resend.

DeskBreak does not claim to know you have been sitting, because it cannot.

## Stack

Next.js App Router, TypeScript, Tailwind CSS. Stripe for billing, Supabase for
persistence, PostHog for measurement, Resend for email. Every one of those is
optional in development.
