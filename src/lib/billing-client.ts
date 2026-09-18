"use client";

import { track } from "./analytics";

export type PortalResult = "opened" | "signed_out" | "failed";

/**
 * Opens the Stripe billing portal for the signed-in account. The server
 * resolves the customer from the session alone, so a signed-out browser gets
 * "signed_out" and never a portal.
 */
export async function openBillingPortal(): Promise<PortalResult> {
  track("billing_portal_opened");
  try {
    const response = await fetch("/api/billing/portal", { method: "POST" });
    if (response.status === 401) return "signed_out";
    const data = (await response.json().catch(() => ({}))) as { url?: string };
    if (!response.ok || !data.url) return "failed";
    window.location.href = data.url;
    return "opened";
  } catch {
    return "failed";
  }
}
