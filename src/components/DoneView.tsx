"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { getExercise } from "@/lib/content";
import { buildSessionSummary } from "@/lib/format";
import { getLastSession, getProgress } from "@/lib/storage";
import { useIsClient } from "@/lib/use-client";

export function DoneView() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getLastSession() : null;
  const streak = isClient ? getProgress().streak : 0;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isClient && !session) {
      router.replace("/");
    }
  }, [isClient, session, router]);

  const completedNames = useMemo(
    () =>
      (session?.completedExerciseIds ?? [])
        .map((id) => getExercise(id)?.name)
        .filter((name): name is string => Boolean(name)),
    [session],
  );
  const skippedNames = useMemo(
    () =>
      (session?.skippedExerciseIds ?? [])
        .map((id) => getExercise(id)?.name)
        .filter((name): name is string => Boolean(name)),
    [session],
  );

  const summary = useMemo(() => {
    if (!session) return "";
    return buildSessionSummary({
      programName: session.programName,
      durationMin: session.durationMin,
      completedNames,
      skippedNames,
      streak,
      elapsedSec: session.elapsedSec,
    });
  }, [session, completedNames, skippedNames, streak]);

  async function copySummary() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (!session) {
    return <div className="min-h-dvh bg-paper" />;
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Confetti />

      <main className="relative z-10 flex flex-1 flex-col items-center text-center">
        <div className="mt-6 grid h-24 w-24 place-items-center rounded-full bg-mint text-ink shadow-[0_8px_0_#1BAF8A] animate-[popIn_320ms_cubic-bezier(0.34,1.45,0.64,1)]">
          <CheckIcon />
        </div>

        <h1 className="mt-8 font-display text-[2.35rem] font-semibold leading-none tracking-tight text-ink animate-[stepIn_280ms_cubic-bezier(0.34,1.2,0.64,1)]">
          That&apos;s a break.
        </h1>
        <p className="mt-3 max-w-[20rem] text-[1.05rem] leading-relaxed text-ink/65">
          {session.programName} in the books. No extra credit required.
        </p>

        <div className="mt-8 flex items-center gap-2 rounded-full bg-white px-5 py-3 text-ink shadow-[0_4px_0_rgba(28,25,23,0.06)] animate-[popIn_300ms_cubic-bezier(0.34,1.45,0.64,1)]">
          <span aria-hidden className="text-lg">
            🔥
          </span>
          <p className="text-base font-semibold">
            {streak} day streak
          </p>
        </div>

        <section className="mt-8 w-full rounded-[28px] bg-white p-5 text-left shadow-[0_5px_0_rgba(28,25,23,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-coral">
            Summary
          </p>
          <p className="mt-2 font-display text-xl font-semibold text-ink">
            {completedNames.length} move{completedNames.length === 1 ? "" : "s"} done
          </p>
          <ul className="mt-3 space-y-1 text-sm text-ink/65">
            {completedNames.map((name, index) => (
              <li key={`${name}-${index}`}>• {name}</li>
            ))}
          </ul>
          {skippedNames.length > 0 && (
            <p className="mt-3 text-sm text-ink/45">
              Skipped: {skippedNames.join(", ")}
            </p>
          )}
        </section>
      </main>

      <div className="relative z-10 mt-6 flex flex-col gap-3">
        <Button variant={copied ? "mint" : "ghost"} onClick={copySummary}>
          {copied ? "Copied" : "Copy summary"}
        </Button>
        <ButtonLink href="/">Back home</ButtonLink>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden>
      <path
        d="M10 22.5 18 30 32 13"
        stroke="#1C1917"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Confetti() {
  const bits = [
    { left: "8%", delay: "0ms", color: "#FF5A36", rotate: 18 },
    { left: "22%", delay: "40ms", color: "#2DD4A8", rotate: -12 },
    { left: "38%", delay: "90ms", color: "#FF5A36", rotate: 28 },
    { left: "55%", delay: "20ms", color: "#1C1917", rotate: -22 },
    { left: "70%", delay: "70ms", color: "#2DD4A8", rotate: 14 },
    { left: "84%", delay: "110ms", color: "#FF5A36", rotate: -8 },
    { left: "14%", delay: "150ms", color: "#2DD4A8", rotate: 40 },
    { left: "47%", delay: "180ms", color: "#FF5A36", rotate: -30 },
    { left: "63%", delay: "130ms", color: "#1C1917", rotate: 8 },
    { left: "91%", delay: "60ms", color: "#2DD4A8", rotate: -18 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((bit, i) => (
        <span
          key={i}
          className="absolute top-[-12px] h-3 w-2.5 rounded-[2px] animate-[confettiFall_900ms_cubic-bezier(0.2,0.8,0.2,1)_forwards]"
          style={{
            left: bit.left,
            background: bit.color,
            animationDelay: bit.delay,
            transform: `rotate(${bit.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
