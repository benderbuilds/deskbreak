"use client";

import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { ProBadge } from "@/components/ProBadge";
import { ANNUAL_PER_MONTH, ANNUAL_PRICE_USD, MONTHLY_COMPARE_USD } from "@/lib/constants";

export function UpgradeSheet({
  open,
  onClose,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  reason?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] rounded-[28px] bg-paper p-5 shadow-[0_12px_40px_rgba(28,25,23,0.2)] animate-[stepIn_240ms_cubic-bezier(0.34,1.2,0.64,1)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <ProBadge />
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full text-ink/50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-1 flex justify-center">
          <CharacterArt pose="locked" size={120} alt="Stretch — Pro locked" />
        </div>
        <h2 id="upgrade-title" className="mt-3 font-display text-[1.7rem] font-semibold leading-tight text-ink">
          Unlock the rest of the workday
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/65">
          {reason ??
            "Lunch Reset, Busy-Day Circuit, and the full move library are part of DeskBreak Pro."}
        </p>
        <p className="mt-4 text-sm text-ink/70">
          <span className="mr-2 text-ink/35 line-through">${MONTHLY_COMPARE_USD}/mo</span>
          <span className="font-semibold">${ANNUAL_PRICE_USD}/year</span>
          {" "}— less than ${ANNUAL_PER_MONTH}/month, billed annually.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <ButtonLink href="/paywall">See Free vs Pro</ButtonLink>
          <Button variant="ghost" onClick={onClose}>
            Keep the 2-min reset
          </Button>
        </div>
      </div>
    </div>
  );
}
