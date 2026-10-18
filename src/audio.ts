// Tiny synthesized sound effects, so the game needs no audio files.

let ctx: AudioContext | null = null;
let muted = false;

/** Browsers only allow audio after a user gesture; call this from a click handler. */
export function unlockAudio(): void {
  ctx ??= new AudioContext();
  void ctx.resume();
}

export function toggleMuted(): boolean {
  muted = !muted;
  return muted;
}

interface ToneOptions {
  type?: OscillatorType;
  /** Frequency to slide to by the end of the tone. */
  to?: number;
  vol?: number;
  delay?: number;
}

function tone(freq: number, duration: number, opts: ToneOptions = {}): void {
  if (!ctx || muted) return;
  const start = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? 'square';
  osc.frequency.setValueAtTime(freq, start);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, start + duration);
  gain.gain.setValueAtTime(opts.vol ?? 0.1, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sfx = {
  jump: () => tone(330, 0.18, { to: 660, vol: 0.06 }),
  doubleJump: () => tone(520, 0.2, { to: 1040, vol: 0.06, type: 'triangle' }),
  dash: () => tone(220, 0.16, { to: 70, vol: 0.05, type: 'sawtooth' }),
  star: () => [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, { type: 'triangle', delay: i * 0.06, vol: 0.09 })),
  stomp: () => tone(320, 0.16, { to: 60, vol: 0.1 }),
  hurt: () => tone(240, 0.35, { to: 90, vol: 0.08, type: 'sawtooth' }),
  win: () =>
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
      tone(f, 0.28, { type: 'triangle', delay: i * 0.14, vol: 0.1 }),
    ),
};
