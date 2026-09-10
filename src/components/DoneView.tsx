"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/Button";
import { CharacterArt } from "@/components/CharacterArt";
import { getExercise, getProgram, benefitsForProgram } from "@/lib/content";
import { isProEntitlement } from "@/lib/entitlements";
import { buildSessionSummary } from "@/lib/format";
import { playCelebrationTune } from "@/lib/celebration-tune";
import { getLastSession, markPaywallSeen } from "@/lib/storage";
import { useAppState } from "@/lib/use-app-state";
import { useIsClient } from "@/lib/use-client";
import type { CelebrationTheme } from "@/lib/types";

export function DoneView({ nextPaywall = false }: { nextPaywall?: boolean }) {
  const router = useRouter();
  const isClient = useIsClient();
  const app = useAppState();
  const session = isClient ? getLastSession() : null;
  const streak = app.progress.streak;
  const pro = isProEntitlement(app.entitlement);
  const theme: CelebrationTheme = pro ? app.settings.celebrationTheme : "classic";
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isClient && !session) {
      router.replace(nextPaywall ? "/paywall" : "/");
    }
  }, [isClient, session, router, nextPaywall]);

  useEffect(() => {
    if (!session) return;
    playCelebrationTune(session.finishedAt);
  }, [session]);

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

  const headline = headlineForSession(session.finishedAt, session.programId);
  const streakLabel = streak > 0 ? `🔥 ${streak}-day groove` : "Quiet flex";
  const moreHref = `/workout/${session.programId}`;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Celebration theme={theme} />

      <main className="relative z-10 flex flex-1 flex-col items-center text-center">
        <CharacterArt
          pose="done"
          setup={getProgram(session.programId)?.stance}
          programId={session.programId}
          size={180}
          alt="Stretch — that's a break"
          className="mt-2 animate-[popIn_320ms_cubic-bezier(0.34,1.45,0.64,1)]"
        />

        <h1 className="mt-4 font-display text-[2.35rem] font-semibold leading-none tracking-tight text-ink animate-[stepIn_280ms_cubic-bezier(0.34,1.4,0.64,1)]">
          {headline}
        </h1>
        <p className="mt-3 max-w-[20rem] text-[1.05rem] leading-relaxed text-ink/65">
          {session.programName} in the books.
        </p>
        <p className="mt-2 max-w-[20rem] text-sm leading-relaxed text-ink/50">
          {closerForSession(session.finishedAt, session.programId)}
        </p>

        <div className="mt-8 flex items-center gap-2 rounded-full bg-white px-5 py-3 text-ink shadow-[0_4px_0_rgba(28,25,23,0.06)] animate-[popIn_300ms_cubic-bezier(0.34,1.45,0.64,1)]">
          <p className="text-base font-semibold">{streakLabel}</p>
        </div>
        {pro ? (
          <p className="mt-3 text-sm font-semibold text-ink/50">{app.progress.xp} XP</p>
        ) : null}

        <section className="mt-8 w-full rounded-[28px] bg-white p-5 text-left shadow-[0_5px_0_rgba(28,25,23,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-coral">
            Summary
          </p>
          <p className="mt-2 font-display text-xl font-semibold text-ink">
            {completedNames.length} move{completedNames.length === 1 ? "" : "s"} done
          </p>
          {completedNames.length === 0 ? (
            <p className="mt-3 text-sm text-ink/55">You showed up. That still counts.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm text-ink/65">
              {completedNames.map((name, index) => (
                <li key={`${name}-${index}`}>• {name}</li>
              ))}
            </ul>
          )}
          {skippedNames.length > 0 && (
            <p className="mt-3 text-sm text-ink/45">Skipped: {skippedNames.join(", ")}</p>
          )}
        </section>
      </main>

      <div className="relative z-10 mt-6 flex flex-col gap-3">
        {nextPaywall ? (
          <>
            <ButtonLink href="/paywall?from=firstWin">See what Pro unlocks</ButtonLink>
            <Button
              variant="ghost"
              onClick={() => {
                markPaywallSeen();
                router.replace("/");
              }}
            >
              Back to desk
            </Button>
          </>
        ) : (
          <>
            <ButtonLink href="/">Back to desk</ButtonLink>
            <ButtonLink href={moreHref} variant="ghost">
              One more?
            </ButtonLink>
            <Button variant={copied ? "mint" : "ghost"} onClick={copySummary}>
              {copied ? "Copied" : "Copy summary"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

const DONE_HEADLINES = [
  "That’s a break.",
  "Shoulders say thanks.",
  "Back to it — lighter.",
] as const;

function headlineForSession(finishedAt: string, programId: string): string {
  const seed = `${finishedAt}:${programId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % DONE_HEADLINES.length;
  }
  return DONE_HEADLINES[hash] ?? DONE_HEADLINES[0];
}

function closerForSession(finishedAt: string, programId: string): string {
  const program = getProgram(programId);
  const benefit = program ? benefitsForProgram(program) : null;
  const pool = [benefit?.doneLine, benefit?.blurb, benefit?.cardLine].filter(
    (line): line is string => Boolean(line),
  );
  if (pool.length === 0) return "Shoulders slightly less rented out.";
  const seed = `${finishedAt}:closer:${programId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % pool.length;
  }
  return pool[hash] ?? pool[0];
}

function Celebration({ theme }: { theme: CelebrationTheme }) {
  const bits =
    theme === "classic"
      ? CLASSIC_BITS
      : theme === "spark"
        ? SPARK_BITS
        : [...CLASSIC_BITS, ...EXTRA_BITS];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((bit, i) => (
        <span
          key={`${theme}-${i}`}
          className={
            theme === "spark"
              ? "absolute top-[18%] h-2 w-2 rounded-full animate-[popIn_320ms_cubic-bezier(0.34,1.45,0.64,1)]"
              : "absolute top-[-12px] h-3 w-2.5 rounded-[2px] animate-[confettiFall_900ms_cubic-bezier(0.2,0.8,0.2,1)_forwards]"
          }
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

const CLASSIC_BITS = [
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

const EXTRA_BITS = [
  { left: "5%", delay: "200ms", color: "#2DD4A8", rotate: 12 },
  { left: "31%", delay: "240ms", color: "#FF5A36", rotate: -16 },
  { left: "58%", delay: "210ms", color: "#2DD4A8", rotate: 24 },
  { left: "76%", delay: "260ms", color: "#FF5A36", rotate: -6 },
  { left: "95%", delay: "190ms", color: "#1C1917", rotate: 32 },
];

const SPARK_BITS = [
  { left: "30%", delay: "0ms", color: "#2DD4A8", rotate: 0 },
  { left: "46%", delay: "40ms", color: "#FF5A36", rotate: 0 },
  { left: "62%", delay: "80ms", color: "#2DD4A8", rotate: 0 },
  { left: "38%", delay: "120ms", color: "#FF5A36", rotate: 0 },
  { left: "54%", delay: "160ms", color: "#1C1917", rotate: 0 },
];
