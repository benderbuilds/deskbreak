"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import {
  clearDeferredInstallPrompt,
  isAndroidDevice,
  isIosDevice,
  isStandaloneDisplay,
  readDeferredInstallPrompt,
  subscribeToInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa-install";
import { useIsClient } from "@/lib/use-client";

const DISMISS_KEY = "deskbreak.installHint.v1";

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const isClient = useIsClient();
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    return subscribeToInstallPrompt(setEvent);
  }, []);

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

  if (!isClient || dismissed || isStandaloneDisplay() || wasDismissed()) {
    return null;
  }

  const canPrompt = Boolean(event ?? readDeferredInstallPrompt());
  const ios = isIosDevice();
  if (!canPrompt && !ios && !isAndroidDevice()) return null;

  return (
    <div className="mb-4 rounded-[22px] bg-white px-4 py-3 shadow-[0_3px_0_rgba(28,25,23,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Want DeskBreak one tap away?</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink/55">
            {canPrompt
              ? "Add it to your home screen. No browser tab next time."
              : ios
                ? "Share, then Add to Home Screen."
                : "Install DeskBreak from your browser menu."}
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
          <Button
            block={false}
            className="min-h-11 px-4"
            onClick={onAdd}
            aria-expanded={showHelp}
          >
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
