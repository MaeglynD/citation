import { Synth, mtof, note } from '../core'
import { type Theme, line, byBar, chord, rnd, choir, applause, send, isLetter } from './helpers'

/**
 * NOIR: slow, smoky jazz under a red street light. An upright bass walks in quarter notes under
 * brushes and a Rhodes that comps minor ninths on the off-beats; a harmon-muted trumpet only
 * speaks in the second half; a vibraphone turns the corner in bar 15. D minor, 68 BPM, swung.
 *
 * Form, 16 bars:
 *   0-3    Dm  Dm(maj7)  Dm7  Dm6     the line cliche D C# C B in the piano's inner voice
 *   4-5    Gm9                        iv
 *   6-7    Em7b5  A7b9                ii V, a piano fill up the A7b9 into the melody
 *   8-11   Dm  Dm(maj7)  Dm7  Dm6     the trumpet enters
 *   12-13  Gm9  Bbmaj7                the melody's high point, over the bVI this time
 *   14     Em7b5 | A7b9               ii V
 *   15     Dm Bb Em7b5 A7b9           vibraphone turnaround; the drums thin out
 * The ride arrives in bar 2, the feathered kick in bar 4, the ride's skip note in bar 12.
 */

const BPM = 68
/** Off-beat eighths land this far into the next sixteenth: a lazy triplet feel. */
const SW = 0.6

// rootless left-hand voicings, chosen so every change moves by step
const V: Record<string, number[]> = {
  Dm: chord('F3 A3 D4 E4'), DmM7: chord('F3 A3 C#4 E4'), Dm7: chord('F3 A3 C4 E4'), Dm6: chord('F3 A3 B3 E4'),
  Gm9: chord('F3 A3 Bb3 D4'), Bb: chord('F3 A3 C4 D4'), Em: chord('G3 Bb3 D4 E4'), A7: chord('G3 Bb3 C#4 E4'),
}
// harmony per half bar
const HARM = [
  'Dm', 'Dm', 'DmM7', 'DmM7', 'Dm7', 'Dm7', 'Dm6', 'Dm6', 'Gm9', 'Gm9', 'Gm9', 'Gm9', 'Em', 'Em', 'A7', 'A7',
  'Dm', 'Dm', 'DmM7', 'DmM7', 'Dm7', 'Dm7', 'Dm6', 'Dm6', 'Gm9', 'Gm9', 'Bb', 'Bb', 'Em', 'A7', 'Dm', 'A7',
]
// walking bass, four quarters a bar, each last note a step or a half step from the next root
const BASS = [
  'D2 E2 F2 A2', 'D3 C#3 A2 F2', 'D2 F2 G2 A2', 'D3 B2 A2 F#2',
  'G2 A2 Bb2 D3', 'G2 Bb2 F2 Eb2', 'E2 G2 D3 Bb2', 'A2 G2 E2 C#2',
  'D2 F2 A2 C3', 'D3 A2 F2 C#2', 'D2 E2 F2 A2', 'D3 B2 A2 F#2',
  'G2 Bb2 D3 F3', 'Bb2 F2 D2 Eb2', 'E2 Bb2 A2 G2', 'D2 Bb1 E2 A1',
].map(chord)

// the muted trumpet, bars 8..15: a sigh, a climb to the 6th, up to the high G over the bVI,
// the b9 of the V, and one note of rest on the 5th while the vibes take the turnaround
const MEL = byBar(line(`
A4 - - - - - - - - - - - F4 - E4 - |
D4 - - - - - - - - - - - . . . . |
. . . . . . . . A4 - C5 - D5 - - - |
E5 - - - - - - - D5 - - - B4 - - - |
. . . . D5 - - - F5 - - - - - - - |
G5 - - - - - F5 - - - D5 - - - . . |
E5 - - - - - C#5 - - - - - Bb4 - - - |
A4 - - - - - - - . . . . . . . . |`))

// vibraphone turnaround, swung eighths over Dm Bb Em7b5 A7b9
const TURN = chord('F4 A4 D5 F5 G5 E5 C#5 Bb4')

// comping patterns: [step, length in sixteenths]; 14 anticipates the next bar's chord
const COMP: [number, number][][] = [
  [[2, 5], [10, 3]],
  [[6, 6], [14, 2]],
  [[2, 8]],
  [[0, 3], [10, 4]],
  [[6, 4], [12, 3]],
]

/** Step i of the bar on the clock, with the off-beat eighths pushed late. */
const at = (t0: number, i: number, st: number) => t0 + i * st + (i % 4 === 2 ? SW * st : 0)

// ---------------------------------------------------------------------------
// instruments

/** Upright bass: a dull Karplus-Strong string, a sine under it for weight and a thumb thump. */
const bass = (s: Synth, n: number, t: number, dur: number, o: { gain?: number; dest?: AudioNode } = {}) => {
  const f = mtof(n), g = o.gain ?? 0.5
  s.pluck(f, t, { gain: g, decay: 1.0, bright: 0.3, dur, dest: o.dest })
  s.tone(f, t, dur * 0.8, { type: 'sine', gain: g * 0.32, a: 0.01, d: 0.4, s: 0.3, r: 0.08, dest: o.dest })
  s.noise(t, 0.025, { gain: g * 0.2, filter: { type: 'lowpass', freq: 320 }, dest: o.dest })
}

/** Smoky Rhodes: two-op FM at ratio 1, the index falling from a bright tine to a mellow body, a hammer tick per chord. */
const piano = (s: Synth, ns: number[], t: number, dur: number, o: { gain?: number; dest?: AudioNode; verb?: number; roll?: number; damp?: boolean } = {}) => {
  const g = o.gain ?? 0.09
  ns.forEach((n, k) => s.fm(mtof(n), t + (o.roll ?? 0) * k, dur, {
    ratio: 1, index: 1.3, indexEnd: 0.12, indexTime: 0.45, gain: g * (n < 55 ? 0.8 : 1), a: 0.004,
    d: o.damp ? 0.15 : 1.1, s: o.damp ? 0 : 0.3, r: o.damp ? 0.08 : 0.35,
    filter: { freq: 2400 }, pan: (k - (ns.length - 1) / 2) * 0.12, dest: o.dest, verb: o.verb,
  }))
  s.noise(t, 0.012, { gain: g * 0.35, filter: { type: 'bandpass', freq: 1300, q: 1 }, dest: o.dest })
}

interface Horn { gain?: number; dest?: AudioNode; verb?: number; pan?: number; vib?: number; sink?: number; dark?: boolean; wah?: 'open' | 'close' }
/**
 * Harmon-muted trumpet: a sawtooth scooping up into the note, a formant peak near 1.6 kHz, the
 * filter opening on the attack and a slow vibrato arriving late. `dark` is the trombone section
 * (lower formant); `sink` lets the note sag flat by that ratio over its length; `wah` works the mute.
 */
const trumpet = (s: Synth, n: number, t: number, dur: number, o: Horn = {}) => {
  const f = mtof(n)
  const fo = o.wah === 'open' ? { freq: 500, to: 2400, time: dur * 0.8, q: 2.4 }
    : o.wah === 'close' ? { freq: 2400, to: 500, time: dur * 0.9, q: 2.4 }
    : { freq: o.dark ? 700 : 900, to: o.dark ? 1900 : 2600, time: 0.12, q: 1.4 }
  s.tone(o.sink ? f : f * 0.965, t, dur, {
    type: 'sawtooth', gain: o.gain ?? 0.13, a: 0.05, d: 0.3, s: 0.8, r: 0.14,
    slide: o.sink ?? 1 / 0.965, slideTime: o.sink ? dur : 0.09,
    vib: { rate: 5.2, cents: o.vib ?? 22, delay: 0.35 }, shaper: 2,
    filter: fo, filter2: { type: 'peaking', freq: o.dark ? 800 : 1600, q: o.dark ? 1.5 : 3, gain: o.dark ? 6 : 10 },
    pan: o.pan, dest: o.dest, verb: o.verb,
  })
}

/** Vibraphone: FM at ratio 4 with a low index, the motor's tremolo on the way out. */
const vibes = (s: Synth, n: number, t: number, dur: number, o: { gain?: number; dest?: AudioNode; verb?: number; pan?: number } = {}) =>
  s.fm(mtof(n), t, dur, { ratio: 4, index: 0.7, indexEnd: 0.06, indexTime: 0.25, gain: o.gain ?? 0.07, a: 0.003, d: 1.3, s: 0.25, r: 0.8, tremolo: { rate: 4.3, depth: 0.45 }, pan: o.pan, dest: o.dest, verb: o.verb })

/** The stick on the ride's bell. */
const ping = (s: Synth, t: number, o: { gain?: number; dest?: AudioNode } = {}) =>
  s.fm(2200, t, 0.05, { ratio: 1.52, index: 1.8, indexEnd: 0.2, indexTime: 0.15, gain: o.gain ?? 0.04, a: 0.001, d: 0.45, s: 0, r: 0.35, filter: { type: 'highpass', freq: 1800 }, pan: 0.3, dest: o.dest })

/** Brush swish: a sweep that brightens into the beat, then the tap as it lands. */
const swish = (s: Synth, t: number, o: { gain?: number; dest?: AudioNode } = {}) => {
  const g = o.gain ?? 0.07
  s.noise(t - 0.1, 0.24, { gain: g, a: 0.1, d: 0.12, s: 0.25, r: 0.06, filter: { type: 'bandpass', freq: 2400, to: 4200, time: 0.12, q: 0.7 }, filter2: { type: 'highpass', freq: 1500 }, pan: -0.25, dest: o.dest })
  s.noise(t, 0.03, { gain: g * 0.7, filter: { type: 'bandpass', freq: 1900, q: 1.2 }, pan: -0.25, dest: o.dest })
}
/** The brush stirring the snare head between the beats. */
const swirl = (s: Synth, t: number, dur: number, o: { gain?: number; dest?: AudioNode } = {}) =>
  s.noise(t, dur, { gain: o.gain ?? 0.02, a: dur * 0.4, d: dur * 0.5, s: 0.3, r: 0.1, filter: { type: 'bandpass', freq: 3200, q: 0.5 }, filter2: { type: 'highpass', freq: 1200 }, pan: -0.2, dest: o.dest })

/** Rain on the window: a hiss bed and a few drops on the sill. */
const rain = (s: Synth, t0: number, dur: number, seed: number, o: { gain?: number; dest?: AudioNode } = {}) => {
  const g = o.gain ?? 0.02
  s.noise(t0, dur + 0.1, { gain: g, a: 0.4, d: dur, s: 1, r: 0.4, filter: { type: 'highpass', freq: 4500, q: 0.4 }, filter2: { type: 'lowpass', freq: 9500 }, dest: o.dest })
  for (let i = 0; i < 7; i++) {
    const tt = t0 + rnd(seed * 5.3 + i * 1.7) * dur
    s.noise(tt, 0.005 + rnd(seed + i) * 0.006, { gain: g * (0.5 + rnd(seed * 2 + i) * 1.2), filter: { type: 'bandpass', freq: 5000 + rnd(seed * 3 + i) * 5000, q: 2.5 }, pan: rnd(seed * 7 + i) - 0.5, dest: o.dest })
  }
}

export const noir: Theme = {
  id: 'noir',
  name: 'NOIR',
  musicGain: 1.02,
  sfxGain: 0.72,
  song: {
    bpm: BPM,
    swing: SW,
    bars: 16,
    bar(s, b, t0, st, dest) {
      const T = (i: number) => at(t0, i, st)
      const plate = send(dest, 'plate', () => s.reverbBus(dest, 2.5, 2.5, 0.42))
      const room = send(dest, 'room', () => s.reverbBus(dest, 0.55, 3, 0.22))
      const turn = b === 15
      const dyn = b < 4 ? 0.85 : b < 8 ? 0.95 : 1
      rain(s, t0, st * 16, b, { gain: 0.03, dest })
      // the upright walks; beat 1 a touch firmer
      BASS[b].forEach((n, k) => bass(s, n, T(k * 4), st * 3.9, { gain: k === 0 ? 1 : 0.9, dest }))
      // brushes: a stir across each half bar, the swish on 2 and 4, a feathered kick on 1 and 3 from bar 4
      swirl(s, T(0), st * 8, { gain: 0.042 * dyn, dest: room })
      swirl(s, T(8), st * 8, { gain: 0.034 * dyn, dest: room })
      swish(s, T(4), { gain: (turn ? 0.1 : 0.16) * dyn, dest: room })
      swish(s, T(12), { gain: (turn ? 0.095 : 0.15) * dyn, dest: room })
      if (b >= 4 && !turn) { s.kick(T(0), { gain: 0.36, pitch: 66, decay: 0.3, dest }); s.kick(T(8), { gain: 0.25, pitch: 66, decay: 0.26, dest }) }
      if (b >= 2) { s.cymbal(T(0), { gain: 0.07 * dyn, decay: 0.45, base: 440, dest: room }); if (!turn) s.cymbal(T(8), { gain: 0.055 * dyn, decay: 0.4, base: 440, dest: room }) }
      if (b >= 12 && !turn) { ping(s, T(6), { gain: 0.075, dest: room }); ping(s, T(14), { gain: 0.065, dest: room }) }
      // piano: sparse comping on the "and"s, a fill up the A7b9 in bar 7, two hits under the turnaround
      if (b === 7) {
        piano(s, V.A7, T(2), st * 5, { gain: 0.18, dest: room })
        chord('C#4 E4 G4 Bb4').forEach((n, k) => piano(s, [n], T(8 + k * 2), st * 2.4, { gain: 0.17 + k * 0.02, dest: room }))
      } else if (turn) {
        piano(s, V.Dm, T(0), st * 3.5, { gain: 0.18, dest: room })
        piano(s, V.A7, T(12), st * 3.5, { gain: 0.17, dest: room })
      } else {
        const pat = COMP[Math.floor(rnd(b * 3.7 + 1.3) * COMP.length)]
        for (const [i, len] of pat) {
          const name = i >= 14 ? HARM[((b + 1) % 16) * 2] : HARM[b * 2 + (i >= 8 ? 1 : 0)]
          piano(s, V[name], T(i), (T(i + len) - T(i)) * 0.9, { gain: 0.19 * dyn * (0.85 + rnd(b * 11 + i) * 0.3), dest: room })
        }
      }
      // the trumpet, second half only, into the plate
      const mel = MEL.get(b - 8)
      if (mel) for (const e of mel) trumpet(s, e.n, T(e.i), (T(e.i + e.len) - T(e.i)) * 0.95, { gain: 0.25, dest: plate, pan: 0.15 })
      if (turn) TURN.forEach((n, k) => vibes(s, n, T(k * 2), st * 3, { gain: 0.15, dest: plate, pan: (k - 3.5) * 0.1 }))
    },
  },
  sfx: {
    blip(s, t, ch, v, i) {
      // a typewriter key: a bandpassed clack whose colour follows the letter, and the type bar's thunk
      if (!isLetter(ch)) return
      const c = ch.toLowerCase().charCodeAt(0)
      const vowel = /[aeiouy]/i.test(ch)
      const f = (1400 + ((c * 37 + i * 11) % 13) * 120) * (0.85 + v.wobble * 0.3)
      s.noise(t, 0.016, { gain: vowel ? 0.12 : 0.16, a: 0.001, d: 0.014, filter: { type: 'bandpass', freq: f, q: 1.4 }, filter2: { type: 'highpass', freq: 800 }, pan: (rnd(i * 3 + (v.seed % 97)) - 0.5) * 0.5 })
      s.tone(150 + (c % 9) * 12 + (v.base % 50), t, 0.024, { type: 'sine', gain: 0.1, a: 0.001, d: 0.02, s: 0, r: 0.012, slide: 0.5, slideTime: 0.022 })
    },
    typed(s, t) {
      // the margin bell, then the carriage ratchets back and bangs the stop
      s.fm(2960, t, 0.5, { ratio: 1.41, index: 1.1, indexEnd: 0.08, indexTime: 0.3, gain: 0.09, a: 0.001, d: 0.55, s: 0, r: 0.45, verb: 0.3 })
      s.fm(2960 * 2.07, t, 0.2, { ratio: 1.41, index: 0.6, indexEnd: 0.05, gain: 0.03, a: 0.001, d: 0.2, s: 0, r: 0.15 })
      let x = 0.14, gap = 0.03
      for (let k = 0; k < 10; k++) { s.noise(t + x, 0.008, { gain: 0.07, filter: { type: 'bandpass', freq: 2600 + (k % 3) * 400, q: 2 }, pan: -0.3 + k * 0.06 }); x += gap; gap = Math.max(0.012, gap * 0.86) }
      s.tone(110, t + x + 0.02, 0.06, { type: 'sine', gain: 0.22, a: 0.001, d: 0.05, s: 0, r: 0.04, slide: 0.5 })
      s.noise(t + x + 0.02, 0.05, { gain: 0.12, filter: { type: 'lowpass', freq: 900 } })
    },
    hover(s, t) {
      // one damped piano note
      s.fm(mtof(69), t, 0.1, { ratio: 1, index: 1.1, indexEnd: 0.1, indexTime: 0.1, gain: 0.07, a: 0.003, d: 0.14, s: 0, r: 0.1, filter: { freq: 1800 } })
    },
    mumble(s, t, label, v) {
      // three syllables of muted trumpet working the wah, the grown-ups-in-Peanuts voice
      let tt = t
      for (const ch of label.replace(/[^a-z]/gi, '').slice(0, 3)) {
        const deg = [0, 2, 3, 5, 7, 10][ch.toLowerCase().charCodeAt(0) % 6]
        const vowel = /[aeiouy]/i.test(ch)
        const f = v.base * 1.1 * Math.pow(2, deg / 12)
        s.tone(f * 0.94, tt, 0.085, { type: 'sawtooth', gain: 0.07, a: 0.02, d: 0.08, s: 0.6, r: 0.04, slide: 1 / 0.94, slideTime: 0.05, shaper: 1.6, filter: { freq: vowel ? 500 : 900, to: vowel ? 2200 : 1500, time: 0.07, q: 2.5 }, filter2: { type: 'peaking', freq: 1500, q: 2, gain: 8 }, verb: 0.15 })
        tt += 0.1
      }
    },
    select(s, t) {
      // a damped Dm9 stab and a brush
      piano(s, chord('D3 F3 A3 C4 E4'), t, 0.26, { gain: 0.1, damp: true, verb: 0.15 })
      swish(s, t + 0.02, { gain: 0.09 })
    },
    drumroll(s, t, dur) {
      // brushes roll on the snare and swell; a bowed low D leans in underneath; the crash lands on the beat
      s.noise(t, dur, { gain: 0.26, a: dur * 0.85, d: 0.1, s: 1, r: 0.05, filter: { type: 'bandpass', freq: 2200, to: 4800, time: dur, q: 0.6 }, filter2: { type: 'highpass', freq: 1200 }, verb: 0.2 })
      let x = 0, gap = 0.11
      while (x < dur - 0.02) { s.noise(t + x, 0.035, { gain: 0.05 + (x / dur) * 0.16, filter: { type: 'bandpass', freq: 1800 + rnd(x * 50) * 800, q: 1 }, filter2: { type: 'highpass', freq: 1000 }, pan: (rnd(x * 90) - 0.5) * 0.4 }); x += gap; gap = Math.max(0.034, gap * 0.88) }
      s.tone(mtof(38), t, dur, { type: 'sawtooth', gain: 0.1, a: dur * 0.5, d: 0.2, s: 1, r: 0.06, vib: { rate: 6, cents: 12 }, filter: { freq: 180, to: 700, time: dur, q: 2 }, shaper: 1.5 })
      s.cymbal(t + dur, { gain: 0.2, decay: 1.3, base: 290, verb: 0.35 })
      s.kick(t + dur, { gain: 0.5, pitch: 72, decay: 0.4 })
      s.noise(t + dur, 0.12, { gain: 0.2, filter: { type: 'bandpass', freq: 2600, q: 0.6 }, verb: 0.3 })
    },
    correct(s, t) {
      // case closed: the V, then the tonic turns major (a Picardy third) under a trumpet "ba-da-DAAH",
      // vibes glint on the F#, and the file snaps shut
      piano(s, V.A7, t, 0.26, { gain: 0.1, damp: true, verb: 0.2 })
      bass(s, note('A2'), t, 0.28, { gain: 0.45 })
      piano(s, chord('D3 F#3 A3 C#4 E4'), t + 0.3, 1.1, { gain: 0.1, roll: 0.018, verb: 0.3 })
      bass(s, note('D2'), t + 0.3, 1.0, { gain: 0.45 })
      trumpet(s, note('A4'), t, 0.13, { gain: 0.13, verb: 0.3 })
      trumpet(s, note('C#5'), t + 0.15, 0.13, { gain: 0.13, verb: 0.3 })
      trumpet(s, note('F#5'), t + 0.31, 1.0, { gain: 0.15, verb: 0.35, vib: 30 })
      swish(s, t + 0.3, { gain: 0.09 })
      ping(s, t + 0.3, { gain: 0.05 })
      chord('D5 F#5 A5 D6').forEach((n, k) => vibes(s, n, t + 0.36 + k * 0.05, 0.5, { gain: 0.05, verb: 0.3, pan: (k - 1.5) * 0.2 }))
      s.wood(t + 1.35, 900, { gain: 0.25 })
    },
    wrong(s, t) {
      // dun, dun, DUNNN: parallel minor triads sliding down a half step at a time, the last one
      // sinking flat with a wide vibrato over a low piano cluster
      const stabs: [number[], number, number, number][] = [
        [chord('E4 G4 B4'), note('E2'), 0, 0.2],
        [chord('Eb4 Gb4 Bb4'), note('Eb2'), 0.3, 0.2],
        [chord('D4 F4 A4'), note('D2'), 0.62, 1.15],
      ]
      stabs.forEach(([ns, root, dt, dur], k) => {
        const last = k === 2
        ns.forEach((n, j) => trumpet(s, n, t + dt, dur, { gain: last ? 0.1 : 0.09, verb: 0.3, pan: (j - 1) * 0.25, vib: last ? 40 : 10, sink: last ? 0.955 : undefined, dark: true }))
        bass(s, root, t + dt, last ? 1.2 : 0.28, { gain: 0.45 })
        s.kick(t + dt, { gain: last ? 0.5 : 0.3, pitch: last ? 58 : 70, decay: last ? 0.5 : 0.25 })
      })
      piano(s, chord('D2 Eb2 Ab2 A2'), t + 0.62, 1.3, { gain: 0.11, verb: 0.25 })
      s.noise(t + 0.62, 0.14, { gain: 0.16, filter: { type: 'bandpass', freq: 2400, q: 0.6 }, verb: 0.3 })
    },
    stamp(s, t, right) {
      // a heavy rubber stamp: the desk thud, the rubber slapping the paper
      s.tone(right ? 82 : 64, t, 0.22, { type: 'sine', gain: 0.55, a: 0.001, d: 0.2, s: 0.5, r: 0.08, slide: 0.45, slideTime: 0.14 })
      s.noise(t, 0.12, { gain: 0.3, a: 0.001, d: 0.1, filter: { type: 'lowpass', freq: 520 }, verb: 0.2 })
      s.noise(t, 0.025, { gain: 0.2, filter: { type: 'bandpass', freq: 1500, q: 0.8 } })
    },
    crowd(s, t, right) {
      if (right) {
        // a low murmur round the bar and a few slow claps
        choir(s, t + 0.05, 0.9, 'oh', { gain: 0.035, pitch: 125, slide: 1.04, voices: 6 })
        applause(s, t + 0.3, 1.0, 11, 0.07)
      } else {
        // the room goes "ooh" and the pitch falls with it
        choir(s, t + 0.1, 1.2, 'oo', { gain: 0.055, pitch: 205, slide: 0.82, voices: 7 })
        s.noise(t + 0.1, 0.9, { gain: 0.03, a: 0.3, d: 0.5, s: 0.4, filter: { type: 'bandpass', freq: 500, q: 0.8 } })
      }
    },
    page(s, t) {
      // a manila folder slides across the desk, the paper inside flutters, it lands
      s.noise(t, 0.34, { gain: 0.1, a: 0.05, d: 0.3, s: 0.45, r: 0.08, filter: { type: 'bandpass', freq: 700, to: 2400, time: 0.3, q: 0.9 }, filter2: { type: 'highpass', freq: 400 }, pan: -0.4 })
      for (let k = 0; k < 4; k++) s.noise(t + 0.06 + k * 0.07 + rnd(k) * 0.03, 0.012, { gain: 0.05, filter: { type: 'bandpass', freq: 3500 + rnd(k * 3) * 1500, q: 2 }, pan: -0.3 + k * 0.2 })
      s.noise(t + 0.33, 0.06, { gain: 0.14, filter: { type: 'lowpass', freq: 800 }, pan: 0.3 })
      s.tone(95, t + 0.33, 0.05, { type: 'sine', gain: 0.14, a: 0.001, d: 0.04, s: 0, r: 0.03, slide: 0.6 })
    },
    fanfare(s, t, ratio) {
      if (ratio >= 0.7) {
        // big band: two short section hits on the ii and V, then the whole band lands on D6/9
        // with the lead trumpet shaking on top and the vibes running up the chord
        const hit = (ns: number[], root: number, tt: number, dur: number, g: number, vib = 10) => {
          ns.forEach((n, j) => trumpet(s, n, tt, dur, { gain: g, verb: 0.3, pan: (j - (ns.length - 1) / 2) * 0.18, vib, dark: j < 2 }))
          bass(s, root, tt, dur, { gain: 0.45 })
          piano(s, ns, tt, dur, { gain: 0.07, verb: 0.2, damp: dur < 0.5 })
          s.kick(tt, { gain: 0.35, pitch: 70, decay: 0.3 })
          swish(s, tt, { gain: 0.08 })
        }
        hit(chord('G3 Bb3 D4 E4'), note('E2'), t, 0.2, 0.065)
        hit(chord('G3 Bb3 C#4 E4'), note('A1'), t + 0.27, 0.2, 0.065)
        hit(chord('F#3 A3 B3 E4 F#4'), note('D2'), t + 0.56, 1.9, 0.065, 28)
        trumpet(s, note('F#5'), t + 0.56, 1.8, { gain: 0.1, verb: 0.35, vib: 45 })
        s.cymbal(t + 0.56, { gain: 0.18, decay: 1.5, base: 300, verb: 0.35 })
        chord('D4 F#4 A4 B4 D5 F#5 A5 D6').forEach((n, k) => vibes(s, n, t + 0.6 + k * 0.045, 0.6, { gain: 0.04, verb: 0.3, pan: (k - 3.5) * 0.12 }))
        piano(s, chord('D3 F#3 A3 B3'), t + 2.35, 0.2, { gain: 0.1, damp: true, verb: 0.2 })
        s.kick(t + 2.35, { gain: 0.4, pitch: 70, decay: 0.3 })
        swish(s, t + 2.35, { gain: 0.08 })
      } else if (ratio >= 0.4) {
        // a shrug: the piano rolls a Dm6/9 and the trumpet says "meh", a falling whole step with the mute closing
        piano(s, chord('D3 F3 A3 B3 E4'), t, 1.4, { gain: 0.1, roll: 0.03, verb: 0.3 })
        bass(s, note('D2'), t, 1.2, { gain: 0.45 })
        swish(s, t, { gain: 0.07 })
        trumpet(s, note('A4'), t + 0.35, 0.3, { gain: 0.12, verb: 0.3, wah: 'open' })
        trumpet(s, note('G4'), t + 0.72, 0.7, { gain: 0.12, verb: 0.3, sink: 0.97, wah: 'close', vib: 25 })
        ping(s, t + 1.5, { gain: 0.04 })
      } else {
        // the rain comes up, the piano holds a Dm(maj7) then the bVI, and the muted trumpet
        // walks down A F E D: it was never going to work out
        s.noise(t, 3, { gain: 0.035, a: 0.6, d: 2, s: 1, r: 0.8, filter: { type: 'highpass', freq: 4000, q: 0.4 }, filter2: { type: 'lowpass', freq: 9000 } })
        piano(s, V.DmM7, t, 1.3, { gain: 0.09, roll: 0.02, verb: 0.35 })
        bass(s, note('D2'), t, 1.2, { gain: 0.45 })
        piano(s, V.Bb, t + 1.3, 1.5, { gain: 0.085, roll: 0.02, verb: 0.35 })
        bass(s, note('Bb1'), t + 1.3, 1.5, { gain: 0.42 })
        const lineDown: [number, number, number][] = [[note('A4'), 0, 0.42], [note('F4'), 0.46, 0.36], [note('E4'), 0.86, 0.38], [note('D4'), 1.3, 1.3]]
        lineDown.forEach(([n, dt, dur], k) => trumpet(s, n, t + dt, dur, { gain: 0.12, verb: 0.4, vib: k === 3 ? 30 : 15, sink: k === 3 ? 0.975 : undefined }))
        ping(s, t + 1.3, { gain: 0.035 })
        swish(s, t + 1.3, { gain: 0.05 })
      }
    },
  },
}
