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
| 2 min Desk Reset | Unlimited | Unlimited |
| 5 min Lunch Reset | Locked | ✓ |
| 10 min Busy-Day Circuit | Locked | ✓ |
| Library | 10 moves | All 32 |
| Streak | Basic | Streak + XP |
| Reminders | Onboarding presets | Custom hour |
| Celebration themes | Classic | Classic / confetti / spark |
| Badge | — | Pro |

**Pro pricing:** **$47.99 / year** (shown as “less than $4/month, billed annually”). Optional comparison strikethrough vs $8.99/mo.

Entitlement (`plan`, `proExpiresAt`) is stored in `localStorage` on this device. There is no login.

## Stripe Checkout

Live charging is **opt-in**. The paywall always looks production-ready. It only redirects to Stripe when both env vars are set:

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PRICE_ID=price_...
```

Create an **annual subscription** price of $47.99 in Stripe and paste the Price ID.

- Success: `/paywall/success?session_id=...` verifies the session, then unlocks Pro.
- Cancel: back to `/paywall`.
- Missing keys: Checkout returns 501. **No fake charges.**

### Demo unlock (overnight / local)

Shown when `NODE_ENV !== "production"` **or** `NEXT_PUBLIC_DEMO_UNLOCK=true`:

**Unlock Pro for demo** — sets `plan: pro` in localStorage for a year. Use this to try the full app tomorrow morning without Stripe.

## What’s in the app

- **Landing** — SEO hero for first-time visitors
- **Onboarding** — hook, promise, goal / setup / reminder, honest social proof, then a forced-nudge 2-min Desk Reset before the paywall
- **Paywall** — Free vs Pro, Subscribe annually, Continue on Free
- **Home** — greeting, streak, one-tap 2-min reset, locked Pro circuits
- **Active workout** — large timer, cue, next / skip / pause
- **Done** — celebration (Pro themes), streak, copyable summary
- **Library** — filter by body area; Pro locks on gated moves
- **Settings** — reminders, plan, replay onboarding
- **PWA** — manifest, icons, install prompt when the browser offers it

## Content

Swap exercises and programs in:

```
data/exercises-and-programs.json
```

Types: `src/lib/types.ts`. Free move ids: `src/lib/constants.ts`.

## Stack

Next.js App Router, TypeScript, Tailwind CSS. Client workout engine. Stripe Checkout only if configured.
