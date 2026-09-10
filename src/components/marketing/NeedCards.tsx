"use client";

import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { NEED_OPTIONS } from "@/lib/constants";
import type { PrimaryNeed } from "@/lib/types";

/**
 * The second thing on the page and, for most visitors, the actual entry point.
 *
 * Picking a card goes straight into the flow with that need preselected: no
 * intermediate screen, no account, no configuration.
 */
export function NeedCards({ source = "landing" }: { source?: string }) {
  const router = useRouter();

  function choose(need: PrimaryNeed) {
    track("primary_cta_clicked", { cta: "need_card", need, source });
    router.push(`/app/start?need=${need}`);
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {NEED_OPTIONS.map((option) => (
        <li key={option.id}>
          <button
            type="button"
            onClick={() => choose(option.id)}
            className="flex min-h-[5.5rem] w-full flex-col justify-center gap-1 rounded-[22px] bg-white px-5 py-4 text-left shadow-[0_4px_0_rgba(28,25,23,0.06)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-none"
          >
            <span className="font-display text-lg font-semibold text-ink">
              {option.label}
            </span>
            <span className="text-sm text-ink/60">{option.blurb}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
