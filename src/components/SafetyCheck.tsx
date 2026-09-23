"use client";

import { Button } from "@/components/Button";
import { FIRST_RUN_SAFETY_NOTE, STOP_RULE } from "@/lib/constants";
import { SAFETY_FLAG_OPTIONS } from "@/lib/safety";
import { getAppState, toggleSafetyFlag } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";

/** Its own key: the app state key never changes, and this is a one-time note. */
const SEEN_KEY = "deskbreak.safetyNote.v1";

/**
 * Whether to show the one-time safety screen: only before someone's very
 * first reset, and never again once they have started or skipped past it.
 */
export function needsSafetyCheck(): boolean {
  const state = getAppState();
  if (state.firstResetComplete || state.progress.totalWorkouts > 0) return false;
  try {
    return window.localStorage.getItem(SEEN_KEY) !== "1";
  } catch {
    return false;
  }
}

function markSafetyCheckSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode: it shows again next time, which is harmless */
  }
}

/**
 * One screen, once, before the first move: the stop rule, what DeskBreak
 * isn't, and an optional "Go easy on" list. Starting is always one tap and
 * nothing here has to be answered.
 *
 * Every flag stays visible. Hiding them behind a disclosure would raise the
 * number of people who start and lower the number who are asked the one
 * question that keeps a reset safe for them.
 *
 * Floor work is not asked here. It is a preference about a kind of routine,
 * it is off by default, and a desk reset never uses it, so it belongs in You
 * rather than in front of someone's first three minutes.
 */
export function SafetyCheck({ onContinue }: { onContinue: () => void }) {
  const state = useAppState();

  function start() {
    markSafetyCheckSeen();
    onContinue();
  }

  return (
    // Bottom padding clears the fixed start bar (its height plus the safe area),
    // so the last options can always be scrolled into view and tapped.
    <div className="mx-auto w-full max-w-[560px] px-5 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <h1 className="font-display font-extrabold text-[2rem] leading-tight text-ink">A quick check before you move.</h1>
      <p className="mt-3 text-[1.05rem] font-semibold leading-snug text-ink">{STOP_RULE}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{FIRST_RUN_SAFETY_NOTE}</p>

      <fieldset className="mt-6">
        <legend className="font-display font-extrabold text-lg text-ink">Go easy on (optional)</legend>
        <p className="mt-1 text-sm text-muted">
          Select any that apply, or start when you&apos;re ready. It stays on this device.
        </p>
        <div className="mt-3 grid gap-1.5">
          {SAFETY_FLAG_OPTIONS.map((option) => {
            const checked = state.safetyFlags.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[12px] px-2 py-2 transition-colors hover:bg-ink/4"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSafetyFlag(option.id)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-pen"
                />
                <span className="min-w-0">
                  <span className="block text-[0.95rem] text-ink">{option.label}</span>
                  {checked ? <span className="block text-xs text-muted">{option.hint}</span> : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto w-full max-w-[520px]">
          <Button onClick={start}>Start my reset</Button>
          <p className="mt-2 text-center text-xs text-muted">You can change these any time in You.</p>
        </div>
      </div>
    </div>
  );
}
