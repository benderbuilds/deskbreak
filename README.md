# DeskBreak

Mobile-first web app for one-tap desk breaks. No equipment. No account.

Office workouts and desk exercises you can do in 2, 5, or 10 minutes — at work or as a home workout routine for busy days.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use a phone-width viewport (around 390px) for the intended layout.

```bash
npm run build
npm start
```

## What’s in the MVP

- **Home** — greeting, streak, one-tap starts for Desk Reset (2 min), Lunch Reset (5 min), Busy-Day Circuit (10 min)
- **Active workout** — large timer, cue, next / skip / pause
- **Done** — celebration, streak update, copyable summary
- **Library** — all moves, filter by body area
- **Onboarding** — three skippable screens (stored in `localStorage`)

Progress (streak + last workout) is stored in the browser. There is no auth.

## Content

Swap or edit exercises and programs in:

```
data/exercises-and-programs.json
```

Types live in `src/lib/types.ts`. Programs reference exercise ids in order; each step has a `durationSec` so timings stay in the JSON.

## Stack

Next.js App Router, TypeScript, Tailwind CSS. Client-side workout engine. Basic PWA manifest and icons.
