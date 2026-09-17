"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { track } from "@/lib/analytics";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import { isProEntitlement } from "@/lib/entitlements";

/**
 * Where Stripe sends people back to.
 *
 * The app shell has already asked the server about this checkout session, so by
 * the time this renders the entitlement is real rather than assumed.
 */
export function WelcomeView() {
  const isClient = useIsClient();
  const params = useSearchParams();
  const state = useAppState();
  const pro = isProEntitlement(state.entitlement);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current || !params.get("session_id")) return;
    tracked.current = true;
    track("checkout_completed", { need: state.primaryNeed });
    track("subscription_started", { need: state.primaryNeed });
  }, [params, state.primaryNeed]);

  if (!isClient) return null;

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex justify-center">
        <CharacterArt pose="done" size={170} alt="Stretch, pleased about this" />
      </div>
      <h1 className="mt-5 text-center font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
        {pro ? "You're in." : "Almost there."}
      </h1>
      <p className="mt-3 text-center leading-relaxed text-ink/65">
        {pro
          ? "Tell DeskBreak when you work and it will handle the rest of the day."
          : "Your payment is still settling. Give it a moment and refresh, or restore from You."}
      </p>
      <div className="mt-8 grid gap-3">
        {pro ? <ButtonLink href="/app/plan">Build my workday</ButtonLink> : null}
        <ButtonLink href="/app" variant={pro ? "secondary" : "primary"}>
          Go to Today
        </ButtonLink>
      </div>
    </div>
  );
}
