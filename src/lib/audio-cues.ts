"use client";

/**
 * Countdown tones and spoken instructions.
 *
 * Everything here is best-effort: audio can be blocked, speech can be missing,
 * and neither may ever block or break the timer.
 */
let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx?.state === "suspended") void ctx.resume();
}

function tone(frequency: number, at: number, length: number, gainLevel = 0.06): void {
  const ctx = getContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(gainLevel, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

/** Short tick for 3, 2, 1. */
export function playCountdownTick(): void {
  const ctx = getContext();
  if (!ctx || ctx.state === "suspended") return;
  tone(880, ctx.currentTime + 0.01, 0.12, 0.05);
}

/** Two-note chime when a move ends and the next begins. */
export function playAdvanceChime(): void {
  const ctx = getContext();
  if (!ctx || ctx.state === "suspended") return;
  const t = ctx.currentTime + 0.01;
  tone(660, t, 0.16);
  tone(990, t + 0.14, 0.2);
}

let speakingSupported: boolean | null = null;

export function canSpeak(): boolean {
  if (speakingSupported !== null) return speakingSupported;
  speakingSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function";
  return speakingSupported;
}

/** Speaks one instruction, cancelling anything still queued. */
export function speak(text: string): void {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* speech is a nicety */
  }
}

export function stopSpeaking(): void {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
