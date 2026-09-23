"use client";

import { useEffect, useRef, useState } from "react";
import { CharacterArt } from "@/components/CharacterArt";

/** One step of the demo. `next` is the real routine's next move, not the loop's. */
export type DemoMove = { id: string; name: string; seconds: number; next: string };

/** How long each move stays on screen. The timer runs sped up to match. */
const MOVE_MS = 3600;
const TICK_MS = 100;

/**
 * A compact preview of the workout screen for the landing page: the move,
 * Stretch demonstrating it, a countdown, and what's next. Built from the real
 * routine so it can't drift from what "Start" does.
 *
 * It is a picture of the product, never the product: it starts no session,
 * runs no engine and sends no workout events.
 *
 * Under reduced motion it renders one static frame and never starts a timer.
 * Autoplay also stops while the tab is hidden, and for good once someone has
 * chosen a move themselves.
 */
export function WorkoutDemo({ moves, totalSteps }: { moves: DemoMove[]; totalSteps: number }) {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // The preference is only readable in the browser, after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReduced(true);
      return;
    }
    // Start only in the browser, so the server HTML is the static frame.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      // Off screen, the loop is doing nothing anyone can see.
      const box = frame.current?.getBoundingClientRect();
      if (box && (box.bottom < -200 || box.top > window.innerHeight + 200)) return;
      setElapsed((value) => {
        const next = value + TICK_MS;
        if (next >= MOVE_MS) {
          setIndex((current) => (current + 1) % moves.length);
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, moves.length]);

  if (!moves.length) return null;

  const move = moves[index];
  const progress = playing ? elapsed / MOVE_MS : 0;
  const remaining = Math.max(1, Math.ceil(move.seconds * (1 - progress)));

  /** A deliberate choice wins over the loop, rather than being overwritten by it. */
  function step() {
    setPlaying(false);
    setElapsed(0);
    setIndex((current) => (current + 1) % moves.length);
  }

  return (
    <figure className="w-full max-w-[26rem]">
      <div
        ref={frame}
        role="img"
        aria-label={`Preview of a DeskBreak reset: ${moves.map((entry) => entry.name).join(", ")}, each with a countdown and what's up next.`}
        className="relative overflow-hidden rounded-[22px] bg-field-drained"
      >
        <div aria-hidden="true" className="relative flex items-center gap-4 px-4 py-4 text-white">
          {/* The field drains downward as the move's time runs out. */}
          <div
            className="absolute inset-x-0 bottom-0 bg-field"
            style={{
              height: `${(1 - progress) * 100}%`,
              transition: playing && progress > 0 ? `height ${TICK_MS}ms linear` : "none",
            }}
          />

          <div className="relative grid aspect-square w-[6.5rem] shrink-0 place-items-center rounded-full bg-paper sm:w-[7.5rem]">
            <CharacterArt
              key={move.id}
              pose="exercise"
              exerciseId={move.id}
              animate={playing}
              size={120}
              alt=""
              className="h-[84%] w-auto"
            />
          </div>

          <div className="relative min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/75">
              {index + 1} of {totalSteps}
            </p>
            <p className="mt-0.5 font-display text-[1.35rem] font-extrabold leading-tight">{move.name}</p>
            <p className="font-display text-[2.6rem] font-extrabold leading-[0.95] tabular-nums">
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
            </p>
            <p className="mt-1 truncate text-xs font-semibold text-white/85">Up next: {move.next}</p>
          </div>
        </div>

        <div className="relative flex gap-1 px-4 pb-4">
          {Array.from({ length: totalSteps }, (_, dot) => (
            <span key={dot} className={`h-1 flex-1 rounded-full ${dot <= index ? "bg-note" : "bg-white/25"}`} />
          ))}
        </div>
      </div>

      {/* Wraps rather than pushing the page sideways on a 320px phone. */}
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-muted">
        <span className="min-w-0">
          {`${totalSteps}-move Desk Reset. `}
          {reduced ? "Preview." : playing ? "Preview, sped up." : "Preview, paused."}
        </span>
        {reduced ? null : (
          <span className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              className="min-h-11 rounded-[12px] px-3 text-sm font-semibold text-ink hover:bg-accent-soft"
            >
              {playing ? "Pause preview" : "Play preview"}
            </button>
            <button
              type="button"
              onClick={step}
              className="min-h-11 rounded-[12px] px-3 text-sm font-semibold text-ink hover:bg-accent-soft"
            >
              Next move in preview
            </button>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
