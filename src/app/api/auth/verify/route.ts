import { NextResponse } from "next/server";
import {
  consumeLoginToken,
  mergeAnonymousInto,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionCookieValue,
} from "@/lib/server/auth";
import { originFrom } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

/**
 * Where the magic link lands. Sets the session cookie and sends the user on.
 *
 * The anonymous browser id is not known here (the link may open in a different
 * browser), so the merge happens on the next /api/auth/me call, which the app
 * makes with its anonymous id as soon as it loads.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const origin = originFrom(request);

  const result = await consumeLoginToken(token).catch(() => null);
  if (!result) {
    return NextResponse.redirect(`${origin}/app/save?error=expired`);
  }

  const anonymousId = searchParams.get("anonymousId");
  if (anonymousId) await mergeAnonymousInto(result.profile, anonymousId).catch(() => {});

  const next = result.nextPath.startsWith("/") ? result.nextPath : "/app";
  const separator = next.includes("?") ? "&" : "?";
  const response = NextResponse.redirect(`${origin}${next}${separator}signed_in=1`);
  response.cookies.set(SESSION_COOKIE, sessionCookieValue(result.profile.id), sessionCookieOptions());
  return response;
}
