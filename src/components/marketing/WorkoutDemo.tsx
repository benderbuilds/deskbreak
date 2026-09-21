"use client";

import { useEffect, useState } from "react";
import { CharacterArt } from "@/components/CharacterArt";

/** One step of the demo. `next` is the real routine's next move, not the loop's. */
export type DemoMove = { id: string; name: string; seconds: number; next: string };

/** How long each move stays on screen. The timer runs sped up to match. */
const MOVE_MS = 3600;
const TICK_MS = 100;

/**
 * A muted loop of the workout screen for the landing page: the move, Stretch
 * demonstrating it, a countdown, and what's next. Built from the real routine
 * so it can't drift from what "Start" does.
 *
 * Under reduced motion it renders one static frame and never starts a timer.
 */
export function WorkoutDemo({ moves, totalSteps }: { moves: DemoMove[]; totalSteps: number }) {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Start only in the browser, so the server HTML is the static frame.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaying(true);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setElapsed((value) => value + TICK_MS);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!moves.length) return null;

  const loop = MOVE_MS * moves.length;
  const t = elapsed % loop;
  const index = Math.floor(t / MOVE_MS);
  const progress = playing ? (t % MOVE_MS) / MOVE_MS : 0;
  const move = moves[index];
  const remaining = Math.max(1, Math.ceil(move.seconds * (1 - progress)));

  return (
    <figure className="flex flex-col items-center">
      <div
        role="img"
        aria-label={`Preview of a DeskBreak reset: ${moves.map((entry) => entry.name).join(", ")}, each with a countdown and what's up next.`}
        className="relative w-[248px] overflow-hidden rounded-[40px] border-[9px] border-ink bg-pen-deep sm:w-[272px]"
      >
        <div aria-hidden="true" className="relative flex aspect-[9/17.5] flex-col px-4 pb-4 pt-5 text-white">
          {/* The field drains downward as the move's time runs out. */}
          <div
            className="absolute inset-x-0 bottom-0 bg-pen"
            style={{ height: `${(1 - progress) * 100}%`, transition: playing && progress > 0 ? `height ${TICK_MS}ms linear` : "none" }}
          />

          <div className="relative flex gap-1">
            {Array.from({ length: totalSteps }, (_, step) => (
              <span key={step} className={`h-1 flex-1 rounded-full ${step <= index ? "bg-white" : "bg-white/25"}`} />
            ))}
          </div>
          <p className="relative mt-3 text-center text-[11px] font-semibold text-white/85">
            {index + 1} of {totalSteps}
          </p>

          <div className="relative mt-2 flex justify-center">
            <div className="grid aspect-square w-[62%] place-items-center rounded-full bg-paper">
              <CharacterArt key={move.id} pose="exercise" exerciseId={move.id} animate={playing} size={120} alt="" className="h-[84%] w-auto" />
            </div>
          </div>

          <p className="relative mt-3 text-center font-display text-[1.3rem] font-extrabold leading-tight">{move.name}</p>
          <p className="relative text-center font-display text-[4.2rem] font-extrabold leading-[0.9] tabular-nums">
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          </p>
          <p className="relative mt-auto text-center text-xs font-semibold text-white/90">Up next: {move.next}</p>
        </div>
      </div>
      <figcaption className="mt-3 text-sm text-muted">
        The {totalSteps}-move Desk Reset{playing ? ", sped up" : ""}.
      </figcaption>
    </figure>
  );
}
