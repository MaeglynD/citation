import { Synth, mtof } from '../core'
import { type Theme, line, byBar, chord, hits, rnd, isLetter, letterDegree } from './helpers'

/**
 * HANDHELD: a 1989 mono handheld chiptune. Four channels and nothing else:
 *   pulse 1  lead (25% duty, then 50% for the restatement, 12.5% for the bridge; runs on 50%)
 *   pulse 2  off-beat strums (bars 0-3), a dotted-eighth echo of the lead (4-7), 32nd-note
 *            tremolo chords (8-15), and diatonic thirds under the fill runs
 *   wave     octave-jump bass, triangle quantised to 4 bits like the real wave RAM
 *   noise    every drum is a filtered burst with a short decay
 * No reverb, chorus, detune or pan. C major, 156 BPM, 16 bars:
 *   A  0-3   C | G | Am | F        light: lead, strums, bass, drums
 *      4-7   C | G | Am | F -> G   echo on, ghost snares; bar 7 = roll + run up in thirds
 *   B  8-11  Am | F | G | E        relative minor under tremolo chords; bar 11 drops the kick
 *      12-15 Am | F | D | G        the cheeky D major (V/V); bar 15 = roll + run down, back to C
 */

const BPM = 156

type Duty = 'square' | 'pulse25' | 'pulse12'
type ChordName = 'C' | 'G' | 'Am' | 'F' | 'E' | 'D'

const PROG: ChordName[] = ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'Am', 'F', 'G', 'E', 'Am', 'F', 'D', 'G']
/** Close voicings in one register so the tremolo chords voice-lead instead of leaping. */
const VOICING: Record<ChordName, number[]> = {
  C: chord('G3 C4 E4'), G: chord('G3 B3 D4'), Am: chord('A3 C4 E4'),
  F: chord('A3 C4 F4'), E: chord('G#3 B3 E4'), D: chord('F#3 A3 D4'),
}

// pulse 1, bars 0-7: a bouncing tune built on a sixteenth-note pickup motif, peaking on E6 in bar 2
const LEAD_A = byBar(line(`
C5 . E5 . G5 - - - . E5 G5 . C6 - - - |
D6 . B5 . G5 - - - . B5 D6 . B5 - G5 - |
A5 . C6 . E6 - - - - - . D6 C6 . A5 . |
C6 . A5 . F5 - - - . F5 G5 . A5 - - . |
C5 . E5 . G5 - - - . E5 G5 . C6 - - - |
D6 . B5 . G5 - - - . G5 A5 . B5 . D6 . |
E6 - - . C6 . A5 - - - . A5 B5 . C6 . |
C6 . A5 . F5 - - - G5 A5 B5 C6 D6 E6 F6 G6 |`))

// pulse 1, bars 8-15: the bridge, plainer and longer-breathed, the G# of E major at bar 11,
// the high point F6 at bar 13, the F# of D major at bar 14
const LEAD_B = byBar(line(`
E5 - - . A5 - - . C6 - - - B5 . A5 . |
F5 - - . A5 - - . C6 - - - D6 . C6 . |
D6 - - . B5 - - . G5 - - - A5 . B5 . |
C6 - - - B5 - - - G#5 - - - - - - . |
A5 - - . C6 - - . E6 - - - - - - . |
F6 - - - E6 . D6 . C6 - - - . A5 . C6 |
A5 . D6 . F#6 - - - . E6 D6 . A5 - - . |
D6 - - . B5 - - . D6 C6 B5 A5 G5 F5 E5 D5 |`))

// pulse 2 under the two fill runs: a diatonic third below (bar 7 then bar 15)
const FILL_THIRDS = byBar(line(`
. . . . . . . . E5 F5 G5 A5 B5 C6 D6 E6 |
. . . . . . . . B5 A5 G5 F5 E5 D5 C5 B4 |`))

// wave channel: root on the beat, octave on the off-beat, approach notes into each change
const BASS = byBar(line(`
C2 - C3 - C2 - C3 - C2 - C3 - E2 - F2 - |
G2 - G3 - G2 - G3 - G2 - G3 - G2 - G3 - |
A2 - A3 - A2 - A3 - A2 - A3 - A2 - G2 - |
F2 - F3 - F2 - F3 - F2 - F3 - G2 - B2 - |
C2 - C3 - C2 - C3 - C2 - C3 - E2 - F2 - |
G2 - G3 - G2 - G3 - G2 - B2 - D3 - G3 - |
A2 - A3 - A2 - A3 - A2 - E3 - C3 - A2 - |
F2 - F3 - F2 - F3 - G2 - G3 - G2 - G3 - |
A2 - A3 - A2 - A3 - A2 - A3 - A2 - G2 - |
F2 - F3 - F2 - F3 - F2 - F3 - F2 - F#2 - |
G2 - G3 - G2 - G3 - G2 - G3 - G2 - F2 - |
E2 - - - - - - - E2 - - - G#2 - - - |
A2 - A3 - A2 - A3 - A2 - A3 - A2 - G2 - |
F2 - F3 - F2 - F3 - F2 - F3 - F2 - E2 - |
D2 - D3 - D2 - D3 - D2 - D3 - D2 - F#2 - |
G2 - G3 - G2 - G3 - G2 - G3 - G2 - B2 - |`))

const KICK_A = hits('x.....x.x.....x.')
const KICK_B = hits('x..x..x.x..x..x.')
const KICK_FILL = hits('x.....x.........')
const SNARE = hits('....x.......x...')
const SNARE_GHOST = hits('....x.....o.x...')
const SNARE_FILL = hits('....x...........')
const HAT_A = hits('x.x.x.x.x.x.x.x.')
const HAT_B = hits('x.x.x.x.x.x.x.xx')
const HAT_FILL = hits('x.x.x.x.........')

// ---------------------------------------------------------------------------
// the four channels

/** A pulse envelope: instant on, a short fall to a held level, a click-free stop. */
const PULSE = { a: 0.002, d: 0.1, s: 0.75, r: 0.015 }

const pulse = (s: Synth, n: number, t: number, dur: number, duty: Duty, g: number, dest?: AudioNode, vib = dur > 0.25) =>
  s.tone(mtof(n), t, dur, { type: duty, gain: g, ...PULSE, vib: vib ? { rate: 6.2, cents: 14, delay: 0.1 } : undefined, dest })
/** Tremolo chord: cycle the chord's notes at a fixed rate with very short tones (one channel, fake polyphony). */
const tremolo = (s: Synth, ns: number[], t: number, dur: number, rate: number, g: number, dest?: AudioNode) => {
  const n = Math.floor(dur / rate + 1e-6)
  for (let k = 0; k < n; k++) s.tone(mtof(ns[k % ns.length]), t + k * rate, rate * 0.94, { type: 'pulse25', gain: g, a: 0.001, d: 0.06, s: 0.5, r: 0.01, dest })
}
const wave = (s: Synth, n: number, t: number, dur: number, g = 0.26, dest?: AudioNode, slide?: number) =>
  s.tone(mtof(n), t, dur, { type: 'triangle', bits: 4, gain: g, a: 0.003, d: 0.3, s: 0.9, r: 0.02, slide, dest })
const kick = (s: Synth, t: number, g: number, dest?: AudioNode) =>
  s.noise(t, 0.09, { gain: g, a: 0.001, d: 0.08, s: 0, r: 0.03, filter: { type: 'lowpass', freq: 340, to: 50, time: 0.08, q: 4 }, filter2: { type: 'lowpass', freq: 700 }, dest })
const snare = (s: Synth, t: number, g: number, dest?: AudioNode) =>
  s.noise(t, 0.11, { gain: g, a: 0.001, d: 0.1, s: 0, r: 0.03, filter: { type: 'bandpass', freq: 1900, q: 0.5 }, filter2: { type: 'highpass', freq: 350 }, dest })
const hat = (s: Synth, t: number, g: number, open: boolean, dest?: AudioNode) =>
  s.noise(t, open ? 0.05 : 0.018, { gain: g, a: 0.001, r: 0.015, filter: { type: 'highpass', freq: 6500 }, dest })
const crash = (s: Synth, t: number, g: number, dest?: AudioNode) =>
  s.noise(t, 0.4, { gain: g, a: 0.002, d: 0.4, s: 0, r: 0.15, filter: { type: 'highpass', freq: 3000 }, dest })

export const gameboy: Theme = {
  id: 'gameboy',
  name: 'HANDHELD',
  musicGain: 1.07,
  sfxGain: 0.8,
  song: {
    bpm: BPM,
    bars: 16,
    bar(s, b, t0, st, dest) {
      const T = (i: number) => t0 + i * st
      const vo = VOICING[PROG[b]]
      const second = b >= 8
      const fill = b % 8 === 7
      const breakdown = b === 11
      // ---- pulse 1: the lead; the duty cycle changes per section for colour
      const mel = (second ? LEAD_B.get(b - 8) : LEAD_A.get(b)) ?? []
      const duty: Duty = second ? 'pulse12' : b < 4 ? 'pulse25' : 'square'
      const lg = second ? 0.12 : b < 4 ? 0.1 : 0.09
      // line() indexes steps across the whole score, so every event is rebased into this bar with % 16
      for (const e of mel) {
        const j = e.i % 16
        const run = fill && j >= 8
        pulse(s, e.n, T(j), e.len * st * (run ? 0.95 : 0.9), run ? 'square' : duty, run ? 0.1 : lg, dest, e.len >= 4)
      }
      // ---- pulse 2: strums, then echo, then tremolo chords; thirds under the fill runs
      if (b < 4) {
        for (const j of [2, 6, 10, 14]) tremolo(s, vo, T(j), st, st / 3, 0.05, dest)
      } else if (b < 8) {
        for (const e of mel) {
          const at = (e.i % 16) + 3
          const len = Math.min(e.len, 2, fill ? 8 - at : 99)
          if (len > 0) pulse(s, e.n, T(at), len * st * 0.8, 'pulse12', 0.045, dest, false)
        }
      } else {
        tremolo(s, vo, t0, st * (fill ? 8 : 16), st / 2, breakdown ? 0.04 : 0.05, dest)
      }
      if (fill) for (const e of FILL_THIRDS.get(b === 7 ? 0 : 1) ?? []) pulse(s, e.n, T(e.i % 16), st * 0.95, 'pulse25', 0.07, dest, false)
      // ---- wave channel: bass
      for (const e of BASS.get(b) ?? []) wave(s, e.n, T(e.i % 16), e.len * st * 0.92, 0.3, dest)
      // ---- noise channel: drums
      const kicks = fill ? KICK_FILL : breakdown ? [] : second ? KICK_B : KICK_A
      for (const [j, v] of kicks) kick(s, T(j), 0.5 * v * (j === 0 ? 1.15 : 1), dest)
      const snares = fill ? SNARE_FILL : b % 2 === 1 && !breakdown ? SNARE_GHOST : SNARE
      for (const [j, v] of snares) snare(s, T(j), 0.28 * v, dest)
      const hatsNow = fill ? HAT_FILL : second ? HAT_B : HAT_A
      for (const [j, v] of hatsNow) hat(s, T(j), 0.08 * v * (0.85 + rnd(b * 16 + j) * 0.3), j % 4 === 2, dest)
      if (fill) {
        for (let k = 0; k < 4; k++) snare(s, T(8 + k), 0.16 + k * 0.03, dest)
        for (let k = 0; k < 8; k++) snare(s, T(12) + k * st / 2, 0.2 + k * 0.025, dest)
      }
      if (breakdown) for (let k = 0; k < 4; k++) snare(s, T(12 + k), 0.12 + k * 0.04, dest)
      if (b % 8 === 0) crash(s, T(0), 0.18, dest)
    },
  },
  sfx: {
    blip(s, t, ch, v, i) {
      if (!isLetter(ch)) return
      // the RPG text blip: a two-step square note, up for vowels, down and shorter for consonants
      const vowel = /[aeiouy]/i.test(ch)
      const semis = [0, 2, 4, 7, 9, 12, 14][letterDegree(ch, i)]
      const f = v.base * 2.2 * Math.pow(2, semis / 12)
      const duty: Duty = v.seed % 2 ? 'square' : 'pulse25'
      const jump = vowel ? 1.26 + v.wobble * 0.1 : 1 / (1.2 + v.wobble * 0.1)
      s.tone(f, t, 0.016, { type: duty, gain: 0.085, a: 0.001, r: 0.004 })
      s.tone(f * jump, t + 0.016, vowel ? 0.028 : 0.014, { type: duty, gain: 0.075, a: 0.001, r: 0.008 })
    },
    typed(s, t) {
      // the "ding": two square notes a fifth apart, pulse 2 shadowing the second
      s.tone(mtof(84), t, 0.055, { type: 'square', gain: 0.1, a: 0.001, r: 0.01 })
      s.tone(mtof(91), t + 0.06, 0.22, { type: 'square', gain: 0.1, a: 0.001, d: 0.2, s: 0.35, r: 0.08 })
      s.tone(mtof(79), t + 0.1, 0.16, { type: 'pulse12', gain: 0.04, a: 0.001, d: 0.15, s: 0.3, r: 0.06 })
    },
    hover(s, t) { s.tone(mtof(88), t, 0.028, { type: 'pulse25', gain: 0.07, a: 0.001, r: 0.01 }) },
    mumble(s, t, label, v) {
      const letters = label.replace(/[^a-z]/gi, '')
      const duty: Duty = v.seed % 2 ? 'square' : 'pulse25'
      let tt = t
      for (const ch of letters.slice(0, letters.length >= 6 ? 4 : 3)) {
        const vowel = /[aeiouy]/i.test(ch)
        const semis = [0, 2, 4, 5, 7, 9, 11][ch.toLowerCase().charCodeAt(0) % 7]
        s.tone(v.base * 1.4 * Math.pow(2, semis / 12), tt, vowel ? 0.07 : 0.045, { type: duty, gain: 0.07, a: 0.003, d: 0.06, s: 0.6, r: 0.015, slide: vowel ? 1.12 : 0.88, slideTime: 0.04 })
        tt += vowel ? 0.085 : 0.065
      }
    },
    select(s, t) {
      s.tone(mtof(79), t, 0.05, { type: 'square', gain: 0.11, a: 0.001, r: 0.01 })
      s.tone(mtof(84), t + 0.05, 0.12, { type: 'square', gain: 0.11, a: 0.001, d: 0.12, s: 0.5, r: 0.05 })
    },
    drumroll(s, t, dur) {
      // the noise channel rolls faster and louder while the wave channel climbs an octave; it lands on a crash
      let x = 0, gap = 0.1
      while (x < dur - 0.02) {
        snare(s, t + x, 0.14 + (x / dur) * 0.16)
        x += gap
        gap = Math.max(0.028, gap * 0.87)
      }
      s.tone(110, t, dur, { type: 'triangle', bits: 4, gain: 0.16, a: 0.05, d: 0.3, s: 1, r: 0.03, slide: 2 })
      kick(s, t + dur, 0.6)
      crash(s, t + dur, 0.26)
    },
    correct(s, t) {
      // level up: a two-octave climb with pulse 2 chasing it, a shimmer at the top, then "ta-DAH"
      const up = [72, 76, 79, 84, 88, 91]
      up.forEach((n, i) => {
        s.tone(mtof(n), t + i * 0.05, 0.05, { type: 'square', gain: 0.12, a: 0.001, r: 0.01 })
        s.tone(mtof(n), t + 0.1 + i * 0.05, 0.045, { type: 'pulse12', gain: 0.05, a: 0.001, r: 0.01 })
      })
      kick(s, t, 0.5)
      pulse(s, 91, t + 0.3, 0.26, 'pulse25', 0.1, undefined, true)
      for (let k = 0; k < 10; k++) s.tone(mtof(k % 2 ? 96 : 84), t + 0.3 + k * 0.03, 0.028, { type: 'pulse12', gain: 0.06, a: 0.001, r: 0.008 })
      snare(s, t + 0.3, 0.25)
      crash(s, t + 0.3, 0.14)
      ;[36, 48, 36, 48, 36, 48, 36].forEach((n, i) => wave(s, n, t + 0.3 + i * 0.1, i === 6 ? 0.4 : 0.09, 0.25))
      pulse(s, 95, t + 0.6, 0.08, 'square', 0.1, undefined, false)
      pulse(s, 96, t + 0.7, 0.5, 'square', 0.11, undefined, true)
      pulse(s, 88, t + 0.7, 0.5, 'pulse12', 0.05, undefined, true)
      kick(s, t + 0.7, 0.55)
    },
    wrong(s, t) {
      // the pulse falls off a cliff with a noise burst and a wave-channel thud, then the sad trombone:
      // "wah wah waaah", each syllable narrowing its duty cycle 50% -> 25% -> 12.5%, pulse 2 in thirds
      s.tone(880, t, 0.32, { type: 'square', gain: 0.12, a: 0.002, d: 0.3, s: 0.7, r: 0.04, slide: 0.12 })
      s.noise(t, 0.25, { gain: 0.16, a: 0.002, d: 0.22, filter: { type: 'lowpass', freq: 3000, to: 300, time: 0.25, q: 1 } })
      wave(s, 45, t, 0.3, 0.3, undefined, 0.5)
      const wah = (n: number, tt: number, long: boolean) => {
        const seg: [Duty, number][] = long ? [['square', 0.1], ['pulse25', 0.12], ['pulse12', 0.5]] : [['square', 0.07], ['pulse25', 0.07], ['pulse12', 0.09]]
        let x = tt
        seg.forEach(([duty, d], k) => {
          const last = k === 2
          const o = { type: duty, a: k ? 0.001 : 0.01, r: last ? 0.08 : 0.004, slide: last ? (long ? 0.88 : 0.97) : undefined, vib: last ? { rate: 5.5, cents: long ? 45 : 20, delay: 0.05 } : undefined }
          s.tone(mtof(n), x, d, { ...o, gain: 0.11 })
          s.tone(mtof(n - 4), x, d, { ...o, gain: 0.055 })
          x += d
        })
      }
      wah(76, t + 0.42, false)
      wah(75, t + 0.72, false)
      wah(74, t + 1.02, true)
    },
    stamp(s, t, right) {
      s.noise(t, 0.1, { gain: 0.32, a: 0.001, d: 0.09, filter: { type: 'lowpass', freq: 1500, to: 200, time: 0.09 } })
      s.tone(right ? 98 : 73.4, t, 0.18, { type: 'triangle', bits: 4, gain: 0.5, a: 0.002, d: 0.15, s: 0.6, r: 0.06, slide: 0.5, slideTime: 0.12 })
    },
    crowd(s, t, right) {
      if (right) {
        // an arpeggiated cheer: C major racing up two octaves and back under a hiss, capped with a C6
        const ns = [72, 76, 79, 84, 88, 91, 96, 91, 88, 84, 79, 76, 72, 76, 79, 84]
        ns.forEach((n, i) => s.tone(mtof(n), t + i * 0.032, 0.03, { type: 'pulse25', gain: i < 7 ? 0.075 : 0.065, a: 0.001, r: 0.008 }))
        s.noise(t, 0.6, { gain: 0.07, a: 0.08, d: 0.5, s: 0.4, r: 0.2, filter: { type: 'bandpass', freq: 2600, q: 0.5 } })
        s.tone(mtof(84), t + 0.52, 0.3, { type: 'square', gain: 0.08, a: 0.002, d: 0.25, s: 0.4, r: 0.1 })
      } else {
        // a two-voice "boooo" sinking a fourth, hiss underneath
        s.tone(mtof(55), t, 0.75, { type: 'pulse12', gain: 0.11, a: 0.06, d: 0.5, s: 0.7, r: 0.15, slide: 0.74, vib: { rate: 4.5, cents: 30, delay: 0.2 } })
        s.tone(mtof(50), t + 0.05, 0.7, { type: 'pulse25', gain: 0.08, a: 0.06, d: 0.5, s: 0.7, r: 0.15, slide: 0.74, vib: { rate: 5.2, cents: 30, delay: 0.2 } })
        s.noise(t, 0.6, { gain: 0.05, a: 0.1, d: 0.5, s: 0.4, r: 0.2, filter: { type: 'bandpass', freq: 900, q: 0.6 } })
      }
    },
    page(s, t) {
      s.tone(330, t, 0.11, { type: 'square', gain: 0.1, a: 0.002, r: 0.03, slide: 2 })
      s.tone(330, t + 0.04, 0.1, { type: 'pulse12', gain: 0.04, a: 0.002, r: 0.03, slide: 2 })
      s.noise(t, 0.04, { gain: 0.08, filter: { type: 'highpass', freq: 5000 } })
    },
    fanfare(s, t, ratio) {
      const C = chord('C5 E5 G5'), F = chord('C5 F5 A5'), G = chord('B4 D5 G5'), Am = chord('A4 C5 E5')
      if (ratio >= 0.7) {
        // victory: a run up in thirds, then C F G C with tremolo chords under a singing lead
        const run = [72, 74, 76, 77, 79, 81, 83, 84], under = [69, 71, 72, 74, 76, 77, 79, 81]
        run.forEach((n, i) => { pulse(s, n, t + i * 0.07, 0.065, 'square', 0.1, undefined, false); pulse(s, under[i], t + i * 0.07, 0.065, 'pulse25', 0.06, undefined, false); snare(s, t + i * 0.07, 0.12 + i * 0.02) })
        ;[36, 48, 36, 48].forEach((n, i) => wave(s, n, t + i * 0.14, 0.13, 0.26))
        const t1 = t + 0.56
        const stabs: [number[], number, number[]][] = [[C, 0, [88, 91]], [F, 0.36, [93, 89]], [G, 0.72, [91, 95]]]
        for (const [ch, dt, mel] of stabs) {
          tremolo(s, ch, t1 + dt, 0.36, 0.045, 0.05)
          mel.forEach((n, k) => pulse(s, n, t1 + dt + k * 0.18, 0.17, 'pulse25', 0.11, undefined, false))
          kick(s, t1 + dt, 0.55)
          snare(s, t1 + dt + 0.18, 0.26)
          hat(s, t1 + dt + 0.09, 0.08, true)
          hat(s, t1 + dt + 0.27, 0.08, true)
        }
        ;[36, 48, 41, 53, 43, 55].forEach((n, i) => wave(s, n, t1 + i * 0.18, 0.17, 0.26))
        for (let k = 0; k < 4; k++) snare(s, t1 + 0.9 + k * 0.045, 0.16 + k * 0.03)
        const t2 = t1 + 1.08
        crash(s, t1, 0.16)
        crash(s, t2, 0.2)
        kick(s, t2, 0.6)
        pulse(s, 96, t2, 0.85, 'square', 0.12, undefined, true)
        tremolo(s, C, t2, 0.8, 0.045, 0.045)
        ;[36, 48, 36, 48].forEach((n, i) => wave(s, n, t2 + i * 0.18, 0.17, 0.26))
        wave(s, 36, t2 + 0.72, 0.4, 0.26)
        for (let k = 0; k < 4; k++) hat(s, t2 + 0.09 + k * 0.18, 0.07, true)
      } else if (ratio >= 0.4) {
        // "okay": a rising three-note shrug that settles on the relative minor
        pulse(s, 76, t, 0.1, 'pulse25', 0.1, undefined, false)
        pulse(s, 79, t + 0.12, 0.1, 'pulse25', 0.1, undefined, false)
        pulse(s, 81, t + 0.24, 0.4, 'pulse25', 0.1, undefined, true)
        pulse(s, 79, t + 0.72, 0.1, 'pulse25', 0.09, undefined, false)
        s.tone(mtof(76), t + 0.84, 0.5, { type: 'pulse25', gain: 0.09, ...PULSE, slide: 0.97, vib: { rate: 5.5, cents: 20, delay: 0.1 } })
        tremolo(s, C, t, 0.7, 0.045, 0.045)
        tremolo(s, Am, t + 0.72, 0.62, 0.045, 0.045)
        ;[36, 48, 36, 48, 45, 57, 45].forEach((n, i) => wave(s, n, t + i * 0.18, i === 6 ? 0.35 : 0.17, 0.26))
        kick(s, t, 0.5); snare(s, t + 0.36, 0.26); kick(s, t + 0.72, 0.5); snare(s, t + 1.08, 0.22)
        for (let k = 0; k < 7; k++) hat(s, t + 0.09 + k * 0.18, 0.07, true)
      } else {
        // game over: A minor stairs down, a funeral kick, then the whole machine powers down an octave
        const down = [88, 84, 81, 76, 72, 69]
        down.forEach((n, i) => { pulse(s, n, t + i * 0.24, 0.2, 'pulse25', 0.11, undefined, false); pulse(s, n - 3, t + i * 0.24, 0.2, 'pulse12', 0.05, undefined, false) })
        tremolo(s, Am, t, 1.4, 0.045, 0.035)
        for (let k = 0; k < 3; k++) { kick(s, t + k * 0.48, 0.55); wave(s, 45, t + k * 0.48, 0.42, 0.26) }
        const t1 = t + 1.5
        kick(s, t1, 0.6)
        s.tone(mtof(69), t1, 1.0, { type: 'square', gain: 0.11, ...PULSE, slide: 0.5, vib: { rate: 4.5, cents: 30, delay: 0.3 } })
        s.tone(mtof(60), t1, 1.0, { type: 'pulse12', gain: 0.05, ...PULSE, slide: 0.5 })
        wave(s, 45, t1, 1.0, 0.26, undefined, 0.5)
        s.noise(t1, 1.0, { gain: 0.08, a: 0.05, d: 0.9, filter: { type: 'lowpass', freq: 600, to: 80, time: 1.0 } })
      }
    },
  },
}
