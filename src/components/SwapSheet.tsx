"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Chip } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { DISCOMFORT_REASONS, SAFETY_LINE } from "@/lib/constants";
import type { DiscomfortReason, Exercise } from "@/lib/types";

export type SwapMode = "swap" | "discomfort";

/**
 * "Swap" and "Doesn't feel right" share a sheet.
 *
 * Swap offers a few alternatives. Doesn't-feel-right has already switched the
 * move by the time this opens; it only asks, optionally, why, and reminds the
 * user that stopping is always fine.
 */
export function SwapSheet({
  mode,
  current,
  candidates,
  replacement,
  onSwap,
  onReason,
  onClose,
}: {
  mode: SwapMode;
  current: Exercise;
  candidates: Exercise[];
  replacement: Exercise | null;
  onSwap: (exercise: Exercise) => void;
  onReason: (reason: DiscomfortReason) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<DiscomfortReason | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 backdrop-blur-[2px] sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-title"
        onClick={(event) => event.stopPropagation()}
        className="animate-sheet-up w-full max-w-[520px] rounded-t-[24px] bg-paper px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:rounded-[24px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="swap-title" className="font-display text-xl font-semibold text-ink">
              {mode === "discomfort" ? "No problem. Let's switch it." : "Swap this move"}
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              {mode === "discomfort" && replacement
                ? `${current.name} is out. ${replacement.name} is in.`
                : `Instead of ${current.name}.`}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink/6 text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {mode === "discomfort" ? (
          <>
            <p className="mt-4 text-sm font-semibold text-ink/70">Want to tell us why? Optional.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DISCOMFORT_REASONS.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  active={reason === option.id}
                  onClick={() => {
                    setReason(option.id);
                    onReason(option.id);
                  }}
                />
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink/50">{SAFETY_LINE}</p>
            <div className="mt-5">
              <Button onClick={onClose}>Continue</Button>
            </div>
          </>
        ) : (
          <>
            <ul className="mt-4 grid gap-2">
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => onSwap(candidate)}
                    className="surface flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-ink/3"
                  >
                    <CharacterArt pose="exercise" exerciseId={candidate.id} size={56} alt="" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{candidate.name}</span>
                      <span className="block text-sm text-ink/55">{candidate.tagline ?? candidate.cue}</span>
                    </span>
                  </button>
                </li>
              ))}
              {!candidates.length ? (
                <li className="text-sm text-ink/55">Nothing else fits this slot. Skip it instead.</li>
              ) : null}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-ink/50">{SAFETY_LINE}</p>
          </>
        )}
      </div>
    </div>
  );
}
