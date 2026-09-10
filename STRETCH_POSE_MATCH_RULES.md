# Stretch pose-match rules (seated vs standing)

## Product rule
Stretch’s body position must match the workout: **chair Stretch for seated programs/moves**, **upright/no-chair Stretch for standing**.

## Asset naming
| Pattern | Meaning |
|---|---|
| `{exerciseId}.svg` | Default teaching master (often seated for shared neck/breath moves) |
| `{exerciseId}-standing.svg` | Standing / no-chair variant |
| `{exerciseId}-b.svg` / `{exerciseId}-standing-b.svg` | Motion pair, same posture family |
| `stretch-idle.svg` | Seated Home / brand idle |
| `stretch-idle-standing.svg` | Standing Home featured card |
| `stretch-done-standing.svg` | Optional Done when last program was standing |

## Eng selection
```
function characterSrc({ exerciseId, setup, stretchAsset, programId }) {
  const standing =
    setup === "standing" ||
    programId === "desk-reset-2min-standing" ||
    stretchAsset?.includes("standing");
  // Prefer explicit catalog stretchAsset / stretchAssetStanding when present
  if (standing && exists(`/character/${exerciseId}-standing.svg`))
    return `/character/${exerciseId}-standing.svg`;
  return `/character/${stretchAsset ?? exerciseId + ".svg"}`;
}
```

Shared moves needing dual art: `chin-tuck`, `long-exhale-reset`  
(use `-standing` suffix when `program.setup === "standing"`).

## Home cards
- `desk-reset-2min` → `stretch-idle` or first seated move  
- `desk-reset-2min-standing` → `stretch-idle-standing` or `standing-posture-reset`

## Shipped standing set (this drop)
`stretch-idle-standing`, `stretch-done-standing`, `standing-posture-reset`±b (no chair), `chin-tuck-standing`±b, `long-exhale-reset-standing`±b, `unshrug`±b, `standing-hip-flexor`±b, `calf-raise`±b, `standing-glute-squeeze`±b, `standing-wrist-shake`±b  

Path: `/workspace/deskbreak/public/character/`
