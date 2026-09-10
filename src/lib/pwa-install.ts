export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __deskbreakInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** Runs before React hydrates so Chrome's one-shot event is not missed. */
export const INSTALL_CAPTURE_SCRIPT = `(function(){try{window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__deskbreakInstallPrompt=e;window.dispatchEvent(new Event("deskbreak:beforeinstallprompt"));});}catch(err){}})();`;

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export function readDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return window.__deskbreakInstallPrompt ?? null;
}

export function clearDeferredInstallPrompt(): void {
  if (typeof window === "undefined") return;
  window.__deskbreakInstallPrompt = null;
}

export function subscribeToInstallPrompt(
  onPrompt: (event: BeforeInstallPromptEvent) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handle = (raw: Event) => {
    const event =
      (raw as BeforeInstallPromptEvent).prompt
        ? (raw as BeforeInstallPromptEvent)
        : readDeferredInstallPrompt();
    if (event) onPrompt(event);
  };

  window.addEventListener("beforeinstallprompt", handle);
  window.addEventListener("deskbreak:beforeinstallprompt", handle);
  return () => {
    window.removeEventListener("beforeinstallprompt", handle);
    window.removeEventListener("deskbreak:beforeinstallprompt", handle);
  };
}
