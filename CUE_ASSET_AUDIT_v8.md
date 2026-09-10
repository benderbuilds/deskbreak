# Cue + stretchAsset audit v8

## Shoulder rolls (Jesse priority)
**Before:** peeling sticky notes off your upper back  
**After:** `Slow shoulder circles: lift the shoulders up, roll them back, drop them down, then bring them forward. Reverse direction when cued.`

## Rule
Cues describe the actual motion. Metaphors only when they clarify (e.g. snow angel for wall-angels). Dropped cute lines that confuse.

## Shared moves (chin-tuck, long-exhale-reset)
Each has `setupVariants.seated | standing` with:
- cue (position-specific)
- stretchView
- stretchAsset / stretchAssetB
- assetStatus: shipped | needs_art
- fallbackAsset when needs_art

Program steps on `desk-reset-2min` and `desk-reset-2min-standing` now include resolved `stretchAsset` + `positionCue`.

## Designer asks (needs_art)
1. `chin-tuck-standing.svg` (+ `-b`) — side, standing
2. `long-exhale-reset-standing.svg` (+ `-b`) — side, standing
3. Optional: `shoulder-rolls-standing.svg`

Until art lands, eng uses `stretchAssetFallback`.

## Catalog
`/workspace/deskbreak/exercises-and-programs.json` v8
