"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";

const DISMISS_KEY = "deskbreak.installHint.v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIosDevice(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    const onPrompt = (raw: Event) => {
      raw.preventDefault();
      setEvent(raw as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if (isIosDevice()) {
      setIosHint(true);
      setHidden(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setHidden(true);
    setEvent(null);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (hidden || (!event && !iosHint)) return null;

  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-[22px] bg-white px-4 py-3 shadow-[0_3px_0_rgba(28,25,23,0.06)]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">Add to home screen</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink/55">
          {event
            ? "One tap next time — no browser tab."
            : "Share, then Add to Home Screen. One tap next time."}
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
        {event ? (
          <Button
            block={false}
            className="min-h-11 px-4"
            onClick={async () => {
              await event.prompt();
              dismiss();
            }}
          >
            Install
          </Button>
        ) : null}
      </div>
    </div>
  );
}
