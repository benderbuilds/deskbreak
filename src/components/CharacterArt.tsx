"use client";

import { useEffect, useState } from "react";
import {
  characterSrc,
  hasMotionFrame,
  type CharacterPose,
} from "@/lib/character-art";
import type { BodyArea } from "@/lib/types";

const FALLBACK_SRC = "/character/stretch-fallback.svg";

export function CharacterArt({
  pose = "idle",
  exerciseId,
  bodyArea,
  animate = false,
  tappable = false,
  alt = "Stretch",
  className,
  size = 220,
}: {
  pose?: CharacterPose;
  exerciseId?: string;
  bodyArea?: BodyArea;
  animate?: boolean;
  tappable?: boolean;
  alt?: string;
  className?: string;
  size?: number;
}) {
  const [frameB, setFrameB] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [bounce, setBounce] = useState(false);
  const motion = animate && hasMotionFrame(pose, exerciseId, bodyArea);

  useEffect(() => {
    setFrameB(false);
    setFailedSrc(null);
  }, [exerciseId, pose, bodyArea]);

  useEffect(() => {
    if (!motion) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const id = window.setInterval(() => setFrameB((on) => !on), 720);
    return () => window.clearInterval(id);
  }, [motion, exerciseId]);

  const intended = characterSrc({
    pose,
    exerciseId,
    bodyArea,
    frame: frameB && motion ? "b" : "a",
  });
  const src = failedSrc === intended ? FALLBACK_SRC : intended;

  function tapBounce() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setBounce(false);
    window.requestAnimationFrame(() => setBounce(true));
  }

  const image = (
    // Public SVG files — keep as <img> so masters stay untouched.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={tappable ? "" : alt}
      width={size}
      height={size}
      draggable={false}
      onError={() => {
        if (src === FALLBACK_SRC) return;
        setFailedSrc(intended);
      }}
      onAnimationEnd={() => setBounce(false)}
      className={[
        "pointer-events-none select-none",
        bounce ? "animate-[tapBounce_420ms_cubic-bezier(0.34,1.4,0.64,1)]" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );

  if (!tappable) return image;

  return (
    <button
      type="button"
      onClick={tapBounce}
      aria-label={alt}
      className="rounded-[28px] outline-none focus-visible:ring-2 focus-visible:ring-coral"
    >
      {image}
    </button>
  );
}
