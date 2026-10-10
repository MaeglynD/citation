import { Synth, mtof, note } from '../core'
import { type Theme, type Ev, line, chord, rnd, choir, applause, send, letterDegree, isLetter } from './helpers'

/**
 * HAUNTED: a carnival-of-souls waltz. E minor with the harmonic-minor leading tone (D#), 132 BPM
 * in 3/4 (twelve sixteenths a bar), 32 bars. A music box carries the tune over a pipe-organ pedal
 * in a cathedral reverb and an oom-pah-pah of plucked string and soft chords. The second half adds
 * a theremin counter-melody and the organ fills in full chords; a church bell tolls at the section
 * boundaries and a floorboard creaks every four bars.
 *
 *   A  bars 0-7    Em Em B7 B7 | Em Em Am B7          music box, organ pedal, oom (pah-pah from bar 4)
 *      bars 8-15   Em Em C  C  | Am F#o B7 B7         the tune climbs to G6, a descending run into the turnaround
 *   B  bars 16-23  Em Em G  G  | Am Am B7 B7          bell toll, theremin enters, organ chords
 *      bars 24-31  C  C  Am Am | Em Em C  B7          climax (second music box an octave down), run, bell on the V
 */

const BPM = 132
const STEPS = 12
const BARS = 32

const PROG = [
  'Em', 'Em', 'B7', 'B7', 'Em', 'Em', 'Am', 'B7',
  'Em', 'Em', 'C', 'C', 'Am', 'F#o', 'B7', 'B7',
  'Em', 'Em', 'G', 'G', 'Am', 'Am', 'B7', 'B7',
  'C', 'C', 'Am', 'Am', 'Em', 'Em', 'C', 'B7',
]
/** The oom: root, and the fifth when the chord carries over from the previous bar. Also the organ pedal. */
const BASS: Record<string, [number, number]> = {
  Em: [note('E2'), note('B2')], B7: [note('B1'), note('F#2')], Am: [note('A1'), note('E2')],
  C: [note('C2'), note('G2')], G: [note('G2'), note('D2')], 'F#o': [note('F#2'), note('C3')],
}
/** The pah-pah, three close voices that move by step. */
const PAH: Record<string, number[]> = {
  Em: chord('G3 B3 E4'), B7: chord('F#3 A3 D#4'), Am: chord('A3 C4 E4'),
  C: chord('G3 C4 E4'), G: chord('G3 B3 D4'), 'F#o': chord('F#3 C4 D#4'),
}
/** Full organ chords for the B section, voiced so every change is stepwise. */
const ORGAN: Record<string, number[]> = {
  Em: chord('E3 G3 B3 E4'), G: chord('D3 G3 B3 D4'), Am: chord('E3 A3 C4 E4'),
  B7: chord('D#3 A3 B3 F#4'), C: chord('E3 G3 C4 E4'), 'F#o': chord('F#3 A3 C4 D#4'),
}

interface Hit extends Ev { from: number }
/** line() on a 12-step grid, grouped by bar; `from` is the previous note (for the theremin's scoops). */
function score(str: string, offset = 0): Map<number, Hit[]> {
  const m = new Map<number, Hit[]>()
  let prev = -1
  for (const e of line(str)) {
    const b = offset + Math.floor(e.i / STEPS)
    if (!m.has(b)) m.set(b, [])
    m.get(b)!.push({ i: e.i % STEPS, n: e.n, len: e.len, from: prev < 0 ? e.n - 5 : prev })
    prev = e.n
  }
  return m
}

// the music box, 12 steps a bar
const BOX = score(`
E5 - - - G5 - - - B5 - - - |
E6 - - - - - - - - - - - |
D#6 - - - B5 - - - F#5 - - - |
A5 - - - - - - - . . . . |
G5 - F#5 - E5 - - - G5 - - - |
B5 - - - - - - - G5 - A5 - |
C6 - - - B5 - A5 - E5 - - - |
F#5 - - - - - - - D#5 - - - |
E5 - - - G5 - - - B5 - - - |
E6 - - - - - - - F#6 - - - |
G6 - - - - - - - E6 - - - |
C6 - - - - - - - G5 - - - |
A5 - B5 - C6 - - - E6 - - - |
D#6 - - - C6 - - - A5 - - - |
B5 - A5 - G5 - F#5 - E5 - D#5 - |
F#5 - - - - - - - . . . . |
. . . . B5 - - - E6 - - - |
G6 - - - - - F#6 - E6 - - - |
D6 - - - B5 - - - G5 - - - |
B5 - - - - - - - . . . . |
A5 - B5 - C6 - - - E6 - - - |
A6 - - - - - - - E6 - - - |
F#6 - - - D#6 - - - B5 - - - |
A5 - - - - - - - F#5 - - - |
G5 - - - C6 - - - E6 - - - |
G6 - - - - - F#6 - E6 - - - |
C6 - - - A5 - - - E5 - - - |
F#5 - G5 - A5 - - - C6 - - - |
B5 - - - - - - - G5 - - - |
E5 - - - - - - - . . . . |
C6 - B5 - A5 - G5 - F#5 - E5 - |
D#5 - - - - - - - . . . . |`)

// the theremin, bars 16..31: long notes that scoop in from the previous one
const THEREMIN = score(`
. . . . B4 - - - - - - - |
- - - - - - - - A4 - - - |
G4 - - - - - - - - - - - |
- - - - - - - - B4 - - - |
C5 - - - - - - - - - - - |
- - - - - - - - E5 - - - |
D#5 - - - - - - - - - - - |
- - - - - - - - - - - - |
E5 - - - - - - - - - - - |
- - - - - - - - C5 - - - |
A4 - - - - - - - - - - - |
- - - - - - - - B4 - - - |
G4 - - - - - - - - - - - |
- - - - - - - - F#4 - - - |
E4 - - - - - - - - - - - |
D#4 - - - - - - - . . . . |`, 16)

// ---------------------------------------------------------------------------
// instruments

/** Music box: a bright inharmonic FM tine (ratio 3.5) with a tiny mechanism click. */
const box = (s: Synth, n: number, t: number, dest: AudioNode, g: number, pan = 0, ring = 0.7) => {
  const f = mtof(n)
  s.fm(f, t, 0.1, { ratio: n >= 88 ? 2.5 : 3.5, index: 1.5, indexEnd: 0.04, indexTime: 0.1, gain: g, a: 0.002, d: ring, s: 0, r: ring * 0.7, pan, dest })
  s.noise(t, 0.005, { gain: g * 0.25, filter: { type: 'highpass', freq: 5000 }, pan, dest })
}
/** Pipe organ: slow attack, held for the bar, darkened by a lowpass. */
const organ = (s: Synth, ns: number[], t: number, len: number, dest: AudioNode, g: number, cut: number, a = 0.15) =>
  ns.forEach((n, k) => s.tone(mtof(n), t, len, { type: 'organ', gain: g, a, d: 0.4, s: 0.9, r: 0.3, filter: { freq: cut, q: 0.6 }, pan: ns.length > 2 ? (k - (ns.length - 1) / 2) * 0.16 : 0, dest }))
/** The oom: a low plucked string with a sine body under it. */
const oom = (s: Synth, n: number, t: number, dest: AudioNode, g: number) => {
  s.pluck(mtof(n), t, { gain: g, decay: 1.4, bright: 0.45, dur: 0.6, dest })
  s.tone(mtof(n), t, 0.28, { type: 'sine', gain: g * 0.55, a: 0.004, d: 0.3, s: 0.3, r: 0.1, dest })
}
/** The pah-pah: soft close-voiced chords with a quick filter dip. */
const pah = (s: Synth, ns: number[], t: number, len: number, dest: AudioNode, g: number) =>
  ns.forEach((n, k) => s.tone(mtof(n), t, len, { type: 'soft', gain: g, a: 0.004, d: 0.12, s: 0.35, r: 0.06, filter: { freq: 2400, to: 900, time: 0.12, q: 1 }, pan: (k - 1) * 0.25, dest }))
/** Theremin: a sine that slides from the previous pitch into the new one, with a wide slow vibrato. */
const theremin = (s: Synth, from: number, n: number, t: number, len: number, dest: AudioNode, g: number) =>
  s.tone(mtof(from), t, len, { type: 'sine', gain: g, a: Math.min(0.3, len * 0.3), d: 0.5, s: 0.9, r: 0.25, slide: mtof(n) / mtof(from), slideTime: Math.min(0.3, len * 0.4), vib: { rate: 6, cents: 60, delay: 0.15 }, pan: -0.25, dest })
/** A distant church bell: inharmonic FM (ratio 2.4), a hum an octave below and the clapper's click. */
const bell = (s: Synth, n: number, t: number, dest: AudioNode, g: number) => {
  const f = mtof(n)
  s.fm(f, t, 2.4, { ratio: 2.4, index: 2.2, indexEnd: 0.25, indexTime: 1.6, gain: g, a: 0.003, d: 2.4, s: 0.12, r: 1.4, dest })
  s.tone(f * 0.5, t, 2.0, { type: 'sine', gain: g * 0.5, a: 0.005, d: 2.0, s: 0.1, r: 1.2, dest })
  s.noise(t, 0.02, { gain: g * 0.6, filter: { type: 'bandpass', freq: f * 8, q: 2 }, dest })
}
/** A floorboard creak: two narrow bandpass sweeps of noise, one up and one back down. */
const creak = (s: Synth, t: number, dest: AudioNode, seed: number) => {
  const f0 = 500 + rnd(seed) * 500
  const pan = rnd(seed + 1) - 0.5
  s.noise(t, 0.4, { gain: 0.1, a: 0.1, d: 0.3, s: 0.6, r: 0.1, filter: { type: 'bandpass', freq: f0, to: f0 * 1.8, time: 0.4, q: 16 }, filter2: { type: 'bandpass', freq: f0 * 1.3, q: 3 }, pan, dest })
  s.noise(t + 0.18, 0.3, { gain: 0.08, a: 0.08, d: 0.25, s: 0.5, r: 0.1, filter: { type: 'bandpass', freq: f0 * 1.6, to: f0 * 0.9, time: 0.3, q: 16 }, pan, dest })
}
/** A short glassy bell for the sound effects (angel chimes, the fanfare). */
const chime = (s: Synth, n: number, t: number, g: number, pan = 0, ring = 0.8) =>
  s.fm(mtof(n), t, 0.25, { ratio: 3, index: 1.6, indexEnd: 0.1, indexTime: 0.15, gain: g, a: 0.002, d: ring, s: 0, r: ring * 0.7, pan, verb: 0.35 })
/** An organ chord for the sound effects, into the global reverb. */
const stab = (s: Synth, ns: number[], t: number, len: number, g: number, cut = 2400, a = 0.02) =>
  ns.forEach((n, k) => s.tone(mtof(n), t, len, { type: 'organ', gain: g, a, d: 0.3, s: 0.9, r: 0.25, filter: { freq: cut, q: 0.7 }, pan: ((k % 3) - 1) * 0.2, verb: 0.4 }))

export const haunted: Theme = {
  id: 'haunted',
  name: 'HAUNTED',
  musicGain: 1.3,
  sfxGain: 1.38,
  song: {
    bpm: BPM,
    bars: BARS,
    steps: STEPS,
    bar(s, b, t0, st, dest) {
      const T = (i: number) => t0 + i * st
      const barLen = st * STEPS
      const name = PROG[b]
      const prevName = PROG[(b + BARS - 1) % BARS]
      const second = b >= 16
      const hall = send(dest, 'hall', () => s.reverbBus(dest, 4, 3, 0.4))
      const room = send(dest, 'room', () => s.reverbBus(dest, 1.5, 3, 0.22))
      // the plucked bass goes through a lowpass so its attack stays warm rather than wiry
      const warm = send(dest, 'warm', () => { const f = s.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; f.Q.value = 0.7; f.connect(dest); return f })
      // dynamics: a quiet first phrase, a climb through the second, the climax at bars 24-29
      const dyn = b < 4 ? 0.8 : b < 8 ? 0.88 : b < 12 ? 0.95 : b < 24 ? 1 : b < 30 ? 1.12 : 1
      // oom: the root, or the fifth when the chord is held over
      const [root, fifth] = BASS[name]
      oom(s, name === prevName ? fifth : root, T(0), warm, 0.5 * dyn)
      // pah pah: from bar 4; the turnaround bars leave beat 3 empty for a breath
      if (b >= 4) for (const j of b === 15 || b === 31 ? [4] : [4, 8]) pah(s, PAH[name], T(j), st * 1.6, room, 0.1 * dyn * (j === 8 ? 0.9 : 1))
      // organ: a pedal of root and fifth throughout, full chords in the B section
      organ(s, BASS[name], T(0), barLen - 0.05, hall, (second ? 0.09 : 0.11) * dyn, 500)
      if (second) organ(s, ORGAN[name], T(0), barLen - 0.05, hall, 0.07 * dyn, 1600)
      // music box melody; a second box an octave down joins for the climax
      const mel = BOX.get(b)
      if (mel) for (const e of mel) {
        const g = 0.26 * dyn * (e.i === 0 ? 1.12 : 1) * (e.n >= 88 ? 0.85 : 1)
        const ring = e.len >= 8 ? 1.0 : 0.7
        box(s, e.n, T(e.i), room, g, 0.18, ring)
        if (b >= 24 && b < 30) box(s, e.n - 12, T(e.i), room, g * 0.5, -0.2, ring)
      }
      // theremin counter-melody, B section only
      const th = THEREMIN.get(b)
      if (th) for (const e of th) theremin(s, e.from, e.n, T(e.i), e.len * st, room, 0.15)
      // the bell tolls at the section boundaries: the tonic going into B, the dominant before the loop
      if (b === 16) bell(s, note('E3'), T(0), hall, 0.3)
      if (b === 31) bell(s, note('B2'), T(0), hall, 0.26)
      // a creak every four bars, somewhere in the second half of the bar
      if (b % 4 === 2) creak(s, T(6 + Math.floor(rnd(b) * 4)), dest, b)
    },
  },
  sfx: {
    blip(s, t, ch, v, i) {
      // bony xylophone taps: a sine with a fast pitch drop and a click of bandpassed noise
      if (!isLetter(ch)) return
      const deg = [0, 2, 3, 5, 7, 8, 11][letterDegree(ch, i)]
      const vowel = /[aeiouy]/i.test(ch)
      const f = v.base * 1.6 * Math.pow(2, deg / 12) * (vowel ? 1.5 : 1)
      const pan = (rnd(i + v.seed) - 0.5) * 0.5
      s.tone(f, t, 0.035, { type: v.wave === 'sawtooth' ? 'triangle' : 'sine', gain: 0.16, a: 0.001, d: 0.05, s: 0, r: 0.025, slide: 0.5 + v.wobble * 0.2, slideTime: 0.04, pan })
      s.noise(t, 0.01, { gain: 0.07, filter: { type: 'bandpass', freq: f * 3, q: 5 }, pan })
    },
    typed(s, t) {
      // an owl: hoo-hoo
      const hoot = (f: number, tt: number, dur: number) =>
        s.tone(f, tt, dur, { type: 'soft', gain: 0.14, a: 0.04, d: 0.25, s: 0.75, r: 0.1, slide: 0.93, slideTime: dur, vib: { rate: 5, cents: 8, delay: 0.1 }, filter: { freq: 700, q: 2 }, filter2: { type: 'peaking', freq: 500, q: 3, gain: 6 }, verb: 0.35 })
      hoot(420, t, 0.16)
      hoot(380, t + 0.24, 0.32)
    },
    hover(s, t) {
      // a tiny ghostly whisper sweeping upward
      s.noise(t, 0.08, { gain: 0.08, a: 0.015, d: 0.06, s: 0.5, r: 0.03, filter: { type: 'bandpass', freq: 900, to: 3200, time: 0.08, q: 5 }, verb: 0.2 })
    },
    mumble(s, t, label, v) {
      // a wobbly theremin saying three syllables
      let tt = t
      let prev = v.base * 1.6
      for (const ch of label.replace(/[^a-z]/gi, '').slice(0, 3)) {
        const deg = [0, 3, 5, 7, 8, 12][ch.toLowerCase().charCodeAt(0) % 6]
        const f = v.base * 1.6 * Math.pow(2, deg / 12)
        s.tone(prev, tt, 0.11, { type: 'soft', gain: 0.09, a: 0.02, d: 0.1, s: 0.8, r: 0.04, slide: f / prev, slideTime: 0.06, vib: { rate: 7 + v.wobble * 3, cents: 70 }, filter: { freq: 2500 }, verb: 0.15 })
        prev = f
        tt += 0.12
      }
    },
    select(s, t) {
      // a short organ chord stab
      stab(s, chord('E3 G3 B3 E4'), t, 0.13, 0.045, 2200, 0.006)
    },
    drumroll(s, t, dur) {
      // thunder: a lowpassed noise swell with gusts for the tremolo and a tremolo'd sub rumble,
      // then the lightning crack at t + dur
      s.noise(t, dur, { gain: 0.16, a: dur * 0.7, d: 0.2, s: 1, r: 0.15, filter: { type: 'lowpass', freq: 140, to: 420, time: dur, q: 1.2 } })
      for (let k = 0; k < 5; k++) s.noise(t + (k / 5) * dur * 0.9, dur / 5, { gain: 0.06 + 0.1 * (k / 5), a: 0.07, d: 0.12, s: 0.4, r: 0.08, filter: { type: 'lowpass', freq: 250 + 60 * k, q: 1 } })
      s.fm(42, t, dur, { ratio: 0.5, index: 2.5, indexEnd: 1.5, indexTime: dur, gain: 0.18, a: dur * 0.6, d: 0.3, s: 1, r: 0.1, tremolo: { rate: 4.5, depth: 0.5 } })
      const tc = t + dur
      s.noise(tc, 0.05, { gain: 0.5, a: 0.001, filter: { type: 'highpass', freq: 2500 } })
      s.noise(tc, 0.35, { gain: 0.3, a: 0.002, d: 0.3, filter: { type: 'lowpass', freq: 6000, to: 400, time: 0.35 } })
      s.tone(70, tc, 0.3, { type: 'sine', gain: 0.4, a: 0.002, d: 0.3, s: 0, r: 0.15, slide: 0.5 })
    },
    correct(s, t) {
      // angelic: E major bells climbing, a choir "ah" opening above them, two high chimes on top
      chord('E4 G#4 B4 E5 G#5 B5 E6').forEach((n, i) => chime(s, n, t + i * 0.075, 0.08, (i - 3) * 0.12))
      choir(s, t + 0.2, 1.1, 'ah', { gain: 0.06, pitch: 330, slide: 1.03, voices: 6 })
      chime(s, note('E7'), t + 0.6, 0.06, 0.2, 1.2)
      chime(s, note('B6'), t + 0.72, 0.05, -0.2, 1.2)
    },
    wrong(s, t) {
      // mwa-ha-ha-ha: a descending string of short choir "ah"s, a theremin dive, and the coffin lid
      choir(s, t, 0.12, 'oo', { gain: 0.07, pitch: 200, slide: 1.1, voices: 4 })
      const has: [number, number, number][] = [[0.1, 196, 0.26], [0.42, 185, 0.16], [0.62, 165, 0.16], [0.82, 147, 0.16], [1.02, 131, 0.3]]
      for (const [dt, p, d] of has) choir(s, t + dt, d, 'ah', { gain: 0.09, pitch: p, slide: 0.9, voices: 4 })
      s.tone(880, t + 0.05, 0.9, { type: 'sine', gain: 0.07, a: 0.05, d: 0.5, s: 0.8, r: 0.15, slide: 0.2, slideTime: 0.9, vib: { rate: 6.5, cents: 80 }, verb: 0.3 })
      s.tone(60, t + 1.25, 0.25, { type: 'sine', gain: 0.45, a: 0.002, d: 0.25, s: 0, r: 0.1, slide: 0.5 })
      s.noise(t + 1.25, 0.08, { gain: 0.2, filter: { type: 'lowpass', freq: 900 } })
    },
    stamp(s, t, right) {
      // a coffin lid slamming: low thud, a wood crack and the dust
      s.tone(right ? 85 : 62, t, 0.22, { type: 'sine', gain: 0.55, a: 0.002, d: 0.22, s: 0, r: 0.12, slide: 0.45 })
      s.noise(t, 0.12, { gain: 0.3, a: 0.001, d: 0.12, filter: { type: 'lowpass', freq: 700 }, verb: 0.3 })
      s.wood(t + 0.004, right ? 1100 : 800, { gain: 0.3 })
      s.noise(t + 0.004, 0.03, { gain: 0.22, filter: { type: 'bandpass', freq: 2200, q: 1.5 } })
    },
    crowd(s, t, right) {
      if (right) {
        // a ghostly "oooh" rising, with a few polite claps
        choir(s, t, 1.0, 'oo', { gain: 0.065, pitch: 210, slide: 1.3, voices: 7 })
        applause(s, t + 0.3, 0.9, 18, 0.05)
      } else {
        // a cackle, then the crowd's descending "oo"
        for (let k = 0; k < 6; k++) choir(s, t + k * 0.085, 0.06, 'ah', { gain: 0.07, pitch: 420 - k * 25, slide: 0.95, voices: 3 })
        choir(s, t + 0.45, 0.9, 'oo', { gain: 0.06, pitch: 240, slide: 0.72, voices: 7 })
      }
    },
    page(s, t) {
      // a creaking door: narrow bandpassed noise wobbling up, down and up, over a groaning hinge
      const f0 = 620
      s.noise(t, 0.16, { gain: 0.09, a: 0.03, d: 0.1, s: 0.7, r: 0.04, filter: { type: 'bandpass', freq: f0, to: f0 * 1.5, time: 0.16, q: 14 } })
      s.noise(t + 0.13, 0.15, { gain: 0.09, a: 0.03, d: 0.1, s: 0.7, r: 0.04, filter: { type: 'bandpass', freq: f0 * 1.45, to: f0 * 1.1, time: 0.15, q: 14 } })
      s.noise(t + 0.26, 0.17, { gain: 0.08, a: 0.03, d: 0.1, s: 0.6, r: 0.06, filter: { type: 'bandpass', freq: f0 * 1.15, to: f0 * 1.9, time: 0.17, q: 14 } })
      s.tone(95, t, 0.4, { type: 'sawtooth', gain: 0.05, a: 0.05, d: 0.3, s: 0.7, r: 0.08, slide: 1.35, vib: { rate: 11, cents: 90 }, filter: { type: 'bandpass', freq: 800, to: 1400, time: 0.4, q: 7 } })
    },
    fanfare(s, t, ratio) {
      if (ratio >= 0.7) {
        // toccata: a tumbling run down E harmonic minor, then the sun comes out in E major with bells
        chord('E6 D#6 B5 A5 G5 F#5 E5 D#5 B4 G4 E4 B3').forEach((n, i) =>
          s.tone(mtof(n), t + i * 0.065, 0.07, { type: 'organ', gain: 0.07, a: 0.004, d: 0.1, s: 0.8, r: 0.03, filter: { freq: 3000 }, verb: 0.3 }))
        stab(s, chord('E2 B2 E3 G#3 B3 E4 G#4'), t + 0.8, 1.7, 0.042)
        chord('E5 G#5 B5 E6 G#6').forEach((n, i) => chime(s, n, t + 0.85 + i * 0.09, 0.07, (i - 2) * 0.15, 1.0))
      } else if (ratio >= 0.4) {
        // the shrug: E minor leaning into E major, with one polite bell on the raised third
        stab(s, chord('E3 G3 B3 E4'), t, 0.7, 0.045, 1800)
        stab(s, chord('E3 G#3 B3 E4'), t + 0.72, 1.1, 0.045, 1800)
        chime(s, note('G#5'), t + 0.74, 0.06, 0.1, 1.0)
      } else {
        // the wolf howl: up, hang, and slowly down with vibrato, over a low organ drone; a second wolf answers
        stab(s, chord('E2 B2'), t, 2.6, 0.05, 500)
        const howl = (f: number, tt: number, g: number) => {
          s.tone(f, tt, 0.55, { type: 'soft', gain: g, a: 0.08, d: 0.4, s: 0.9, r: 0.12, slide: 2, slideTime: 0.5, vib: { rate: 5.5, cents: 20, delay: 0.3 }, filter: { freq: 1800, q: 1 }, verb: 0.4 })
          s.tone(f * 2, tt + 0.5, 1.5, { type: 'soft', gain: g, a: 0.1, d: 0.6, s: 0.85, r: 0.3, slide: 0.6, slideTime: 1.5, vib: { rate: 5.5, cents: 35, delay: 0.1 }, filter: { freq: 1800, q: 1 }, verb: 0.4 })
        }
        howl(330, t + 0.1, 0.1)
        howl(494, t + 0.8, 0.06)
      }
    },
  },
}
