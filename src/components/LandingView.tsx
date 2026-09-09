"use client";

import { ButtonLink } from "@/components/Button";
import { LogoMark } from "@/components/LogoMark";

export function LandingView() {
  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2">
        <LogoMark size={32} />
        <span className="font-display text-lg font-semibold text-ink">DeskBreak</span>
      </header>

      <main className="flex flex-1 flex-col">
        <p className="mt-10 text-xs font-semibold uppercase tracking-[0.16em] text-coral">
          For desk workers
        </p>
        <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-[1.08] tracking-tight text-ink">
          Your neck shouldn’t pay rent for a laptop.
        </h1>
        <p className="mt-4 text-[1.05rem] leading-relaxed text-ink/70">
          Office workouts and desk exercises that fit between meetings. One tap.
          Two minutes. No equipment — at the office or as a home workout routine
          for busy days.
        </p>

        <ul className="mt-8 space-y-3">
          {[
            ["2 min", "Desk Reset whenever the stiffness starts."],
            ["5 min", "Lunch Reset for shoulders, hips, and wrists."],
            ["10 min", "Busy-Day Circuit when you need a real unstick."],
          ].map(([kicker, line]) => (
            <li
              key={kicker}
              className="flex gap-3 rounded-[22px] bg-white p-4 shadow-[0_4px_0_rgba(28,25,23,0.06)]"
            >
              <span className="shrink-0 text-sm font-bold text-coral">{kicker}</span>
              <span className="text-sm leading-snug text-ink/70">{line}</span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-sm leading-relaxed text-ink/50">
          Desk exercises while working, not after you finally close the laptop.
          Built by someone who also forgets to stand up.
        </p>
      </main>

      <div className="mt-8 flex flex-col gap-3">
        <ButtonLink href="/onboarding">Take a 2-minute break</ButtonLink>
        <p className="text-center text-xs text-ink/40">
          Free forever for the 2-min reset. No account.
        </p>
      </div>
    </div>
  );
}
