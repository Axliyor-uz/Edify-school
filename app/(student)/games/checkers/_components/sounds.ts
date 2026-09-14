/**
 * Game sounds — synthesized with WebAudio (zero audio assets, works offline).
 * Wood-like click for moves, deeper thunk for captures, a small chime for
 * crowning, short jingles for win/lose. Muting persists in localStorage.
 */

const MUTE_KEY = 'checkers_muted';

let ctx: AudioContext | null = null;
const audio = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

export const isMuted = (): boolean =>
  typeof window !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';

export const setMuted = (muted: boolean) => {
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
};

/** One damped sine "knock". */
const knock = (ac: AudioContext, freq: number, duration: number, gain: number, delay = 0) => {
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.55), t0 + duration);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
};

/** A short bright tone (chimes / jingles). */
const tone = (ac: AudioContext, freq: number, duration: number, gain: number, delay = 0) => {
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
};

const play = (fn: (ac: AudioContext) => void) => {
  if (isMuted()) return;
  const ac = audio();
  if (ac) {
    try { fn(ac); } catch { /* audio is never critical */ }
  }
};

export const sfx = {
  move: () => play(ac => knock(ac, 950, 0.07, 0.25)),
  capture: () => play(ac => { knock(ac, 500, 0.1, 0.4); knock(ac, 220, 0.16, 0.3, 0.02); }),
  crown: () => play(ac => { tone(ac, 660, 0.15, 0.2); tone(ac, 990, 0.22, 0.2, 0.1); }),
  win: () => play(ac => {
    [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, 0.25, 0.22, i * 0.12));
  }),
  lose: () => play(ac => { tone(ac, 330, 0.3, 0.2); tone(ac, 262, 0.45, 0.2, 0.18); }),
  illegal: () => play(ac => knock(ac, 180, 0.08, 0.15)),
};
