"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { describeAccountError, requestMagicLink } from "@/lib/account-client";
import { track } from "@/lib/analytics";
import { saveEmail } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";

/** /app/save: the standalone "Save what works for you" screen. */
export function SaveProgressView() {
  const isClient = useIsClient();
  const params = useSearchParams();
  const state = useAppState();
  const [email, setEmail] = useState(state.account.email ?? state.email ?? "");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "expired" ? "That link has expired or was already used. Send a fresh one." : null,
  );
  const [devLink, setDevLink] = useState<string | null>(null);

  if (!isClient) return null;

  if (state.account.profileId) {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-5">
        <h1 className="text-center font-display text-[2rem] font-semibold text-ink">You&apos;re signed in.</h1>
        <p className="mt-3 text-center text-ink/60">{state.account.email}</p>
        <div className="mt-8">
          <ButtonLink href="/app">Back to Today</ButtonLink>
        </div>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setError("That doesn't look like an email address.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestMagicLink(trimmed, { next: params.get("next") ?? "/app" });
    setBusy(false);
    if (!result.ok) {
      setError(describeAccountError(result.error));
      return;
    }
    saveEmail(trimmed);
    track("email_submitted", { source: "save", kind: "save_progress" });
    if (result.devLink) setDevLink(result.devLink);
    setSent(true);
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex justify-center">
        <CharacterArt pose="ready" size={140} alt="" />
      </div>
      {sent ? (
        <>
          <h1 className="mt-4 text-center font-display text-[2rem] font-semibold leading-tight text-ink">
            Check your inbox.
          </h1>
          <p className="mt-3 text-center text-ink/60">
            We sent a sign-in link to {email.trim()}. It works once and expires in 30 minutes.
          </p>
          {devLink ? (
            <p className="mt-3 text-center text-xs text-ink/50">
              Email isn&apos;t configured here:{" "}
              <a href={devLink} className="font-semibold text-coral">
                open the link
              </a>
            </p>
          ) : null}
          <div className="mt-8">
            <ButtonLink href="/app" variant="secondary">
              Back to Today
            </ButtonLink>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          <h1 className="mt-4 text-center font-display text-[2rem] font-semibold leading-tight text-ink">
            Save what works for you.
          </h1>
          <p className="mt-3 text-center text-ink/60">
            A sign-in link by email. No password. Your resets so far come with you, on every device.
          </p>
          <label htmlFor="save-email" className="sr-only">
            Email address
          </label>
          <input
            id="save-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@work.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-6 min-h-13 w-full rounded-[16px] border border-ink/12 bg-white px-4 text-base text-ink outline-none focus-visible:border-coral"
          />
          {error ? (
            <p className="mt-2 text-sm font-semibold text-coral" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-4 grid gap-2.5">
            <Button type="submit" disabled={busy}>
              {busy ? "Sending..." : "Send my sign-in link"}
            </Button>
            <ButtonLink href="/app" variant="tertiary">
              Not now
            </ButtonLink>
          </div>
        </form>
      )}
    </div>
  );
}
