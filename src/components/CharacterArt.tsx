"use client";

import { useEffect, useState } from "react";
import {
  characterSrc,
  hasMotionFrame,
  type CharacterPose,
} from "@/lib/character-art";
import type { BodyArea, SetupId, StretchView } from "@/lib/types";

const FALLBACK_SRC = "/character/stretch-fallback.svg";

export function CharacterArt({
  pose = "idle",
  exerciseId,
  bodyArea,
  stretchAsset,
  stretchAssetB,
  stretchView,
  setup,
  programId,
  animate = false,
  tappable = false,
  alt = "Stretch",
  className,
  size = 220,
}: {
  pose?: CharacterPose;
  exerciseId?: string;
  bodyArea?: BodyArea;
  stretchAsset?: string;
  stretchAssetB?: string;
  stretchView?: StretchView;
  setup?: SetupId | null;
  programId?: string;
  animate?: boolean;
  tappable?: boolean;
  alt?: string;
  className?: string;
  size?: number;
}) {
  const [frameB, setFrameB] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [motionDisabled, setMotionDisabled] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const [bounce, setBounce] = useState(false);
  const motion =
    animate &&
    !motionDisabled &&
    hasMotionFrame({
      pose,
      exerciseId,
      bodyArea,
      stretchAsset,
      stretchAssetB,
      setup,
      programId,
    });

  useEffect(() => {
    setFrameB(false);
    setUseFallback(false);
    setMotionDisabled(false);
    setFallbackFailed(false);
  }, [exerciseId, pose, bodyArea, stretchAsset, stretchAssetB, setup, programId]);

  useEffect(() => {
    if (!motion) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const id = window.setInterval(() => setFrameB((on) => !on), 720);
    return () => window.clearInterval(id);
  }, [motion, exerciseId, stretchAsset, stretchAssetB]);

  const intended = characterSrc({
    pose,
    exerciseId,
    bodyArea,
    stretchAsset,
    stretchAssetB,
    stretchView,
    setup,
    programId,
    frame: frameB && motion ? "b" : "a",
  });
  const src = useFallback ? FALLBACK_SRC : intended;

  function tapBounce() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setBounce(false);
    window.requestAnimationFrame(() => setBounce(true));
  }

  function handleImageError() {
    // Missing/bad master → stretch-fallback.svg. If that 404s too, mint blob
    // (never loop the img src back onto a failing URL).
    if (src === FALLBACK_SRC) {
      setFallbackFailed(true);
      return;
    }
    if (frameB && motion) {
      setFrameB(false);
      setMotionDisabled(true);
      return;
    }
    setUseFallback(true);
  }

  const visualClass = [
    "pointer-events-none select-none",
    bounce ? "animate-[tapBounce_420ms_cubic-bezier(0.34,1.4,0.64,1)]" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const graphic = fallbackFailed ? (
    <span
      aria-hidden={tappable}
      role={tappable ? undefined : "img"}
      aria-label={tappable ? undefined : alt}
      data-stretch-view={stretchView}
      className={visualClass}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#2DD4A8",
        opacity: 0.35,
      }}
    />
  ) : (
    // Public SVG files — keep as <img> so masters stay untouched.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={tappable ? "" : alt}
      width={size}
      height={size}
      draggable={false}
      data-stretch-view={stretchView}
      onError={handleImageError}
      onAnimationEnd={() => setBounce(false)}
      className={visualClass}
    />
  );

  if (!tappable) return graphic;

  return (
    <button
      type="button"
      onClick={tapBounce}
      aria-label={alt}
      data-stretch-view={stretchView}
      className="relative z-0 rounded-[28px] outline-none focus-visible:ring-2 focus-visible:ring-coral"
    >
      {graphic}
    </button>
  );
}
