import { Synth, note } from '../core'
export { mtof, note } from '../core'

/**
 * Shared vocabulary for the sound themes. A theme is a song (scheduled a bar at a time into
 * a destination node) plus the full set of interaction sounds. Notation helpers live here
 * so every theme file reads like a score.
 */

export interface Voice { base: number; wave: OscillatorType; wobble: number; seed: number }

export interface Song {
  bpm: number
  swing?: number // delay (in sixteenths) applied to the off-beat 8ths
  bars: number
  /** Sixteenth steps per bar (default 16; 12 for a waltz). */
  steps?: number
  bar(s: Synth, bar: number, t0: number, step: number, dest: AudioNode): void
}

export interface Sfx {
  blip(s: Synth, t: number, ch: string, v: Voice, i: number): void
  typed(s: Synth, t: number): void
  hover(s: Synth, t: number): void
  mumble(s: Synth, t: number, label: string, v: Voice): void
  select(s: Synth, t: number): void
  drumroll(s: Synth, t: number, dur: number): void
  correct(s: Synth, t: number): void
  wrong(s: Synth, t: number): void
  stamp(s: Synth, t: number, right: boolean): void
  crowd(s: Synth, t: number, right: boolean): void
  page(s: Synth, t: number): void
  fanfare(s: Synth, t: number, ratio: number): void
}

export interface Theme {
  id: string
  name: string
  /** Level trims so every theme sits at the same loudness (tuned with scripts/audio-qa.mjs). */
  musicGain: number
  sfxGain: number
  song: Song
  sfx: Sfx
}

// ---------------------------------------------------------------------------
// notation helpers

export interface Ev { i: number; n: number; len: number }

/** Space-separated 16th-note steps: note names, '.' rest, '-' tie, '|' ignored. */
export function line(str: string): Ev[] {
  const toks = str.trim().split(/\s+/).filter((t) => t !== '|')
  const out: Ev[] = []
  let prevEnd = -1
  toks.forEach((tok, i) => {
    if (tok === '.') return
    if (tok === '-') { const last = out[out.length - 1]; if (last && prevEnd === i) { last.len++; prevEnd = i + 1 } return }
    out.push({ i, n: note(tok), len: 1 })
    prevEnd = i + 1
  })
  return out
}

/** Groups a line() score by 16-step bar; each event's `i` is rebased to its step within the bar. */
export function byBar(evs: Ev[]): Map<number, Ev[]> {
  const m = new Map<number, Ev[]>()
  for (const e of evs) { const b = Math.floor(e.i / 16); if (!m.has(b)) m.set(b, []); m.get(b)!.push({ ...e, i: e.i - b * 16 }) }
  return m
}

/** 'x..x..x.' style hit patterns: x = 1, X = accent, o = ghost. */
export function hits(str: string): [number, number][] {
  const out: [number, number][] = []
  str.replace(/\s|\|/g, '').split('').forEach((c, i) => { if (c === 'x') out.push([i, 1]); else if (c === 'X') out.push([i, 1.5]); else if (c === 'o') out.push([i, 0.45]) })
  return out
}

export const chord = (s: string) => s.trim().split(/\s+/).map(note)
export const rnd = (seed: number) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x) }

export function stepTime(t0: number, i: number, step: number, swing = 0) {
  const j = i % 16
  return t0 + j * step + (j % 4 === 2 ? swing * step : 0)
}

export function isLetter(ch: string) { return /[a-z0-9]/i.test(ch) }
export function letterDegree(ch: string, i: number) { return (ch.toLowerCase().charCodeAt(0) * 7 + (i % 3)) % 7 }

/** A choir of voices singing a vowel: used for crowd gasps, "ooh"s and "aww"s. */
export function choir(s: Synth, t: number, dur: number, vowel: 'oo' | 'aa' | 'ah' | 'ee' | 'oh', o: { gain?: number; pitch?: number; slide?: number; voices?: number; dest?: AudioNode } = {}) {
  const F: Record<string, [number, number]> = { oo: [320, 800], oh: [450, 850], aa: [700, 1150], ah: [650, 1080], ee: [300, 2300] }
  const [f1, f2] = F[vowel]
  const n = o.voices ?? 7
  for (let k = 0; k < n; k++) {
    const p = (o.pitch ?? 190) * (0.75 + rnd(t * 31 + k) * 0.7)
    const start = t + rnd(k * 7 + t) * 0.08
    s.tone(p, start, dur, { type: 'sawtooth', gain: (o.gain ?? 0.05) / Math.sqrt(n), a: dur * 0.25, d: dur, s: 0.8, r: dur * 0.4, slide: o.slide, vib: { rate: 4.5 + rnd(k) * 2, cents: 18 }, filter: { type: 'bandpass', freq: f1, q: 5 }, filter2: { type: 'peaking', freq: f2, q: 4, gain: 12 }, pan: (rnd(k * 3 + 1) - 0.5) * 0.9, verb: 0.25, dest: o.dest })
  }
}

export function applause(s: Synth, t: number, dur: number, density = 45, gain = 0.07) {
  const n = Math.floor(dur * density)
  for (let i = 0; i < n; i++) {
    const tt = t + (i / density) + rnd(i + t) * 0.03
    const fade = 1 - i / n
    s.noise(tt, 0.03 + rnd(i * 3) * 0.03, { gain: (0.4 + rnd(i * 5) * 0.6) * gain * fade, filter: { type: 'bandpass', freq: 1200 + rnd(i * 7) * 2600, q: 0.8 }, pan: rnd(i * 11) - 0.5 })
  }
}


// ---------------------------------------------------------------------------
// per-song effect returns

const sends = new WeakMap<AudioNode, Map<string, AudioNode>>()

/**
 * An effect return built once per song run and reused on every bar: `dest` is the song's
 * own fader, so returns are keyed on it and go away with it.
 *   const echo = send(dest, 'echo', () => s.delayBus(dest, 0.375, 0.4, 0.3))
 */
export function send(dest: AudioNode, key: string, make: () => AudioNode): AudioNode {
  let m = sends.get(dest)
  if (!m) { m = new Map(); sends.set(dest, m) }
  let n = m.get(key)
  if (!n) { n = make(); m.set(key, n) }
  return n
}

/** Continuous vinyl crackle for one bar: sparse clicks and a little dust. */
export function crackle(s: Synth, t0: number, dur: number, dest: AudioNode, gain = 0.03) {
  const n = Math.floor(dur * 14)
  for (let i = 0; i < n; i++) {
    const tt = t0 + rnd(i * 3.1 + t0 * 7) * dur
    s.noise(tt, 0.004 + rnd(i + t0) * 0.006, { gain: gain * (0.3 + rnd(i * 5 + t0) * 0.7), filter: { type: 'highpass', freq: 2500 + rnd(i * 9) * 3000, q: 0.7 }, dest })
  }
  s.noise(t0, dur, { gain: gain * 0.35, a: 0.05, d: dur, s: 1, r: 0.05, filter: { type: 'bandpass', freq: 5500, q: 0.4 }, dest })
}
