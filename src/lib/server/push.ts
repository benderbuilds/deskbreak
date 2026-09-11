import "server-only";

import webpush from "web-push";
import { update, type PushSubscriptionRow } from "./store";

/**
 * Web Push delivery.
 *
 * Keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (generate once with
 * `npm run push:keys`). The public key is also exposed as
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY so the browser can subscribe.
 */
let configured = false;

export function pushConfigured(): boolean {
  return Boolean(
    (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
      process.env.VAPID_PRIVATE_KEY,
  );
}

function setup(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@deskbreak.app";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  breakId?: string | null;
  actions?: { action: string; title: string }[];
};

export async function sendPush(
  subscription: PushSubscriptionRow,
  payload: PushPayload,
): Promise<{ delivered: boolean; gone: boolean }> {
  if (!setup()) return { delivered: false, gone: false };
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 30, urgency: "normal" },
    );
    await update("push_subscriptions", { id: subscription.id }, { last_success_at: new Date().toISOString() });
    return { delivered: true, gone: false };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    const gone = status === 404 || status === 410;
    await update(
      "push_subscriptions",
      { id: subscription.id },
      {
        last_failure_at: new Date().toISOString(),
        ...(gone ? { revoked_at: new Date().toISOString() } : {}),
      },
    );
    return { delivered: false, gone };
  }
}
