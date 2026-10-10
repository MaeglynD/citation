import { Synth, mtof } from '../core'
import { type Theme, line, byBar, chord, hits, rnd, stepTime, choir, send, crackle, isLetter, letterDegree } from './helpers'

/**
 * CAFE: lo-fi hip hop to study to. Rain on the window, dust on the record, a tape-fluttering
 * Rhodes comping rootless ninths over a sub bass that slides between its notes, and a boom-bap
 * kit that drags its heels. F major, 76 BPM, swung sixteenths.
 *
 * Form, 16 bars, two bars a chord:
 *   A  0-7    Fmaj9  Em7  Dm9  C9sus        Rhodes, bass, kick and snare; hats on the off-beats only,
 *                                            every eighth from bar 2, ghost sixteenths from bar 4
 *   B  8-15   Fmaj9  Em7  Dm9  Gm9 | C13    a flute plays four phrases that peak on E5 in bar 12; the
 *                                            rim joins beat 4 and the hats open; bar 15 is a ii-V turnaround
 *                                            whose second half is a tape stop, and the needle drops again at bar 0
 */

const BPM = 76
/** Off-beat eighths land this far into the next sixteenth; the odd sixteenths drag a little as well. */
const SWING = 0.58
const SW16 = 0.18

// one chord name per bar
const CHORDS = ['F', 'F', 'E', 'E', 'D', 'D', 'Cs', 'Cs', 'F', 'F', 'E', 'E', 'D', 'D', 'G', 'C13']
/** Rootless Rhodes voicings: `lo` for the downbeat, `hi` re-voices the same chord one note higher. Every change moves by step. */
const V: Record<string, { lo: number[]; hi: number[] }> = {
  F: { lo: chord('A3 C4 E4 G4'), hi: chord('C4 E4 G4 A4') }, // Fmaj9
  E: { lo: chord('B3 D4 E4 G4'), hi: chord('D4 E4 G4 B4') }, // Em7
  D: { lo: chord('A3 C4 E4 F4'), hi: chord('C4 E4 F4 A4') }, // Dm9
  Cs: { lo: chord('G3 Bb3 D4 F4'), hi: chord('Bb3 D4 F4 G4') }, // C9sus
  G: { lo: chord('A3 Bb3 D4 F4'), hi: chord('Bb3 D4 F4 A4') }, // Gm9
  C13: { lo: chord('A3 Bb3 D4 E4'), hi: chord('Bb3 D4 E4 A4') }, // C13
}

// the bass: the root held on 1, the "and of 3" with the kick, and a pickup on the last off-beat that
// reaches the next root by step or from the fifth below; bar 15 keeps only its first half (the tape stop takes the rest)
const BASS = byBar(line(`
F2 - - - - - - - - . F2 - - . C3 . |
F2 - - - - - . F2 - - A2 - - . D2 . |
E2 - - - - - - - - . E2 - - . B2 . |
E2 - - - - - . E2 - - G2 - - . A2 . |
D2 - - - - - - - - . D2 - - . A2 . |
D2 - - - - - . D2 - - F2 - - . G2 . |
C2 - - - - - - - - . C2 - - . G2 . |
C2 - - - - - . C2 - - G2 - - . E2 . |
F2 - - - - - - - - . F2 - - . C3 . |
F2 - - - - - . F2 - - A2 - - . D2 . |
E2 - - - - - - - - . E2 - - . B2 . |
E2 - - - - - . E2 - - G2 - - . A2 . |
D2 - - - - - - - - . D2 - - . A2 . |
D2 - - - - - . D2 - - F2 - - . A2 . |
G2 - - - - - - - - . G2 - - . Bb2 . |
C2 - - - - - - . C2 - - - - - - - |`))

// the flute, bars 8..15: a call that settles on the ninth, an answer that climbs to the fifth of Em7
// and hangs, the high point E5 over Dm9, and a descent through Gm9 to the third of C13
const MELODY = byBar(line(`
. . . . A4 - . . C5 - - - - - - - |
- - D5 - C5 - - - A4 - - - G4 - - - |
- - - - . . . . E4 - - - G4 - A4 - |
B4 - - - - - - - . . . . . . . . |
. . C5 - D5 - E5 - - - - - - - - - |
- - - - D5 - C5 - A4 - - - - - . . |
. . Bb4 - A4 - - - F4 - - - - - D4 - |
E4 - - - - - - . . . . . . . . . |`))

// ---------------------------------------------------------------------------
// instruments

/** A gain that feeds `dry` at unity and `wet` through `amount`: a partial send that costs no extra notes. */
const split = (s: Synth, dry: AudioNode, wet: AudioNode, amount: number) => {
  const g = s.ctx.createGain()
  g.connect(dry)
  const w = s.ctx.createGain()
  w.gain.value = amount
  g.connect(w)
  w.connect(wet)
  return g
}

/** Rhodes: two-op FM at ratio 1, a bright bark falling to a mellow body, amp tremolo and a slow tape wobble. */
const rhodes = (s: Synth, ns: number[], t: number, len: number, g: number, dest?: AudioNode, o: { bright?: number; verb?: number; roll?: number } = {}) =>
  ns.forEach((n, k) => s.fm(mtof(n), t + k * (o.roll ?? 0.012), len, {
    ratio: 1, index: o.bright ?? 2, indexEnd: 0.2, indexTime: 0.45,
    gain: g * (n < 60 ? 0.85 : 1), a: 0.012, d: 1.3, s: 0.42, r: 0.35,
    tremolo: { rate: 4.5, depth: 0.25 }, vib: { rate: 0.4, cents: 6 },
    filter: { freq: 3000, q: 0.5 }, pan: (k - (ns.length - 1) / 2) * 0.16, dest, verb: o.verb,
  }))

/** Sub bass: a dull plucked string over a soft-attack sine; `from` slides in from that ratio (2 = the octave above). */
const bass = (s: Synth, n: number, t: number, len: number, dest?: AudioNode, g = 1, from?: number) => {
  const f = mtof(n)
  if (from) s.tone(f * from, t, len, { type: 'triangle', gain: 0.11 * g, a: 0.008, d: 0.3, s: 0.4, r: 0.06, slide: 1 / from, slideTime: 0.11, filter: { freq: 800, to: 250, time: 0.3 }, dest })
  else s.pluck(f, t, { gain: 0.3 * g, decay: 1.5, bright: 0.25, dur: len + 0.05, dest })
  s.tone(f * (from ?? 1), t, len, { type: 'sine', gain: 0.25 * g, a: 0.012, d: 0.6, s: 0.75, r: 0.07, slide: from ? 1 / from : undefined, slideTime: 0.11, dest })
}

const kick = (s: Synth, t: number, g = 1, dest?: AudioNode) => s.kick(t, { gain: 0.38 * g, pitch: 70, decay: 0.32, dest })
/** A dusty snare: a band of noise (which may take a room send), a short tuned thud and the rim's crack. */
const snare = (s: Synth, t: number, g = 1, dest?: AudioNode, wet?: AudioNode) => {
  s.noise(t, 0.13, { gain: 0.2 * g, a: 0.002, d: 0.11, filter: { type: 'bandpass', freq: 1800, q: 0.6 }, filter2: { type: 'highpass', freq: 600 }, dest: wet ?? dest })
  s.tone(172, t, 0.07, { type: 'triangle', gain: 0.14 * g, a: 0.001, d: 0.06, s: 0.2, r: 0.04, slide: 0.6, dest })
  s.noise(t + 0.003, 0.025, { gain: 0.09 * g, filter: { type: 'bandpass', freq: 3600, q: 2.5 }, dest })
}
const ghost = (s: Synth, t: number, g = 1, dest?: AudioNode) => s.noise(t, 0.05, { gain: 0.07 * g, filter: { type: 'bandpass', freq: 2000, q: 0.8 }, dest })
const hat = (s: Synth, t: number, g: number, dest?: AudioNode, open = false) =>
  s.noise(t, open ? 0.2 : 0.03, { gain: g, a: 0.001, d: open ? 0.16 : 0.024, filter: { type: 'highpass', freq: 6500, q: 0.7 }, filter2: { type: 'lowpass', freq: 10500 }, dest })

/** Flute: a soft wave with a slow attack and late vibrato, and a band of breath around its second harmonic for the length of the note. */
const flute = (s: Synth, n: number, t: number, len: number, o: { gain?: number; dest?: AudioNode; scoop?: boolean; vib?: number; pan?: number; verb?: number } = {}) => {
  const f = mtof(n), g = o.gain ?? 0.07
  s.tone(o.scoop ? f * 0.955 : f, t, len, { type: 'soft', gain: g, a: 0.07, d: 0.35, s: 0.8, r: 0.12, slide: o.scoop ? 1 / 0.955 : undefined, slideTime: 0.1, vib: { rate: 5, cents: o.vib ?? 10, delay: 0.25 }, pan: o.pan, dest: o.dest, verb: o.verb })
  s.noise(t, len, { gain: g * 0.22, a: 0.05, d: 0.3, s: 0.45, r: 0.12, filter: { type: 'bandpass', freq: f * 2, q: 6 }, filter2: { type: 'highpass', freq: 1200 }, pan: o.pan, dest: o.dest, verb: o.verb })
}

/** A muted horn working its mute: the filter opens on the way in or closes on the way out, and the note can droop. */
const wah = (s: Synth, n: number, t: number, len: number, open: boolean, o: { gain?: number; droop?: number; vib?: number } = {}) =>
  s.tone(mtof(n), t, len, {
    type: 'sawtooth', gain: o.gain ?? 0.08, a: 0.03, d: 0.3, s: 0.8, r: 0.12, slide: o.droop, slideTime: len,
    vib: { rate: 5.5, cents: o.vib ?? 10, delay: 0.1 }, shaper: 1.8,
    filter: open ? { freq: 450, to: 2200, time: len * 0.5, q: 2.5 } : { freq: 2200, to: 400, time: len * 0.8, q: 2.5 },
    filter2: { type: 'peaking', freq: 1500, q: 2.5, gain: 8 }, verb: 0.2,
  })

/** The tape stops: soft waves slide down to `to` while a lowpass closes; the hiss and the bass note go with them. */
const tapeStop = (s: Synth, ns: number[], t: number, len: number, o: { gain?: number; to?: number; dest?: AudioNode; dry?: AudioNode; bassNote?: number; verb?: number } = {}) => {
  const g = o.gain ?? 0.05, to = o.to ?? 0.5
  ns.forEach((n, k) => s.tone(mtof(n), t, len, { type: 'soft', gain: g, a: 0.015, d: 0.8, s: 0.6, r: 0.12, slide: to, slideTime: len, filter: { freq: 2400, to: 220, time: len, q: 0.9 }, pan: (k - (ns.length - 1) / 2) * 0.15, dest: o.dest, verb: o.verb }))
  if (o.bassNote !== undefined) s.tone(mtof(o.bassNote), t, len, { type: 'sine', gain: g * 3.2, a: 0.01, d: 0.8, s: 0.6, r: 0.1, slide: to, slideTime: len, dest: o.dry ?? o.dest })
  s.noise(t, len, { gain: g * 0.5, a: 0.05, d: len, s: 0.5, r: 0.1, filter: { type: 'bandpass', freq: 2600, to: 180, time: len, q: 0.6 }, dest: o.dry ?? o.dest })
}

/** The counter bell: an inharmonic FM ding with a brighter partial on top. */
const ding = (s: Synth, t: number, g = 0.05, f = 1760) => {
  s.fm(f, t, 0.6, { ratio: 3.52, index: 1.3, indexEnd: 0.08, indexTime: 0.35, gain: g, a: 0.001, d: 1.2, s: 0, r: 0.8, verb: 0.3, pan: 0.2 })
  s.fm(f * 1.5, t, 0.3, { ratio: 2, index: 0.7, indexEnd: 0.05, gain: g * 0.4, a: 0.001, d: 0.5, s: 0, r: 0.4, verb: 0.3, pan: 0.2 })
}
/** A finger snap: a narrow crack of noise and a tiny falling sine. */
const snap = (s: Synth, t: number, g = 0.12, pan = 0) => {
  s.noise(t, 0.02, { gain: g, a: 0.001, d: 0.018, filter: { type: 'bandpass', freq: 2400, q: 1.2 }, filter2: { type: 'highpass', freq: 1500 }, pan })
  s.tone(950, t, 0.018, { type: 'sine', gain: g * 0.6, a: 0.001, d: 0.015, s: 0, r: 0.015, slide: 0.5, pan })
}
/** A ceramic cup set down on its saucer: a high-ratio FM clink, a ring, and the thud of the base; the wrong one is heavier. */
const cup = (s: Synth, t: number, right: boolean) => {
  const f = right ? 2300 : 1400
  s.fm(f, t, 0.06, { ratio: 5.07, index: 2.6, indexEnd: 0.1, indexTime: 0.04, gain: 0.14, a: 0.001, d: 0.07, s: 0, r: 0.1 })
  s.fm(f * 1.62, t + 0.01, 0.15, { ratio: 1.41, index: 0.9, indexEnd: 0.05, gain: 0.05, a: 0.001, d: 0.25, s: 0, r: 0.2, verb: 0.15 })
  s.tone(right ? 120 : 90, t, 0.11, { type: 'sine', gain: right ? 0.4 : 0.5, a: 0.001, d: 0.1, s: 0.3, r: 0.07, slide: 0.5 })
  s.noise(t, 0.035, { gain: 0.22, filter: { type: 'lowpass', freq: 1100 } })
  if (!right) s.noise(t + 0.06, 0.05, { gain: 0.08, filter: { type: 'bandpass', freq: 700, q: 1 } })
}

export const cafe: Theme = {
  id: 'cafe',
  name: 'CAFE',
  musicGain: 0.9,
  sfxGain: 1.0,
  song: {
    bpm: BPM,
    swing: SWING,
    bars: 16,
    bar(s, b, t0, st, dest) {
      const barLen = st * 16
      const T = (i: number) => stepTime(t0, i, st, SWING) + (i % 2 ? st * SW16 : 0)
      const hu = (i: number, k: number) => (rnd(b * 131 + i * 17 + k) - 0.5) * 0.016
      const room = send(dest, 'room', () => s.reverbBus(dest, 1.4, 3, 0.4))
      const chorus = send(dest, 'chorus', () => s.chorusBus(dest, 0.35, 0.0028, 0.5))
      const keys = send(dest, 'keys', () => split(s, chorus, room, 0.5))
      const kit = send(dest, 'kit', () => split(s, dest, room, 0.3))
      const air = send(dest, 'air', () => split(s, dest, room, 0.7))
      const second = b >= 8
      const name = CHORDS[b]
      const vo = V[name]
      const kg = second ? 0.072 : 0.085 // the Rhodes sits back a touch under the flute

      // the record and the rain
      crackle(s, t0, barLen, dest, 0.026)
      s.noise(t0, barLen, { gain: 0.016, a: 0.08, d: barLen, s: 1, r: 0.08, filter: { type: 'bandpass', freq: 1300, q: 0.3 }, filter2: { type: 'highpass', freq: 450 }, dest })
      for (let k = 0; k < 5; k++) {
        const tt = t0 + rnd(b * 7.1 + k * 3.3) * barLen
        s.tone(2400 + rnd(b + k * 11) * 2600, tt, 0.015, { type: 'sine', gain: 0.012, a: 0.001, d: 0.015, s: 0, r: 0.02, slide: 0.6, pan: rnd(k * 5 + b) - 0.5, dest })
      }
      if (b === 0) {
        // the needle drops
        s.noise(t0 - 0.02, 0.012, { gain: 0.1, filter: { type: 'lowpass', freq: 2600 }, dest })
        s.tone(70, t0 - 0.02, 0.07, { type: 'sine', gain: 0.12, a: 0.001, d: 0.06, s: 0, r: 0.05, slide: 0.5, dest })
      }

      // Rhodes comping: the downbeat and a re-voicing on the "and of 3" in chord-change bars; in the
      // second bar of a chord, a lazy "and of 1", beat 3, and an anticipation of the next chord
      if (b === 15) {
        rhodes(s, vo.lo, T(0), st * 6, kg * 0.9, keys)
        tapeStop(s, vo.hi, T(8), st * 7, { gain: 0.05, to: 0.5, dest: keys, dry: dest, bassNote: 36 })
        for (const j of [13, 14, 15]) s.noise(T(j) + hu(j, 7) * 3, 0.006, { gain: 0.06, filter: { type: 'highpass', freq: 3000 }, dest })
      } else if (b === 14) {
        rhodes(s, vo.lo, T(0), st * 6, kg * 0.9, keys)
        rhodes(s, vo.hi, T(6), st * 4, kg * 0.55, keys)
        rhodes(s, V.C13.lo, T(14), st * 5, kg * 0.7, keys)
      } else if (b % 2 === 0) {
        rhodes(s, vo.lo, T(0), st * 9, kg * (b ? 0.85 : 1), keys)
        rhodes(s, vo.hi, T(10), st * 5, kg * 0.6, keys)
      } else {
        rhodes(s, vo.lo, T(2), st * 5, kg * 0.65, keys)
        rhodes(s, vo.hi, T(8), st * 5, kg * 0.85, keys)
        rhodes(s, V[CHORDS[(b + 1) % 16]].lo, T(14), st * 6, kg * 0.7, keys)
      }

      // bass
      for (const e of BASS.get(b) ?? []) {
        const j = e.i % 16
        if (b === 15 && j >= 8) continue
        const from = (b === 9 || b === 13) && j === 7 ? 2 : undefined
        bass(s, e.n, T(e.i) + hu(e.i, 1) * 0.5, e.len * st * 0.95, dest, 1, from)
      }

      // drums: boom-bap with the snare laid back, the "and of 3" kick pushed, and ±8 ms of slop on everything
      const live = b === 15 ? 8 : 16 // bar 15 drops out at the tape stop
      const kicks = hits(b % 2 && b >= 4 ? (second ? 'x......o..x...o.' : 'x......o..x.....') : 'x.........x.....')
      for (const [j, a] of kicks) if (j < live) kick(s, T(j) + hu(j, 2) - (j === 10 ? 0.004 : 0), a === 1 ? 1 : 0.5, dest)
      const snares = hits(second ? '....x..o....x..o' : b >= 4 && b % 2 ? '....x.......x..o' : '....x.......x...')
      for (const [j, a] of snares) {
        if (j >= live) continue
        const tt = T(j) + 0.012 + hu(j, 3)
        if (a === 1) snare(s, tt, 1, dest, kit)
        else ghost(s, tt, 1, dest)
      }
      if (second && b % 2 === 0) s.rim(T(12) + 0.012 + hu(12, 9), { gain: 0.09, dest })
      for (let j = 0; j < live; j++) {
        const off = j % 4 === 2
        if (j % 2) {
          // ghost sixteenths, from bar 4, about six in ten of them
          if (b < 4 || rnd(b * 53 + j * 7) < 0.4) continue
          hat(s, T(j) + hu(j, 4), 0.022, dest)
          continue
        }
        if (b < 2 && !off) continue
        if (second && b % 2 === 1 && j === 14) { hat(s, T(j) + hu(j, 4), 0.05, dest, true); continue }
        hat(s, T(j) - 0.004 + hu(j, 4), off ? 0.065 : 0.045, dest)
      }

      // the flute
      const mel = MELODY.get(b - 8)
      if (mel) for (const e of mel) flute(s, e.n, T(e.i) + 0.012 + hu(e.i, 5) * 0.6, e.len * st * 0.88, { gain: 0.07, dest: air, scoop: e.len >= 6, vib: e.len >= 4 ? 14 : 7, pan: 0.12 })
    },
  },
  sfx: {
    blip(s, t, ch, v, i) {
      if (!isLetter(ch)) return
      const deg = [0, 2, 4, 7, 9][letterDegree(ch, i) % 5]
      const pan = (rnd(i * 1.7 + (v.seed % 97)) - 0.5) * 0.5
      if (/[aeiouy]/i.test(ch)) {
        // a damped Rhodes tine for the vowels
        s.fm(v.base * 1.5 * Math.pow(2, deg / 12), t, 0.04, { ratio: 1, index: 1.4, indexEnd: 0.15, indexTime: 0.04, gain: 0.075, a: 0.002, d: 0.05, s: 0, r: 0.03, pan })
      } else {
        // a pencil tap on paper for the consonants
        s.tone(1400 + deg * 90 + (v.seed % 200), t, 0.012, { type: 'sine', gain: 0.07, a: 0.001, d: 0.012, s: 0, r: 0.012, slide: 0.8, pan })
        s.noise(t, 0.014, { gain: 0.05, filter: { type: 'bandpass', freq: 3200 + deg * 150, q: 1.5 }, pan })
      }
    },
    typed(s, t) {
      // the page settles, then two soft chimes
      s.noise(t, 0.22, { gain: 0.09, a: 0.03, d: 0.2, filter: { type: 'bandpass', freq: 700, to: 3500, time: 0.2, q: 1 } })
      s.fm(mtof(81), t + 0.1, 0.35, { ratio: 2, index: 0.9, indexEnd: 0.05, indexTime: 0.2, gain: 0.05, a: 0.003, d: 0.5, s: 0, r: 0.4, verb: 0.3, pan: -0.15 })
      s.fm(mtof(88), t + 0.19, 0.4, { ratio: 2, index: 0.9, indexEnd: 0.05, indexTime: 0.2, gain: 0.045, a: 0.003, d: 0.6, s: 0, r: 0.5, verb: 0.3, pan: 0.15 })
    },
    hover(s, t) { s.wood(t, 1180, { gain: 0.13 }) },
    mumble(s, t, label, v) {
      // three "mm-hm" syllables behind closed lips: the middle one lifts
      const letters = label.replace(/[^a-z]/gi, '').slice(0, 3) || 'mmm'
      let tt = t
      ;[...letters].forEach((ch, k) => {
        const deg = [0, 2, 4, 7, 9][ch.toLowerCase().charCodeAt(0) % 5]
        const up = k === 1
        s.tone(v.base * 0.8 * Math.pow(2, deg / 12), tt, 0.1, { type: 'triangle', gain: 0.075, a: 0.025, d: 0.1, s: 0.5, r: 0.05, slide: up ? 1.12 : 0.95, vib: { rate: 5, cents: 8 + v.wobble * 10 }, filter: { freq: 520, to: up ? 900 : 380, time: 0.1, q: 1.5 }, shaper: 1.5 })
        tt += 0.115
      })
    },
    select(s, t) {
      rhodes(s, chord('F4 A4'), t, 0.3, 0.085, undefined, { verb: 0.2 })
      s.tone(mtof(41), t, 0.12, { type: 'sine', gain: 0.2, a: 0.005, d: 0.12, s: 0.3, r: 0.06 })
    },
    drumroll(s, t, dur) {
      // brushes circle the snare faster and faster while the record spins back; it lands on a C7 stab
      let x = 0, gap = 0.11, k = 0
      while (x < dur - 0.02) {
        s.noise(t + x, 0.06, { gain: 0.05 + (x / dur) * 0.11, a: 0.004, d: 0.05, filter: { type: 'bandpass', freq: 2000 + rnd(k) * 600, q: 0.9 }, filter2: { type: 'highpass', freq: 900 }, pan: (rnd(k * 3) - 0.5) * 0.3 })
        x += gap; gap = Math.max(0.035, gap * 0.9); k++
      }
      s.noise(t, dur, { gain: 0.09, a: dur * 0.85, d: 0.1, s: 1, r: 0.05, filter: { type: 'bandpass', freq: 1800, q: 0.5 } })
      s.tone(90, t, dur, { type: 'sawtooth', gain: 0.05, a: dur * 0.4, d: 0.2, s: 1, r: 0.04, slide: 5, filter: { freq: 300, to: 3500, time: dur, q: 2 }, shaper: 2 })
      s.noise(t, dur, { gain: 0.07, a: dur * 0.7, d: 0.1, s: 1, r: 0.03, filter: { type: 'bandpass', freq: 400, to: 6000, time: dur, q: 1.5 } })
      kick(s, t + dur)
      snare(s, t + dur, 1.1)
      rhodes(s, chord('E3 G3 Bb3'), t + dur, 0.4, 0.055, undefined, { verb: 0.2 })
    },
    correct(s, t) {
      // a vinyl pop, then ii-V-I into a warm Fmaj9 with the bass and the kick, and the counter bell: order up
      s.noise(t, 0.01, { gain: 0.2, filter: { type: 'lowpass', freq: 3200 } })
      rhodes(s, V.G.hi, t, 0.2, 0.06, undefined, { verb: 0.2 })
      rhodes(s, V.C13.hi, t + 0.21, 0.2, 0.065, undefined, { verb: 0.2 })
      const r = t + 0.44
      rhodes(s, [...V.F.lo, 72], r, 1.3, 0.075, undefined, { bright: 2.4, verb: 0.25 })
      bass(s, 41, r, 1.1)
      kick(s, r, 0.9)
      hat(s, r, 0.05)
      hat(s, r + 0.39, 0.045)
      ding(s, r + 0.08, 0.045)
    },
    wrong(s, t) {
      // the tape slows to half speed with the filter closing, and a muted horn says wah-waah
      kick(s, t, 0.8)
      s.noise(t, 0.45, { gain: 0.08, a: 0.01, d: 0.4, filter: { type: 'bandpass', freq: 3000, to: 250, time: 0.45, q: 0.8 } })
      tapeStop(s, V.D.hi, t, 0.8, { gain: 0.055, to: 0.5, bassNote: 38, verb: 0.2 })
      wah(s, 69, t + 0.55, 0.3, true, { gain: 0.08, vib: 6 })
      wah(s, 68, t + 0.9, 0.85, false, { gain: 0.085, vib: 45, droop: 0.9 })
    },
    stamp(s, t, right) { cup(s, t, right) },
    crowd(s, t, right) {
      if (right) {
        // the regulars approve: a low murmur and three finger snaps in time
        s.noise(t, 1.1, { gain: 0.03, a: 0.25, d: 1, s: 0.6, r: 0.3, filter: { type: 'bandpass', freq: 420, q: 0.6 }, filter2: { type: 'lowpass', freq: 1400 } })
        choir(s, t + 0.05, 0.7, 'oh', { gain: 0.022, pitch: 150, slide: 1.04, voices: 5 })
        ;[0.18, 0.575, 0.97].forEach((d, k) => snap(s, t + d, 0.13 - k * 0.015, (k - 1) * 0.4))
      } else {
        choir(s, t + 0.1, 1.0, 'ah', { gain: 0.05, pitch: 205, slide: 0.86, voices: 6 })
        choir(s, t + 0.2, 0.9, 'oh', { gain: 0.025, pitch: 150, slide: 0.9, voices: 4 })
      }
    },
    page(s, t) {
      s.noise(t, 0.2, { gain: 0.11, a: 0.02, d: 0.18, filter: { type: 'bandpass', freq: 900, to: 4800, time: 0.18, q: 1.1 } })
      s.noise(t + 0.11, 0.05, { gain: 0.07, filter: { type: 'highpass', freq: 5000 } })
      s.tone(190, t + 0.17, 0.05, { type: 'sine', gain: 0.1, a: 0.002, d: 0.05, s: 0, r: 0.04, slide: 0.5 })
    },
    fanfare(s, t, ratio) {
      if (ratio >= 0.7) {
        // brushes swell, the Rhodes runs up Fmaj13 and lands on the chord with the kit, the bell and the flute
        s.noise(t, 0.42, { gain: 0.09, a: 0.36, d: 0.08, s: 1, r: 0.05, filter: { type: 'bandpass', freq: 2200, q: 0.7 }, filter2: { type: 'highpass', freq: 900 } })
        ;[53, 57, 60, 64, 67, 69, 72, 76].forEach((n, k) => rhodes(s, [n], t + 0.4 + k * 0.08, 0.5, 0.06, undefined, { verb: 0.2 }))
        const r = t + 1.08
        rhodes(s, [...V.F.lo, 72, 76], r, 1.6, 0.065, undefined, { bright: 2.4, verb: 0.25 })
        bass(s, 41, r, 1.6)
        kick(s, r)
        snare(s, r, 0.9)
        ding(s, r + 0.06, 0.05)
        flute(s, 67, r + 0.05, 0.2, { gain: 0.075, verb: 0.25 })
        flute(s, 69, r + 0.3, 1.1, { gain: 0.08, vib: 16, verb: 0.25 })
        for (const d of [0.395, 0.79, 1.19]) hat(s, r + d, 0.045)
        s.rim(r + 1.38, { gain: 0.12 })
        snare(s, r + 1.58, 0.8)
      } else if (ratio >= 0.4) {
        // the two-chord shrug: ii, V, and nothing after it but a "hm?" and one snap
        rhodes(s, V.G.lo, t, 0.5, 0.07, undefined, { verb: 0.2 })
        bass(s, 43, t, 0.5)
        hat(s, t, 0.045)
        rhodes(s, V.C13.lo, t + 0.55, 1.0, 0.065, undefined, { verb: 0.2 })
        bass(s, 36, t + 0.55, 0.9)
        hat(s, t + 0.55, 0.045)
        s.tone(190, t + 1.15, 0.22, { type: 'triangle', gain: 0.07, a: 0.03, d: 0.2, s: 0.5, r: 0.08, slide: 1.2, vib: { rate: 5, cents: 12 }, filter: { freq: 500, to: 1100, time: 0.22, q: 1.5 }, shaper: 1.5 })
        snap(s, t + 1.5, 0.1)
        cup(s, t + 1.8, true)
      } else {
        // the tape stops for good, the dust settles, and somebody puts the cup down
        kick(s, t, 0.9)
        tapeStop(s, V.D.hi, t, 1.7, { gain: 0.05, to: 0.3, bassNote: 38, verb: 0.2 })
        s.noise(t + 1.5, 0.3, { gain: 0.05, a: 0.05, d: 0.25, filter: { type: 'highpass', freq: 3000 } })
        cup(s, t + 2.05, false)
      }
    },
  },
}
