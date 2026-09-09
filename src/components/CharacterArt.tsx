"use client";

import { useEffect, useState } from "react";
import {
  characterSrc,
  hasMotionFrame,
  type CharacterPose,
} from "@/lib/character-art";

export function CharacterArt({
  pose = "idle",
  exerciseId,
  animate = false,
  alt = "Stretch",
  className,
  size = 220,
}: {
  pose?: CharacterPose;
  exerciseId?: string;
  animate?: boolean;
  alt?: string;
  className?: string;
  size?: number;
}) {
  const [frameB, setFrameB] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const motion = animate && hasMotionFrame(pose, exerciseId);

  useEffect(() => {
    setFrameB(false);
    setFailedSrc(null);
  }, [exerciseId, pose]);

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
    frame: frameB && motion ? "b" : "a",
  });
  const fallback = "/character/stretch-fallback.svg";
  const src = failedSrc === intended ? fallback : intended;

  return (
    // Public SVG masters — keep as <img> so files stay untouched.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      onError={() => {
        if (src === fallback) return;
        setFailedSrc(intended);
      }}
      className={["pointer-events-none select-none", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
