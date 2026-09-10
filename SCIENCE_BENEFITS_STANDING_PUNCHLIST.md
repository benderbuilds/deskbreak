# Punch list — Science benefits + Standing 2-min visual
Frozen tokens only. Fitness owns benefit copy; this is **where/how** it surfaces.

## A. Science-backed benefits (2 / 5 / 10 min)

### Placement (light education, not a textbook)
1. **Home program cards** — one muted benefit line under each tagline (max ~70 chars).  
   - Free hero (2-min): always visible  
   - Pro cards (5 / 10): visible even when locked (builds desire)
2. **Program / Active pre-start** (if sheet exists) or top of Active first step — optional chip `Why this helps` → expands 1–2 sentences (collapsed by default so one-tap start stays intact).
3. **Onboarding** — one beat only (after Goal or on First-win screen): single sentence + three tiny duration pills (2 · 5 · 10) with one-line benefit each. No extra full essay screens.
4. **Done screen** — rotate a soft research-flavored closer under the headline (wry, not clinical). e.g. slot for Fitness string `doneBenefit`.
5. **Library** (P2) — filter chip or section footer “Why micro-breaks?” linking to a short in-app sheet (same copy source).

### Content model (eng) — **FILLED by Fitness**
```ts
type DurationBenefits = {
  "2": { cardLine: string; detail: string; doneLine?: string };
  "5": { cardLine: string; detail: string; doneLine?: string };
  "10": { cardLine: string; detail: string; doneLine?: string };
};
```

### Fitness copy (ship this)

```json
{
  "2": {
    "cardLine": "Short moves ease stiffness and nudge alertness.",
    "detail": "Research on active microbreaks suggests ~2–3 minutes of light movement can ease desk discomfort and help you stay sharper than sitting locked in one pose. Tiny resets also stack — how often you break up sitting matters, not just gym minutes.",
    "doneLine": "Two minutes well spent. Your joints just got a meeting break."
  },
  "5": {
    "cardLine": "Open hips and chest; wake energy mid-day.",
    "detail": "Five minutes is enough to undo the laptop shape — hips, chest, upper back — and light standing work helps circulation after a sit block. Active breaks are also linked with less perceived fatigue than unbroken desk time.",
    "doneLine": "Midday unkink complete. Blood moved. Brain slightly less mush."
  },
  "10": {
    "cardLine": "Full desk-chain reset after a heavy sit day.",
    "detail": "A longer circuit hits neck to calves in one pass — a real sit-interrupt, not just a stretch snack. Breaking up long sitting with light movement is studied for comfort and for how the body handles a sedentary day; breathe out slow at the end to leave work mode calmer.",
    "doneLine": "Full-stack cleanup done. The chair can have you back — briefly."
  }
}
```

**Onboarding beat**
- Line: `Quick resets beat heroic workouts you’ll skip.`
- Pills: `2` → `Interrupt the sit` · `5` → `Posture + energy` · `10` → `Full-day cleanup`

**Why-this-helps sheet title:** `Why two minutes still count`  
(detail body = duration’s `detail` string)

**cardLine lengths:** 2=52 · 5=42 · 10=48 (all ≤70)

### UI treatment
- Card line: `text-sm text-ink/55` (or `text-white/75` on coral hero)  
- Expand sheet: paper surface, Fraunces title `Why two minutes still count`, Inter body, mint accent rule — no new colors  
- Icon: tiny spark / clock glyph optional; **not** a medical cross

### Waiting on
~~Fitness benefit copy for 2 / 5 / 10.~~ **DONE** — also in `SCIENCE_BENEFITS_STANDING_COPY.json` + catalog v7 `durationBenefits`.

---

## B. Standing 2-min = distinct program visually

**Program id:** `desk-reset-2min-standing` · `setup: "standing"` · **Free**  
**Seated pair:** `desk-reset-2min` · `setup: "seated"` · coral hero

### Visual differentiation (frozen system)
1. **Card chrome**
   - Seated 2-min: coral fill hero (`featuredCoral`)  
   - Standing 2-min: **white/paper card + coral border (2px) + coral label** `Standing · 2 min` (`featuredOutline`)
2. **Badge** — mint-soft pill `At the desk · standing` (never “advanced”)
3. **Stretch art** — hero `standing-posture-reset` (not seated idle)
4. **Icon row** — standing glyph vs chair glyph on seated card
5. **Home layout** (Jesse Sep 10: **encourage standing by default**)
   - Default / unknown / `setup === "standing"`: **standing** 2-min featured (Free); seated → `Prefer seated?`  
   - `setup === "seated"` only when user explicitly chose seated: seated coral hero; standing → `Prefer standing?`  
   - Never twin coral blocks
   - Onboarding first-win defaults to `desk-reset-2min-standing` unless they picked seated moves
6. **Active** — kicker `Stay tall. You’re already up.`
7. **Library** — separate row with standing badge

### Standing program steps (Fitness SoT)

| # | exerciseId | dose |
|---|---|---|
| 1 | standing-posture-reset | 20s |
| 2 | chin-tuck | 8 (+ standing positionCue) |
| 3 | unshrug | 6 × 3s |
| 4 | standing-hip-flexor | 15s/side |
| 5 | calf-raise | 10 |
| 6 | standing-glute-squeeze | 8 × 3s |
| 7 | standing-wrist-shake | 15s |
| 8 | long-exhale-reset | 3 breaths |

Full JSON: `/workspace/deskbreak/SCIENCE_BENEFITS_STANDING_COPY.json` and catalog `/workspace/deskbreak/exercises-and-programs.json` (v7).

### Eng notes
- Program id + `setup: "standing"` from catalog  
- Reuse `ProgramCard` variants: `featuredCoral` | `featuredOutline`  
- Entitlement: standing 2-min stays **Free**

---

## C. Ship order
| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Benefit string slots on Home cards + types | Eng | slots ready |
| 2 | Fitness copy for 2/5/10 | Fitness | **DONE** |
| 3 | Standing 2-min card variant + Home feature swap by setup | Eng + Fitness catalog | **id + JSON ready** |
| 4 | Onboarding one-liner + duration pills | Eng (copy from Fitness) | **DONE** |
| 5 | Done benefit rotation | Eng | **doneLine ready** |
| 6 | Why-this-helps sheet | Eng P2 | title + detail ready |

## Out of scope
New colors · dense PubMed pages · guilt streaks · native only.

## Status
- Fitness copy: LANDED → `SCIENCE_BENEFITS_STANDING_COPY.json`
- Eng/cloud: clear to wire slots + standing outline card
- Standing-first Home default: LOCKED (Jesse)
- Standing dual SVGs: chin-tuck-standing±b, long-exhale-reset-standing±b LANDED


## D. Standing-first default (overrides §B.5)
**Home layout (standing-first default — Jesse PRIORITY)**
   - **Default / unknown setup / standing:** feature **standing 2-min** (`desk-reset-2min-standing`, Free `featuredOutline`); seated is secondary text `Prefer seated?` — **not** the other way around  
   - **Only if user explicitly chose seated:** feature seated coral hero (`desk-reset-2min`); standing becomes `Prefer standing?`  
   - Onboarding / first-run free win: lean **standing** Desk Reset; clear seated alternate path  
   - Never twin coral heroes. Stretch art matches the **featured** program (`stretch-idle-standing` when standing is featured)  
   - Soft standing nudge in taglines/startPrompt OK; one-tap start intact
