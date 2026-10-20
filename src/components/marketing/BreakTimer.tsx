"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { StartResetButton } from "@/components/marketing/LandingCta";
import { track } from "@/lib/analytics";
import { playAdvanceChime, unlockAudio, vibrateCue } from "@/lib/audio-cues";
import { brandAsset } from "@/lib/brand";

/**
 * The public desk break timer: pick an interval, get a chime and a browser
 * notification when it ends, then start a reset or the next interval.
 *
 * The end time is stored, not a countdown, so a throttled background tab or a
 * reload never drifts. Storage is a per-browser convenience under its own key,
 * never the app's state key, and every read and write may fail.
 */
const PRESETS = [20, 30, 45, 60, 90] as const;
const MIN_MINUTES = 5;
const MAX_MINUTES = 180;
const SNOOZE_MINUTES = 5;
const STORAGE_KEY = "deskbreak.timer.v1";

type Phase = "idle" | "running" | "paused" | "done";
type Saved = { minutes: number; endAt?: number | null };

function readSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Saved;
    return typeof parsed.minutes === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function writeSaved(saved: Saved): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Private windows and blocked storage: the timer still works this visit.
  }
}

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 30;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)));
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(hours ? 2 : 1, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function notify(): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const note = new Notification("Time for a desk break", {
      body: "Stand up, move for a few minutes, then start the next interval.",
      icon: brandAsset("/icons/icon-192.png"),
      tag: "deskbreak-timer",
    });
    note.onclick = () => {
      window.focus();
      note.close();
    };
  } catch {
    // Some mobile browsers only notify from a service worker. The chime and
    // the on-page prompt still fire.
  }
}

export function BreakTimer() {
  const [minutes, setMinutes] = useState(30);
  const [phase, setPhase] = useState<Phase>("idle");
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(30 * 60_000);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const baseTitle = useRef<string>("");

  // Restore the chosen interval, and a timer still running from a reload.
  useEffect(() => {
    baseTitle.current = document.title;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    const saved = readSaved();
    if (saved) {
      const restored = clampMinutes(saved.minutes);
      setMinutes(restored);
      if (saved.endAt && saved.endAt > Date.now()) {
        setEndAt(saved.endAt);
        setRemainingMs(saved.endAt - Date.now());
        setPhase("running");
      } else {
        setRemainingMs(restored * 60_000);
      }
    }
    return () => {
      document.title = baseTitle.current;
    };
  }, []);

  const finish = useCallback(() => {
    setPhase("done");
    setEndAt(null);
    setRemainingMs(0);
    writeSaved({ minutes, endAt: null });
    document.title = "Time for a break | DeskBreak";
    playAdvanceChime();
    window.setTimeout(playAdvanceChime, 700);
    vibrateCue(400);
    notify();
    track("timer_finished", { minutes });
  }, [minutes]);

  useEffect(() => {
    if (phase !== "running" || endAt === null) return;
    const tick = () => {
      const left = endAt - Date.now();
      if (left <= 0) {
        finish();
        return;
      }
      setRemainingMs(left);
      document.title = `${formatClock(left)} until your break | DeskBreak`;
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase, endAt, finish]);

  function begin(forMinutes: number) {
    unlockAudio();
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission().then(setPermission);
    }
    const next = Date.now() + forMinutes * 60_000;
    setEndAt(next);
    setRemainingMs(forMinutes * 60_000);
    setPhase("running");
    writeSaved({ minutes, endAt: next });
  }

  function start() {
    begin(minutes);
    track("timer_started", { minutes });
  }

  function pause() {
    if (endAt === null) return;
    setRemainingMs(Math.max(0, endAt - Date.now()));
    setEndAt(null);
    setPhase("paused");
    writeSaved({ minutes, endAt: null });
    document.title = baseTitle.current;
  }

  function resume() {
    unlockAudio();
    const next = Date.now() + remainingMs;
    setEndAt(next);
    setPhase("running");
    writeSaved({ minutes, endAt: next });
  }

  function reset() {
    setEndAt(null);
    setPhase("idle");
    setRemainingMs(minutes * 60_000);
    writeSaved({ minutes, endAt: null });
    document.title = baseTitle.current;
  }

  function choose(value: number) {
    const next = clampMinutes(value);
    setMinutes(next);
    if (phase === "idle") setRemainingMs(next * 60_000);
    writeSaved({ minutes: next, endAt: phase === "running" ? endAt : null });
  }

  const editable = phase === "idle";

  return (
    <div className="surface-elevated px-5 py-6 sm:px-7">
      {phase === "done" ? (
        <div role="status" aria-live="assertive">
          <p className="font-display font-extrabold text-2xl text-ink">Time for a break.</p>
          <p className="mt-1 text-muted">
            Stand up, look away from the screen, and move for a few minutes. Or follow a guided one.
          </p>
          <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
            <StartResetButton need="general" minutes={3} source="break_timer" seo>
              Start a guided 3-minute reset
            </StartResetButton>
            <Button variant="secondary" block={false} className="px-5" onClick={() => begin(minutes)}>
              Start the next {minutes} minutes
            </Button>
            <Button variant="tertiary" block={false} onClick={() => begin(SNOOZE_MINUTES)}>
              Snooze {SNOOZE_MINUTES} minutes
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold text-muted">Remind me every</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Interval in minutes">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={!editable}
                aria-pressed={minutes === preset}
                onClick={() => choose(preset)}
                className={`min-h-11 rounded-full border px-4 font-semibold transition-colors disabled:opacity-45 ${
                  minutes === preset ? "border-pen bg-pen text-white" : "border-line-strong bg-sheet text-ink hover:bg-accent-soft"
                }`}
              >
                {preset} min
              </button>
            ))}
            <label className="flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-sheet px-4 text-ink">
              <span className="sr-only">Custom interval in minutes</span>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                disabled={!editable}
                value={minutes}
                onChange={(event) => choose(Number(event.target.value))}
                className="w-14 bg-transparent font-semibold outline-none disabled:opacity-45"
              />
              <span className="text-sm text-muted">min</span>
            </label>
          </div>

          <p
            className="mt-6 font-display font-extrabold text-[3.5rem] leading-none tabular-nums text-ink"
            aria-live="off"
            aria-label={`${formatClock(remainingMs)} until your break`}
          >
            {formatClock(remainingMs)}
          </p>

          <div className="mt-6 grid gap-3 sm:flex">
            {phase === "idle" ? (
              <Button block={false} className="px-6" onClick={start}>
                Start timer
              </Button>
            ) : null}
            {phase === "running" ? (
              <Button variant="secondary" block={false} className="px-6" onClick={pause}>
                Pause
              </Button>
            ) : null}
            {phase === "paused" ? (
              <Button block={false} className="px-6" onClick={resume}>
                Resume
              </Button>
            ) : null}
            {phase !== "idle" ? (
              <Button variant="tertiary" block={false} onClick={reset}>
                Reset
              </Button>
            ) : null}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            {permission === "granted"
              ? "You'll get a notification and a chime when it ends. Keep this tab open."
              : permission === "denied"
                ? "Notifications are blocked for this site, so listen for the chime. Keep this tab open."
                : permission === "unsupported"
                  ? "This browser can't show notifications here, so listen for the chime. Keep this tab open."
                  : "When you start, your browser may ask to show a notification when time is up. Keep this tab open."}
          </p>
        </>
      )}
    </div>
  );
}
