"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { LogoMark } from "@/components/LogoMark";
import { completeOnboarding } from "@/lib/storage";

const slides = [
  {
    kicker: "At your desk",
    title: "Breaks that fit the chair you’re already in.",
    body: "DeskBreak is office workouts and desk exercises you can do without leaving your seat — or while the kettle boils at home. No equipment. No floor mat.",
  },
  {
    kicker: "One tap",
    title: "Pick a length. That’s the only decision.",
    body: "Two minutes between calls, five after lunch, or a ten-minute home workout routine for busy days. One tap starts the timer.",
  },
  {
    kicker: "No guilt",
    title: "Skip anything that doesn’t feel good.",
    body: "Office workout exercises for workers shouldn’t hurt. Skip a move, stop early, or come back tomorrow. Showing up is the streak.",
  },
];

export function OnboardingView() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const last = index === slides.length - 1;

  function finish() {
    completeOnboarding();
    router.replace("/");
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark size={32} />
          <span className="font-display text-lg font-semibold text-ink">
            DeskBreak
          </span>
        </div>
        <button
          type="button"
          onClick={finish}
          className="min-h-11 rounded-full px-3 text-sm font-semibold text-ink/50 transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.64,1)] active:scale-95"
        >
          Skip
        </button>
      </header>

      <main className="flex flex-1 flex-col justify-center py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">
          {slide.kicker}
        </p>
        <h1
          key={slide.title}
          className="mt-3 font-display text-[2.15rem] font-semibold leading-[1.12] tracking-tight text-ink animate-[stepIn_280ms_cubic-bezier(0.34,1.2,0.64,1)]"
        >
          {slide.title}
        </h1>
        <p
          key={slide.body}
          className="mt-4 text-[1.05rem] leading-relaxed text-ink/65 animate-[stepIn_280ms_cubic-bezier(0.34,1.2,0.64,1)]"
        >
          {slide.body}
        </p>
      </main>

      <div className="mb-5 flex justify-center gap-2">
        {slides.map((_, i) => (
          <span
            key={i}
            className={[
              "h-2 rounded-full transition-all duration-200",
              i === index ? "w-7 bg-coral" : "w-2 bg-ink/15",
            ].join(" ")}
          />
        ))}
      </div>

      <Button
        onClick={() => {
          if (last) finish();
          else setIndex((i) => i + 1);
        }}
      >
        {last ? "Let’s move" : "Next"}
      </Button>
    </div>
  );
}
