const NOTES = [523.25, 659.25, 783.99, 1046.5] as const;

let audioCtx: AudioContext | null = null;
let lastPlayedKey: string | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

export function unlockCelebrationAudio(): void {
  const ctx = getContext();
  if (ctx?.state === "suspended") void ctx.resume();
}

export function playCelebrationTune(key?: string): void {
  if (typeof window === "undefined") return;
  if (key && lastPlayedKey === key) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = getContext();
  if (!ctx) return;
  if (key) lastPlayedKey = key;

  const start = () => {
    const t0 = ctx.currentTime + 0.02;
    NOTES.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const at = t0 + i * 0.1;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.07, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.34);
    });
  };

  if (ctx.state === "suspended") {
    void ctx.resume().then(start).catch(() => {
      /* autoplay blocked — visual celebration still runs */
    });
    return;
  }
  start();
}
