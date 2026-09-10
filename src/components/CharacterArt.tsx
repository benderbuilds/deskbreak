"use client";

import { useEffect, useState } from "react";
import {
  NEUTRAL_FALLBACK,
  resolveExerciseArt,
  resolvePoseArt,
  type CharacterPose,
} from "@/lib/character-art";
import type { SetupId } from "@/lib/types";

const FALLBACK_SRC = `/character/${NEUTRAL_FALLBACK}.svg`;
const FRAME_MS = 900;

export function CharacterArt({
  pose = "idle",
  exerciseId,
  setup,
  animate = false,
  tappable = false,
  alt = "Stretch",
  className,
  size = 220,
}: {
  pose?: CharacterPose;
  exerciseId?: string;
  setup?: SetupId | null;
  animate?: boolean;
  tappable?: boolean;
  alt?: string;
  className?: string;
  size?: number;
}) {
  const art =
    pose === "exercise" && exerciseId
      ? resolveExerciseArt(exerciseId, setup)
      : {
          start: resolvePoseArt(pose === "exercise" ? "idle" : pose, setup),
          end: null,
          isFallback: false,
        };

  // Keying on the resolved art remounts the frame state instead of resetting it
  // from an effect, so switching exercises never shows a stale frame.
  return (
    <ArtFrames
      key={`${art.start}|${art.end ?? ""}`}
      start={art.start}
      end={art.end}
      isFallback={art.isFallback}
      animate={animate}
      tappable={tappable}
      alt={alt}
      className={className}
      size={size}
    />
  );
}

function ArtFrames({
  start,
  end,
  isFallback,
  animate,
  tappable,
  alt,
  className,
  size,
}: {
  start: string;
  end: string | null;
  isFallback: boolean;
  animate: boolean;
  tappable: boolean;
  alt: string;
  className?: string;
  size: number;
}) {
  const [showEnd, setShowEnd] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);
  const [bounce, setBounce] = useState(false);

  const canAnimate = animate && Boolean(end);

  useEffect(() => {
    if (!canAnimate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setShowEnd((on) => !on), FRAME_MS);
    return () => window.clearInterval(id);
  }, [canAnimate]);

  const intended = showEnd && canAnimate && end ? end : start;
  const src = broken === intended ? FALLBACK_SRC : intended;

  const visualClass = [
    "pointer-events-none select-none",
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
      alt={tappable ? "" : alt}
      width={size}
      height={size}
      draggable={false}
      data-art-fallback={isFallback ? "true" : undefined}
      onError={() => setBroken(intended)}
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
      aria-label={alt}
      className="relative z-0 rounded-[28px] outline-none focus-visible:ring-2 focus-visible:ring-coral"
    >
      {graphic}
    </button>
  );
}
