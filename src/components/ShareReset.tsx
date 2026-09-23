"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { track } from "@/lib/analytics";
import { shareTargetFor } from "@/lib/share-reset";
import type { PrimaryNeed } from "@/lib/types";

/**
 * "Share this reset", under the return action on a good summary.
 *
 * What travels is a public page from a fixed table, never the workout URL:
 * that one carries a recommendation id, a source and this visit's attribution.
 * The native sheet is used where the browser has one, and a copied link where
 * it does not; if the clipboard refuses, the link is shown to be copied by
 * hand rather than silently lost.
 *
 * A resolved share promise means the sheet closed, not that anything was
 * delivered, and a cancelled sheet is not an error, so neither claims success.
 */
export function ShareReset({ need }: { need: PrimaryNeed }) {
  const [status, setStatus] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  async function share() {
    const origin = typeof window === "undefined" ? null : window.location.origin;
    const target = shareTargetFor(need, origin);
    track("share_reset_clicked", { need });

    const nav = typeof navigator === "undefined" ? null : navigator;
    if (nav?.share) {
      try {
        await nav.share({ text: target.text, url: target.url });
        track("share_reset_result", { need, result: "native_invoked" });
        setStatus("Thanks for passing it on.");
      } catch {
        // Cancelling is a choice, not a failure: nothing is copied or sent.
        track("share_reset_result", { need, result: "cancelled" });
      }
      return;
    }

    try {
      await nav?.clipboard?.writeText(`${target.text} ${target.url}`);
      track("share_reset_result", { need, result: "copied" });
      setStatus("Link copied.");
    } catch {
      track("share_reset_result", { need, result: "failed" });
      setStatus("Copy this link:");
      setFallbackUrl(target.url);
    }
  }

  return (
    <div>
      <Button variant="tertiary" block={false} className="px-0" onClick={share}>
        Share this reset
      </Button>
      {status ? (
        <p className="mt-1 text-sm text-muted" role="status">
          {status}{" "}
          {fallbackUrl ? (
            <span className="select-all font-semibold text-ink">{fallbackUrl}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
