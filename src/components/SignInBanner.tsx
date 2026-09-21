"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAppState } from "@/lib/use-app-state";

const SIGN_IN_PARAMS = ["signed_in", "saved", "merged", "restored"];

type Arrival = { saved: boolean; restored: boolean; merged: number };

/**
 * The one-time confirmation after a sign-in link lands here. It reads the
 * params the verify route adds, then strips them so a reload or a shared URL
 * doesn't repeat it.
 */
export function SignInBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state = useAppState();
  const [arrival, setArrival] = useState<Arrival | null>(null);

  useEffect(() => {
    if (params.get("signed_in") !== "1") return;
    const merged = Number(params.get("merged")) || 0;
    // The URL is the only place this lives; it is read once and removed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setArrival({ saved: params.get("saved") === "1" || merged > 0, restored: params.get("restored") === "1", merged });
    const rest = new URLSearchParams(params.toString());
    for (const key of SIGN_IN_PARAMS) rest.delete(key);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  if (!arrival) return null;

  // Local history catches up once the account sync lands; until then the
  // server's merge count is the better number.
  const count = Math.max(state.progress.totalWorkouts, arrival.merged);
  const resets = `${count} ${count === 1 ? "reset" : "resets"}`;
  const email = state.account.email;
  const message = arrival.saved
    ? count > 0
      ? `Saved. ${count === 1 ? "1 reset is" : `${resets} are`} now on your account.`
      : "Saved. Your account is ready."
    : count > 0
      ? `Welcome back. Your ${count === 1 ? "reset is" : `${resets} are`} here.`
      : "Welcome back. You're signed in.";
  const detail = arrival.restored
    ? "If that email has a subscription, Pro is back on this device."
    : email
      ? `Open DeskBreak on any device with ${email} to pick up where you left off.`
      : null;

  return (
    <div className="surface mt-4 flex items-start gap-3 px-4 py-3.5" role="status">
      <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-note text-[11px] font-bold text-ink">
        ✓
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{message}</p>
        {detail ? <p className="mt-0.5 text-sm leading-relaxed break-words text-muted">{detail}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => setArrival(null)}
        className="-mr-2 -mt-1 grid min-h-11 min-w-11 place-items-center rounded-full text-lg text-muted hover:bg-ink/5 hover:text-ink"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
