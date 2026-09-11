import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  absorbBillingProfiles,
  applyPendingPreferences,
  consumeLoginToken,
  LINK_NONCE_COOKIE,
  linkNonceCookieOptions,
  mergeAnonymousInto,
  nonceMatches,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionCookieValue,
} from "@/lib/server/auth";
import { originFrom } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

/**
 * Where the magic link lands.
 *
 * The token is consumed exactly once. Then, and only then:
 * - the browser that asked for the link (it still holds the nonce cookie) has
 *   its pending preferences applied and its anonymous history merged in,
 *   including a device-bound Pro purchase;
 * - any other browser is simply signed in, and merges nothing, because a link
 *   forwarded elsewhere must not carry a stranger's data into the account;
 * - purchases made under this now-verified address are attached.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const origin = originFrom(request);

  const result = await consumeLoginToken(token).catch(() => null);
  if (!result) {
    return NextResponse.redirect(`${origin}/app/save?error=expired`);
  }

  const jar = await cookies();
  const sameBrowser = nonceMatches(result.nonceHash, jar.get(LINK_NONCE_COOKIE)?.value);
  let merged = 0;
  if (sameBrowser) {
    await applyPendingPreferences(result.profile, result.pending).catch((error) => {
      console.error("[deskbreak] pending preferences failed:", error);
    });
    const summary = await mergeAnonymousInto(result.profile, result.anonymousId, {
      includeSubscriptions: true,
    }).catch(() => null);
    merged = summary ? summary.sessions : 0;
  }
  await absorbBillingProfiles(result.profile).catch((error) => {
    console.error("[deskbreak] billing merge failed:", error);
  });

  const next = result.nextPath.startsWith("/") ? result.nextPath : "/app";
  const separator = next.includes("?") ? "&" : "?";
  const response = NextResponse.redirect(
    `${origin}${next}${separator}signed_in=1${merged ? `&merged=${merged}` : ""}`,
  );
  response.cookies.set(SESSION_COOKIE, sessionCookieValue(result.profile.id), sessionCookieOptions());
  response.cookies.set(LINK_NONCE_COOKIE, "", { ...linkNonceCookieOptions(), maxAge: 0 });
  return response;
}
