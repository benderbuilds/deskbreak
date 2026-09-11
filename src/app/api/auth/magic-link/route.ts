import { NextResponse } from "next/server";
import { authConfigured, createLoginToken, profileForEmail } from "@/lib/server/auth";
import { emailConfigured, magicLinkEmail, sendEmail } from "@/lib/server/email";
import { isValidEmail } from "@/lib/server/entitlements";
import { originFrom } from "@/lib/server/stripe";
import { findMany, insert, isDurable, remove, update, type FunctionalConstraintRow } from "@/lib/server/store";
import { isFunctionalConstraint } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  anonymousId?: string;
  next?: string;
  primaryNeed?: string | null;
  preferredSetup?: string | null;
  preferredDuration?: number | null;
  constraints?: unknown;
  attribution?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
    landingPath?: string | null;
  };
};

/**
 * "Save my progress": emails a one-time sign-in link.
 *
 * The profile is created (or found) immediately and linked to the anonymous
 * browser, so even before the link is opened, tomorrow's reminder has somewhere
 * to go and the browser's history has an owner.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (!body.email || !isValidEmail(body.email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (!authConfigured()) {
    return NextResponse.json({ ok: false, error: "auth_not_configured" }, { status: 503 });
  }

  try {
    const profile = await profileForEmail(body.email, body.anonymousId ?? null);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.primaryNeed) patch.primary_need = body.primaryNeed;
    if (body.preferredSetup) patch.preferred_setup = body.preferredSetup;
    if (body.preferredDuration) patch.preferred_duration = body.preferredDuration;
    if (body.attribution && !profile.first_utm_source) {
      patch.first_utm_source = body.attribution.source ?? null;
      patch.first_utm_medium = body.attribution.medium ?? null;
      patch.first_utm_campaign = body.attribution.campaign ?? null;
      patch.first_utm_content = body.attribution.content ?? null;
      patch.first_landing_path = body.attribution.landingPath ?? null;
    }
    await update("profiles", { id: profile.id }, patch);

    if (Array.isArray(body.constraints)) {
      const wanted = body.constraints.filter(isFunctionalConstraint);
      const existing = await findMany("functional_constraints", { profile_id: profile.id });
      for (const row of existing) {
        if (!wanted.includes(row.constraint_key as never)) await remove("functional_constraints", { id: row.id });
      }
      for (const key of wanted) {
        if (!existing.some((row) => row.constraint_key === key)) {
          const row: FunctionalConstraintRow = {
            id: crypto.randomUUID(),
            profile_id: profile.id,
            constraint_key: key,
            created_at: new Date().toISOString(),
          };
          await insert("functional_constraints", row);
        }
      }
    }

    const { token } = await createLoginToken(profile, body.next ?? "/app");
    const origin = originFrom(request);
    const link = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;
    const message = magicLinkEmail({ link, minutes: 30 });
    const result = await sendEmail({ to: profile.email as string, ...message });

    // Without an email provider (local dev, previews) the link is handed back so
    // the flow can still be exercised end to end. Never in production.
    const devLink = !emailConfigured() && process.env.NODE_ENV !== "production" ? link : undefined;

    return NextResponse.json({
      ok: true,
      delivered: result.delivered,
      durable: isDurable(),
      devLink,
    });
  } catch (error) {
    console.error("[deskbreak] magic link failed:", error);
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
