"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { track } from "@/lib/analytics";
import { INSTALL_PROMPT_AFTER_SESSIONS } from "@/lib/constants";
import {
  clearDeferredInstallPrompt,
  isAndroidDevice,
  isIosDevice,
  isStandaloneDisplay,
  readDeferredInstallPrompt,
  subscribeToInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa-install";
import { markInstallPromptSeen } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";

const DISMISS_KEY = "deskbreak.installHint.v1";

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * "Keep DeskBreak one click away." Only after a few completed sessions, never
 * on the first visit, and never again once dismissed.
 */
export function InstallPrompt() {
  const isClient = useIsClient();
  const state = useAppState();
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const tracked = useRef(false);

  useEffect(() => subscribeToInstallPrompt(setEvent), []);

  const eligible =
    isClient &&
    !dismissed &&
    !isStandaloneDisplay() &&
    !wasDismissed() &&
    state.progress.totalWorkouts >= INSTALL_PROMPT_AFTER_SESSIONS;

  useEffect(() => {
    if (eligible && !tracked.current) {
      tracked.current = true;
      markInstallPromptSeen();
      track("install_prompt_viewed", { sessions: state.progress.totalWorkouts });
    }
  }, [eligible, state.progress.totalWorkouts]);

  if (!eligible) return null;

  const canPrompt = Boolean(event ?? readDeferredInstallPrompt());
  const ios = isIosDevice();
  const desktop = !ios && !isAndroidDevice();
  if (!canPrompt && !ios && !isAndroidDevice() && !desktop) return null;

  function dismiss() {
    setDismissed(true);
    setShowHelp(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function onAdd() {
    const deferred = event ?? readDeferredInstallPrompt();
    if (deferred?.prompt) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        clearDeferredInstallPrompt();
        setEvent(null);
        if (choice.outcome === "accepted") {
          track("install_accepted");
          dismiss();
          return;
        }
        setShowHelp(true);
        return;
      } catch {
        clearDeferredInstallPrompt();
        setEvent(null);
      }
    }
    setShowHelp(true);
  }

  return (
    <div className="surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Keep DeskBreak one click away</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink/55">
            {desktop ? "Add DeskBreak to your desktop." : "Add DeskBreak to your home screen."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 rounded-full px-3 text-sm font-semibold text-ink/45"
          >
            Later
          </button>
          <Button block={false} size="sm" onClick={onAdd} aria-expanded={showHelp}>
            Add
          </Button>
        </div>
      </div>
      {showHelp ? (
        <ol className="mt-3 space-y-1.5 text-xs leading-relaxed text-ink/65">
          {ios ? (
            <>
              <li>1. Tap Share (square with the arrow).</li>
              <li>2. Tap Add to Home Screen.</li>
              <li>3. Tap Add. Open DeskBreak from that icon next time.</li>
            </>
          ) : desktop ? (
            <>
              <li>1. Open your browser menu, or the install icon in the address bar.</li>
              <li>2. Choose Install DeskBreak.</li>
              <li>3. It opens in its own window from now on.</li>
            </>
          ) : (
            <>
              <li>1. Open the browser menu (⋮ or Share).</li>
              <li>2. Tap Install app or Add to Home Screen.</li>
              <li>3. Already added? Open the DeskBreak icon, not this tab.</li>
            </>
          )}
        </ol>
      ) : null}
    </div>
  );
}
