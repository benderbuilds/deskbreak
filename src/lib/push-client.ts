"use client";

import { track } from "./analytics";
import { isIosDevice, isStandaloneDisplay } from "./pwa-install";
import { ensureAnonymousId, setPushState } from "./storage";

/**
 * Browser side of Web Push: ask permission, subscribe through the service
 * worker, and register the subscription with the server.
 */
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(PUBLIC_KEY)
  );
}

/**
 * Why push can or can't be turned on here, so the UI can show the next step
 * instead of a disabled button.
 *
 * - ios_install: iPhone and iPad Safari only allow Web Push for a site added
 *   to the Home Screen and opened from that icon.
 * - unsupported: the browser has no Web Push at all.
 * - blocked: the person (or a policy) denied notifications for this site.
 * - not_configured: this deployment has no VAPID key, so nothing could send.
 */
export type PushReadiness = "ready" | "ios_install" | "unsupported" | "blocked" | "not_configured";

export function pushReadiness(): PushReadiness {
  if (typeof window === "undefined") return "unsupported";
  if (isIosDevice() && !isStandaloneDisplay()) return "ios_install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  if (!PUBLIC_KEY) return "not_configured";
  return "ready";
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export type PushResult = "subscribed" | "denied" | "unsupported" | "failed";

export async function subscribeToPush(): Promise<PushResult> {
  if (!pushSupported()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY as string) as unknown as BufferSource,
      }));
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymousId: ensureAnonymousId(),
        subscription: subscription.toJSON(),
        deviceLabel: navigator.userAgent.slice(0, 80),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      }),
    });
    if (!response.ok) return "failed";
    setPushState({ endpoint: subscription.endpoint, subscribedAt: new Date().toISOString() });
    track("push_subscribed");
    return "subscribed";
  } catch {
    return "failed";
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint, anonymousId: ensureAnonymousId() }),
      }).catch(() => {});
      await subscription.unsubscribe().catch(() => {});
    }
  } finally {
    setPushState({ endpoint: null, subscribedAt: null });
    track("push_unsubscribed");
  }
}
