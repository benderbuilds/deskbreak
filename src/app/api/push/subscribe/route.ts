import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/auth";
import { ensureProfile } from "@/lib/server/entitlements";
import { pushConfigured } from "@/lib/server/push";
import { findOne, update, upsert, type PushSubscriptionRow } from "@/lib/server/store";

export const dynamic = "force-dynamic";

type Body = {
  anonymousId?: string;
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  deviceLabel?: string | null;
  timezone?: string | null;
};

/** Stores a browser's push subscription against the person behind it. */
export async function POST(request: Request) {
  if (!pushConfigured()) {
    return NextResponse.json({ ok: false, error: "push_not_configured" }, { status: 503 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  try {
    const profile =
      (await currentProfile()) ??
      (body.anonymousId ? await ensureProfile({ anonymousId: body.anonymousId }) : null);
    const existing = await findOne("push_subscriptions", { endpoint });
    const row: PushSubscriptionRow = {
      id: existing?.id ?? crypto.randomUUID(),
      profile_id: profile?.id ?? existing?.profile_id ?? null,
      anonymous_id: body.anonymousId ?? existing?.anonymous_id ?? null,
      endpoint,
      p256dh,
      auth,
      device_label: body.deviceLabel ?? existing?.device_label ?? null,
      timezone: body.timezone ?? existing?.timezone ?? null,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_success_at: existing?.last_success_at ?? null,
      last_failure_at: existing?.last_failure_at ?? null,
      revoked_at: null,
    };
    await upsert("push_subscriptions", row, "endpoint");
    return NextResponse.json({ ok: true, id: row.id });
  } catch (error) {
    console.error("[deskbreak] push subscribe failed:", error);
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  let body: { endpoint?: string };
  try {
    body = (await request.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (!body.endpoint) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  try {
    await update("push_subscriptions", { endpoint: body.endpoint }, { revoked_at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[deskbreak] push unsubscribe failed:", error);
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
