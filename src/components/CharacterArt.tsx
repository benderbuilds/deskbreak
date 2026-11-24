"use client";

import { useEffect, useRef, useState } from "react";
import {
  NEUTRAL_FALLBACK_SRC as FALLBACK_SRC,
  illustrationBackup,
  resolveExerciseArt,
  resolvePoseArt,
  type CharacterPose,
} from "@/lib/character-art";
import type { SetupId } from "@/lib/types";

const FRAME_MS = 900;
/** The neutral card is not a demonstration, so it must not be described as one. */
const FALLBACK_ALT = "No illustration yet; follow the written steps";

export function CharacterArt({
  pose = "idle",
  exerciseId,
  setup,
  animate = false,
  tappable = false,
  alt = "Stretch",
  mirror = false,
  className,
  size = 220,
}: {
  pose?: CharacterPose;
  exerciseId?: string;
  setup?: SetupId | null;
  animate?: boolean;
  tappable?: boolean;
  alt?: string;
  /** Flips the art horizontally, for the right-side step of a per-side move. */
  mirror?: boolean;
  className?: string;
  size?: number;
}) {
  const poseSrc =
    pose === "exercise" && exerciseId ? null : resolvePoseArt(pose === "exercise" ? "idle" : pose, setup);
  const art =
    poseSrc === null && exerciseId
      ? resolveExerciseArt(exerciseId, setup)
      : {
          start: poseSrc ?? FALLBACK_SRC,
          end: null,
          isFallback: false,
          isPhoto: Boolean(poseSrc?.endsWith(".webp")),
        };

  // Keying on the resolved art remounts the frame state instead of resetting it
  // from an effect, so switching exercises never shows a stale frame.
  return (
    <ArtFrames
      key={`${art.start}|${art.end ?? ""}`}
      start={art.start}
      end={art.end}
      isFallback={art.isFallback}
      isPhoto={art.isPhoto}
      animate={animate}
      tappable={tappable}
      alt={alt}
      mirror={mirror}
      className={className}
      size={size}
    />
  );
}

function ArtFrames({
  start,
  end,
  isFallback,
  isPhoto,
  animate,
  tappable,
  alt,
  mirror,
  className,
  size,
}: {
  start: string;
  end: string | null;
  isFallback: boolean;
  isPhoto: boolean;
  animate: boolean;
  tappable: boolean;
  alt: string;
  mirror: boolean;
  className?: string;
  size: number;
}) {
  const [showEnd, setShowEnd] = useState(false);
  // Frames that failed to load. A broken photo falls back to the illustration
  // it replaced, then to the neutral card.
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const [bounce, setBounce] = useState(false);

  const canAnimate = animate && Boolean(end);
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!canAnimate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Warm the end frame so the first swap doesn't flash an empty photo.
    if (end) new Image().src = end;
    const id = window.setInterval(() => setShowEnd((on) => !on), FRAME_MS);
    return () => window.clearInterval(id);
  }, [canAnimate, end]);

  const intended = showEnd && canAnimate && end ? end : start;
  const markBroken = (failed: string) => setBroken((seen) => new Set(seen).add(failed));
  const backup = illustrationBackup(intended);
  const src = !broken.has(intended)
    ? intended
    : backup && !broken.has(backup)
      ? backup
      : FALLBACK_SRC;
  const showingFallback = isFallback || src === FALLBACK_SRC;
  const showingPhoto = isPhoto && src.endsWith(".webp");

  // A server-rendered <img> can fail before hydration, when React isn't yet
  // listening for onError. Catch that case once mounted.
  useEffect(() => {
    const node = img.current;
    if (node?.complete && node.naturalWidth === 0) markBroken(src);
  }, [src]);
  // Decorative uses (alt="") stay decorative.
  const label =
    showingFallback && alt
      ? FALLBACK_ALT
      : isPhoto && !showingPhoto
        ? // The photo failed and Stretch stands in, so say so.
          alt.replace(/^Instructor /, "Stretch ")
        : alt;

  const visualClass = [
    "pointer-events-none select-none",
    mirror && !showingFallback ? "-scale-x-100" : "",
    // Photos carry their own room; round them so they sit in any frame.
    showingPhoto ? "rounded-[18%] object-cover" : "",
    bounce ? "animate-[tapBounce_420ms_cubic-bezier(0.34,1.4,0.64,1)]" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const graphic = (
    // Flat SVGs served straight from /public; next/image would only add a hop.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={tappable ? "" : label}
      width={size}
      height={size}
      draggable={false}
      data-art-fallback={showingFallback ? "true" : undefined}
      data-art-kind={showingFallback ? "fallback" : showingPhoto ? "photo" : "illustration"}
      ref={img}
      onError={() => markBroken(src)}
      onAnimationEnd={() => setBounce(false)}
      className={visualClass}
    />
  );

  if (!tappable) return graphic;

  return (
    <button
      type="button"
      onClick={() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        setBounce(true);
      }}
      aria-label={label}
      className="relative z-0 rounded-[28px]"
    >
      {graphic}
    </button>
  );
}
