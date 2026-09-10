"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

export function LandingViewTracker({ page = "landing" }: { page?: string }) {
  useEffect(() => {
    track("landing_viewed", { page });
  }, [page]);
  return null;
}

export function StartResetButton({
  children = "Start a free 2-minute reset",
  need,
  source = "landing_hero",
  variant = "primary",
}: {
  children?: string;
  need?: string;
  source?: string;
  variant?: "primary" | "ink";
}) {
  const router = useRouter();
  const base =
    "inline-flex min-h-14 w-full items-center justify-center rounded-[22px] px-6 text-base font-semibold tracking-tight transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] active:translate-y-[5px] active:shadow-none sm:w-auto";
  const skin =
    variant === "ink"
      ? "bg-ink text-paper shadow-[0_5px_0_#0C0A09]"
      : "bg-coral text-white shadow-[0_5px_0_#E04420]";

  return (
    <button
      type="button"
      className={`${base} ${skin}`}
      onClick={() => {
        track("primary_cta_clicked", { cta: source, need: need ?? null });
        router.push(need ? `/app/start?need=${need}` : "/app/start");
      }}
    >
      {children}
    </button>
  );
}
