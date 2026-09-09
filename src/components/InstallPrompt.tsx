"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone) return;

    const onPrompt = (raw: Event) => {
      raw.preventDefault();
      setEvent(raw as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!event || hidden) return null;

  return (
    <div className="mb-4 rounded-[24px] bg-white p-4 shadow-[0_4px_0_rgba(28,25,23,0.06)]">
      <p className="font-display text-lg font-semibold text-ink">Add to home screen</p>
      <p className="mt-1 text-sm text-ink/60">
        Install DeskBreak for one-tap breaks without opening a browser tab.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => setHidden(true)}>
          Not now
        </Button>
        <Button
          onClick={async () => {
            await event.prompt();
            setHidden(true);
            setEvent(null);
          }}
        >
          Install
        </Button>
      </div>
    </div>
  );
}
