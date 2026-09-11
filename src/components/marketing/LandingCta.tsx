"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

export function LandingViewTracker({ page = "landing", seo = false }: { page?: string; seo?: boolean }) {
  useEffect(() => {
    track(seo ? "seo_landing_viewed" : "landing_viewed", { page });
  }, [page, seo]);
  return null;
}

/**
 * The button that starts a reset from any public page.
 *
 * Goes straight to /app/start with the need and length preloaded, which
 * starts the workout immediately. No signup, no questions.
 */
export function StartResetButton({
  children = "Start my reset",
  need,
  minutes,
  source = "landing_hero",
  seo = false,
  variant = "primary",
}: {
  children?: string;
  need?: string;
  minutes?: number;
  source?: string;
  seo?: boolean;
  variant?: "primary" | "ink";
}) {
  const router = useRouter();
  const base =
    "inline-flex min-h-13 w-full items-center justify-center rounded-[16px] px-6 text-base font-semibold tracking-tight transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.985] sm:w-auto";
  const skin = variant === "ink" ? "bg-ink text-paper hover:bg-ink/90" : "bg-coral text-white hover:bg-coral-deep";

  return (
    <button
      type="button"
      className={`${base} ${skin}`}
      onClick={() => {
        track("primary_cta_clicked", { cta: source, need: need ?? null, minutes: minutes ?? null });
        const params = new URLSearchParams();
        if (need) params.set("need", need);
        if (minutes) params.set("minutes", String(minutes));
        params.set("source", seo ? "seo" : "landing");
        router.push(`/app/start?${params.toString()}`);
      }}
    >
      {children}
    </button>
  );
}
