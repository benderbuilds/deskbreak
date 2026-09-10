# DeskBreak

Mobile-first web app for one-tap desk breaks. No equipment. No account.

Office workouts and desk exercises you can do in 2, 5, or 10 minutes — at work or as a home workout routine for busy days.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional; demo unlock works in `next dev` without this
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) at a phone-width viewport (~390px).

```bash
npm run build
npm start
```

Production `npm start` hides the demo unlock unless `NEXT_PUBLIC_DEMO_UNLOCK=true`.

## Free vs Pro

| | Free | Pro (annual) |
| --- | --- | --- |
| Onboarding + Home | ✓ | ✓ |
| 2 min Desk Reset (seated + standing) | Unlimited | Unlimited |
| 5 min Lunch Reset | Locked | ✓ |
| 10 min Busy-Day Circuit | Locked | ✓ |
| Library | 15 moves | Full catalog |
| Streak | Basic | Streak + XP |
| Reminders | Onboarding presets | Custom hour |
| Celebration themes | Classic | Classic / confetti / spark |
| Badge | — | Pro |

**Pro pricing:** **$74 / year** (50% off list **$148 / year**; shown as “less than $7/month, billed annually”). Stripe Price ID stays in env (`NEXT_PUBLIC_STRIPE_PRICE_ID`).

Entitlement (`plan`, `proExpiresAt`) is stored in `localStorage` on this device. There is no login.

## Stripe Checkout

Live charging is **opt-in**. The paywall always looks production-ready. It only redirects to Stripe when both env vars are set:

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PRICE_ID=price_...
```

Create an **annual subscription** price of $74 in Stripe and paste the Price ID.

- Success: `/paywall/success?session_id=...` verifies the session, then unlocks Pro.
- Cancel: back to `/paywall`.
- Missing keys: Checkout returns 501. **No fake charges.**

### Demo unlock (overnight / local)

Shown when `NODE_ENV !== "production"` **or** `NEXT_PUBLIC_DEMO_UNLOCK=true`:

**Unlock Pro for demo** — sets `plan: pro` in localStorage for a year. Use this to try the full app tomorrow morning without Stripe.

## What’s in the app

- **Landing** — SEO hero for first-time visitors
- **Onboarding** — hook, why 2·5·10 helps, required goal + work setup, optional reminder (defaults off), then a 2-min Desk Reset before the paywall. Standing-desk setup features a distinct standing 2-min program (not seated swaps). Goal can still reorder Desk Reset (neck-first / energy-first).
- **Paywall** — Free vs Pro, Subscribe annually, Continue on Free
- **Home** — greeting, goal + setup chips, Start nudge, featured 2-min reset (outline coral when standing), Prefer seated/standing, locked Pro circuits with benefit lines
- **Active workout** — large timer, Stretch illustration (optional motion frames), cue, next / skip / pause
- **Done** — Stretch celebration + short chime, streak, benefit closer, copyable summary
- **Library** — Stretch thumbnails; filter by body area; Pro locks on gated moves
- **Settings** — reminders, plan, replay onboarding
- **PWA** — manifest, icons, install prompt when the browser offers it
- **Stretch** — SVG coach in `public/character/` (see below)

## Character art (Stretch)

Lanky abstract adult desk human — coral accent, ink line, paper-flat, wry not cute. Name + cue stay primary; art is extra. Workout shows a large stage above the cue (tap the art for a bounce that never covers Next / Skip / Pause). Library uses a small thumbnail. Missing files fall back to `stretch-fallback.svg`, then to the nearest body-area pose.

Drop replacements in `public/character/` using the **catalog exercise id**:

```
public/character/{exerciseId}.svg
public/character/{exerciseId}-b.svg   # optional second motion frame
public/character/stretch-idle.svg
public/character/stretch-done.svg
public/character/stretch-locked.svg
public/character/stretch-fallback.svg
```

2-min Desk Reset ids: `chin-tucks`, `shoulder-rolls`, `seated-cat-cow`, `wrist-circles`, `seated-figure-four`, `box-breathing`. Free library also ships `neck-nods`, `finger-fans`, `seated-marches`. Other moves reuse the closest body-area file until a dedicated SVG exists. Mapping lives in `src/lib/character-art.ts`. Keep 512×512, brand colors (`#F7F4EF` paper, `#FF5A36` coral, `#2DD4A8` mint, `#1C1917` ink).

## Content

Swap exercises and programs in:

```
data/exercises-and-programs.json
```

Types: `src/lib/types.ts`. Mark each exercise and program with `"access": "free"` or `"pro"` in the JSON; entitlements read that field.

## Stack

Next.js App Router, TypeScript, Tailwind CSS. Client workout engine. Stripe Checkout only if configured.
