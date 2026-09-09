"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { LoadingShell, ErrorState } from "@/components/StatusStates";
import { unlockPro } from "@/lib/storage";
import { useIsClient } from "@/lib/use-client";

export function PaywallSuccessView({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();
  const isClient = useIsClient();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Confirming your Pro year…");

  useEffect(() => {
    if (!isClient || !sessionId) return;
    let cancelled = false;
    fetch(`/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (res) => {
        const data = (await res.json()) as { ok?: boolean; expiresAt?: string };
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setStatus("error");
          setMessage("Stripe didn’t confirm this session. We did not unlock Pro.");
          return;
        }
        unlockPro("stripe", data.expiresAt);
        setStatus("ok");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setMessage("Couldn’t verify Checkout. Pro was not unlocked.");
      });
    return () => {
      cancelled = true;
    };
  }, [isClient, sessionId]);

  if (!isClient) {
    return <LoadingShell label={message} />;
  }

  if (!sessionId) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-5">
        <ErrorState
          title="Pro not unlocked"
          body="Missing Checkout session. No charge was recorded in the app."
          action={<ButtonLink href="/paywall">Back to plans</ButtonLink>}
        />
      </div>
    );
  }

  if (status === "loading") {
    return <LoadingShell label={message} />;
  }

  if (status === "error") {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-5">
        <ErrorState
          title="Pro not unlocked"
          body={message}
          action={<ButtonLink href="/paywall">Back to plans</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <CharacterArt
        pose="done"
        size={160}
        alt="Stretch — you’re on Pro"
        className="animate-[popIn_320ms_cubic-bezier(0.34,1.45,0.64,1)]"
      />
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink">You’re on Pro.</h1>
      <p className="mt-2 max-w-[18rem] text-sm text-ink/60">
        Lunch Reset, Busy-Day Circuit, and the full library are unlocked on this device.
      </p>
      <div className="mt-8 w-full">
        <Button onClick={() => router.replace("/")}>Go to DeskBreak</Button>
      </div>
    </div>
  );
}
