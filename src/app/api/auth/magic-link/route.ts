import { NextResponse } from "next/server";
import {
  authConfigured,
  createLoginToken,
  LINK_NONCE_COOKIE,
  linkMinutes,
  linkNonceCookieOptions,
  profileForEmail,
  type PendingPreferences,
} from "@/lib/server/auth";
import { emailConfigured, magicLinkEmail, sendEmail } from "@/lib/server/email";
import { isValidEmail } from "@/lib/server/entitlements";
import { devLinksEnabled, durableOrNotProduction } from "@/lib/server/runtime";
import { originFrom } from "@/lib/server/stripe";
import { isDurable } from "@/lib/server/store";
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
  attribution?: PendingPreferences["attribution"];
};

/**
 * "Save my progress": emails a one-time sign-in link.
 *
 * Asking for a link changes nothing about an existing account. Whatever this
 * browser wants to bring along (preferences, movements to avoid, its anonymous
 * history) rides in the token row and is applied only when the link is opened
 * by the same browser, which proves it with a cookie set here. Anyone can type
 * anyone's address; that must never be enough to alter the account behind it.
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
  if (!durableOrNotProduction()) {
    // An account saved to memory is lost on the next deploy. Say so instead.
    return NextResponse.json({ ok: false, error: "store_not_configured" }, { status: 503 });
  }
  if (!emailConfigured() && !devLinksEnabled()) {
    return NextResponse.json({ ok: false, error: "email_not_configured" }, { status: 503 });
  }

  try {
    const profile = await profileForEmail(body.email);

    const pending: PendingPreferences = {
      primaryNeed: body.primaryNeed ?? null,
      preferredSetup: body.preferredSetup ?? null,
      preferredDuration: body.preferredDuration ?? null,
      constraints: Array.isArray(body.constraints) ? body.constraints.filter(isFunctionalConstraint) : undefined,
      attribution: body.attribution ?? null,
    };
    const { token, nonce } = await createLoginToken(profile, {
      nextPath: typeof body.next === "string" ? body.next : "/app",
      anonymousId: typeof body.anonymousId === "string" ? body.anonymousId : null,
      pending,
    });

    const link = `${originFrom(request)}/api/auth/verify?token=${encodeURIComponent(token)}`;
    const minutes = linkMinutes();

    let delivered = false;
    if (emailConfigured()) {
      const result = await sendEmail({ to: profile.email as string, ...magicLinkEmail({ link, minutes }) });
      delivered = result.delivered;
      if (!delivered && !devLinksEnabled()) {
        return NextResponse.json({ ok: false, error: "send_failed" }, { status: 503 });
      }
    }

    const response = NextResponse.json({
      ok: true,
      delivered,
      minutes,
      durable: isDurable(),
      // Outside production, with AUTH_DEV_LINKS=1, the link comes back in the
      // response so the flow can be exercised without an email provider.
      devLink: !delivered && devLinksEnabled() ? link : undefined,
    });
    response.cookies.set(LINK_NONCE_COOKIE, nonce, linkNonceCookieOptions());
    return response;
  } catch (error) {
    console.error("[deskbreak] magic link failed:", error);
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
}
