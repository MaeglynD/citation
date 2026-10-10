import { Synth, mtof, note } from '../core'
import { type Theme, line, byBar, chord, rnd, choir, applause, send, letterDegree, isLetter } from './helpers'

/**
 * MIDNIGHT: synthwave. A pumping octave bass under a sidechained supersaw pad, a two-octave
 * arpeggio through a dotted-eighth delay, gated snares, and a lead that only arrives for the
 * second half of the loop. A minor, 104 BPM.
 */

const BPM = 104
const DOTTED = (60 / BPM) * 0.75

const PROG = ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E']
const VOICING: Record<string, number[]> = {
  Am: chord('A3 C4 E4 A4'), F: chord('F3 C4 F4 A4'), C: chord('G3 C4 E4 G4'),
  G: chord('G3 B3 D4 G4'), Dm: chord('F3 A3 D4 F4'), E: chord('E3 G#3 B3 E4'),
}
const ROOT: Record<string, number> = { Am: note('A1'), F: note('F1'), C: note('C2'), G: note('G1'), Dm: note('D2'), E: note('E1') }

// the lead, bars 8..15
const LEAD = byBar(line(`
A4 - - - C5 - - - E5 - - - - - D5 - |
C5 - - - - - - - A4 - - - C5 - - - |
G4 - - - - - - - E5 - - - D5 - - - |
B4 - - - - - - - - - - - D5 - E5 - |
E5 - - - - - - - C5 - - - A4 - - - |
A4 - - - - - C5 - - - - - F5 - - - |
D5 - - - - - - - F5 - - - E5 - D5 - |
B4 - - - - - - - - - - - G#4 - - - |`))

const bass = (s: Synth, n: number, t: number, len: number, dest: AudioNode, g = 0.18) => {
  s.tone(mtof(n), t, len, { type: 'sawtooth', gain: g, a: 0.003, d: 0.12, s: 0.6, r: 0.03, filter: { freq: 900, to: 260, time: 0.12, q: 1.4 }, dest })
  s.tone(mtof(n), t, len, { type: 'sine', gain: g * 0.9, a: 0.003, r: 0.03, dest })
}
const pad = (s: Synth, ns: number[], t: number, len: number, dest: AudioNode, g = 0.028) =>
  ns.forEach((n, k) => s.supersaw(mtof(n), t, len, { voices: 5, spread: 16, gain: g, a: 0.35, d: 0.5, s: 1, r: 0.4, filter: { freq: 1400, q: 0.9 }, pan: (k - 1.5) * 0.3, dest }))
const arp = (s: Synth, n: number, t: number, dest: AudioNode, g = 0.055, pan = 0) =>
  s.tone(mtof(n), t, 0.11, { type: 'pulse25', gain: g, a: 0.002, d: 0.1, s: 0.3, r: 0.04, filter: { freq: 3200, to: 700, time: 0.12, q: 2 }, pan, dest })
const lead = (s: Synth, n: number, t: number, len: number, dest: AudioNode, g = 0.085) =>
  s.supersaw(mtof(n), t, len, { voices: 3, spread: 9, gain: g, a: 0.02, d: 0.3, s: 0.85, r: 0.12, filter: { freq: 2600, q: 1.1 }, vib: { rate: 5.5, cents: 10, delay: 0.18 }, dest })
const gatedSnare = (s: Synth, t: number, dest: AudioNode, g = 0.3, verb?: number) => {
  s.noise(t, 0.2, { gain: g, a: 0.001, d: 0.2, s: 0.55, r: 0.015, filter: { type: 'highpass', freq: 900 }, filter2: { type: 'lowpass', freq: 7000 }, dest, verb })
  s.tone(185, t, 0.08, { type: 'triangle', gain: g * 0.6, slide: 0.6, r: 0.03, dest })
  for (const dt of [0, 0.011, 0.023]) s.noise(t + dt, 0.025, { gain: g * 0.35, filter: { type: 'bandpass', freq: 1800, q: 1 }, dest })
}
const stab = (s: Synth, ns: number[], t: number, len: number, g = 0.05, dest?: AudioNode) =>
  ns.forEach((n, k) => s.supersaw(mtof(n), t, len, { voices: 5, spread: 16, gain: g, a: 0.01, d: 0.3, s: 0.6, r: 0.2, filter: { freq: 4200, to: 1000, time: len, q: 1.2 }, pan: (k - 1.5) * 0.2, verb: 0.3, dest }))
const bell = (s: Synth, n: number, t: number, g = 0.06, pan = 0) =>
  s.fm(mtof(n), t, 0.3, { ratio: 3, index: 1.5, indexEnd: 0.1, gain: g, a: 0.002, d: 0.5, s: 0, r: 0.3, pan, verb: 0.3 })

export const midnight: Theme = {
  id: 'midnight',
  name: 'MIDNIGHT',
  musicGain: 0.62,
  sfxGain: 1.0,
  song: {
    bpm: BPM,
    bars: 16,
    bar(s, b, t0, st, dest) {
      const T = (i: number) => t0 + i * st
      const name = PROG[b]
      const vo = VOICING[name]
      const root = ROOT[name]
      const second = b >= 8
      const echo = send(dest, 'echo', () => s.delayBus(dest, DOTTED, 0.38, 0.28, 2600))
      const hall = send(dest, 'hall', () => s.reverbBus(dest, 1.6, 3.5, 0.45))
      // the pad rides a per-bar gain that dips on every beat: the sidechain pump
      const pump = s.ctx.createGain()
      pump.connect(dest)
      pump.gain.setValueAtTime(0.3, t0)
      for (let k = 0; k < 4; k++) { const tb = T(k * 4); pump.gain.setValueAtTime(0.3, tb); pump.gain.linearRampToValueAtTime(1, tb + st * 2.6) }
      pad(s, vo, t0, st * 16, pump, b < 2 ? 0.02 : 0.028)
      // eighth-note bass on the root, an octave jump before beats 2 and 4
      for (let j = 0; j < 16; j += 2) bass(s, root, T(j), st * 1.6, dest)
      for (const j of [7, 15]) bass(s, root + 12, T(j), st * 0.9, dest, 0.12)
      // arpeggio up through two octaves of the chord and back down
      if (b >= 2) {
        const tones = [...vo, ...vo.map((n) => n + 12)]
        const order = [0, 1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3, 2, 1, 0]
        order.forEach((ix, j) => arp(s, tones[ix], T(j), echo, second ? 0.04 : 0.055, j % 2 ? 0.35 : -0.35))
      }
      const mel = LEAD.get(b - 8)
      if (mel) for (const e of mel) lead(s, e.n, T(e.i), e.len * st * 0.92, echo)
      // drums
      s.kick(T(0), { gain: 0.6, pitch: 120, decay: 0.26, dest })
      s.kick(T(8), { gain: 0.6, pitch: 120, decay: 0.26, dest })
      if (b % 2 === 1) s.kick(T(10), { gain: 0.4, pitch: 120, decay: 0.22, dest })
      gatedSnare(s, T(4), hall)
      gatedSnare(s, T(12), hall)
      for (let j = 0; j < 16; j += 2) s.hat(T(j), { gain: j % 4 === 2 ? 0.07 : 0.04, dest })
      s.hat(T(14), { gain: 0.05, open: true, dest })
      if (b % 8 === 7) [200, 160, 130, 105].forEach((f, k) => s.tone(f, T(12 + k), 0.22, { type: 'sine', gain: 0.35, slide: 0.6, r: 0.08, dest: hall }))
      if (b % 8 === 0) s.cymbal(T(0), { gain: 0.08, decay: 1.2, base: 300, dest: hall })
    },
  },
  sfx: {
    blip(s, t, ch, v, i) {
      if (!isLetter(ch)) return
      const deg = [0, 3, 5, 7, 10, 12][letterDegree(ch, i) % 6]
      const vowel = /[aeiouy]/i.test(ch)
      const f = v.base * 1.6 * Math.pow(2, deg / 12) * (vowel ? 1.5 : 1)
      s.fm(f, t, 0.045, { ratio: 2, index: 1.4, indexEnd: 0.1, indexTime: 0.05, gain: 0.08, a: 0.002, d: 0.05, s: 0, r: 0.03, pan: (rnd(i) - 0.5) * 0.4 })
    },
    typed(s, t) {
      s.fm(1760, t, 0.12, { ratio: 1.5, index: 1, indexEnd: 0.1, gain: 0.06, a: 0.002, d: 0.2, s: 0, r: 0.15, verb: 0.3 })
      s.fm(2637, t + 0.07, 0.2, { ratio: 1.5, index: 1, indexEnd: 0.1, gain: 0.06, a: 0.002, d: 0.3, s: 0, r: 0.25, verb: 0.3 })
    },
    hover(s, t) { s.tone(1480, t, 0.035, { type: 'sawtooth', gain: 0.05, a: 0.002, r: 0.03, filter: { freq: 3000, to: 900, time: 0.04 } }) },
    mumble(s, t, label, v) {
      let tt = t
      for (const ch of label.replace(/[^a-z]/gi, '').slice(0, 3)) {
        const deg = [0, 3, 5, 7, 10][ch.toLowerCase().charCodeAt(0) % 5]
        s.fm(v.base * 1.2 * Math.pow(2, deg / 12), tt, 0.06, { ratio: 2, index: 1.2, indexEnd: 0.1, gain: 0.05, a: 0.003, d: 0.08, s: 0, r: 0.04 })
        tt += 0.07
      }
    },
    select(s, t) {
      chord('A3 E4 A4').forEach((n) => s.supersaw(mtof(n), t, 0.16, { voices: 5, spread: 18, gain: 0.05, a: 0.004, d: 0.2, s: 0.4, r: 0.1, filter: { freq: 3800, to: 500, time: 0.2, q: 1.5 }, verb: 0.25 }))
      s.kick(t, { gain: 0.3, pitch: 110, decay: 0.16 })
    },
    drumroll(s, t, dur) {
      let x = 0, gap = 0.1
      while (x < dur) { s.noise(t + x, 0.05, { gain: 0.08 + (x / dur) * 0.12, filter: { type: 'highpass', freq: 1200 }, filter2: { type: 'lowpass', freq: 6000 } }); x += gap; gap = Math.max(0.03, gap * 0.9) }
      s.noise(t, dur + 0.1, { gain: 0.1, a: dur * 0.9, d: 0.1, s: 1, r: 0.08, filter: { type: 'bandpass', freq: 300, to: 5000, time: dur, q: 1.2 } })
      s.tone(55, t, dur, { type: 'sawtooth', gain: 0.1, a: dur * 0.6, s: 1, r: 0.05, slide: 2, filter: { freq: 200, to: 1800, time: dur } })
    },
    correct(s, t) {
      // victory brass: a bright C major stab, a gated snare, then bells climbing the chord
      stab(s, chord('C4 E4 G4 C5'), t, 0.55)
      gatedSnare(s, t, s.sfx, 0.22, 0.4)
      ;[72, 76, 79, 84, 88, 91].forEach((n, i) => bell(s, n, t + 0.12 + i * 0.07, 0.07, (i - 2.5) * 0.15))
    },
    wrong(s, t) {
      // the tape slows and the lights go out
      for (const n of chord('E3 Bb3 E4')) s.supersaw(mtof(n), t, 0.9, { voices: 4, spread: 30, gain: 0.06, a: 0.01, d: 0.4, s: 0.8, r: 0.2, slide: 0.5, filter: { freq: 2500, to: 200, time: 0.9, q: 1.5 }, verb: 0.3 })
      s.tone(220, t + 0.1, 1.0, { type: 'square', gain: 0.07, slide: 0.18, bits: 5, filter: { freq: 1200, to: 150, time: 1.0 }, r: 0.1 })
      s.kick(t, { gain: 0.5, pitch: 90, decay: 0.5 })
    },
    stamp(s, t) {
      s.noise(t, 0.22, { gain: 0.3, a: 0.001, d: 0.25, s: 0.6, r: 0.015, filter: { type: 'lowpass', freq: 4000 }, verb: 0.35 })
      s.tone(130, t, 0.2, { type: 'sine', gain: 0.5, slide: 0.35, r: 0.08 })
    },
    crowd(s, t, right) {
      if (right) { choir(s, t + 0.1, 0.8, 'ah', { gain: 0.05, pitch: 220, slide: 1.06 }); applause(s, t + 0.4, 1.1, 35, 0.045) }
      else choir(s, t + 0.15, 1.0, 'oo', { gain: 0.06, pitch: 175, slide: 0.86 })
    },
    page(s, t) {
      s.noise(t, 0.26, { gain: 0.08, a: 0.02, filter: { type: 'bandpass', freq: 500, to: 5000, q: 1.2 } })
      s.tone(1800, t, 0.18, { type: 'sine', gain: 0.06, slide: 0.15, r: 0.05 })
    },
    fanfare(s, t, ratio) {
      if (ratio >= 0.7) {
        stab(s, chord('A3 C4 E4 A4'), t, 0.22)
        stab(s, chord('F3 A3 C4 F4'), t + 0.3, 0.22)
        stab(s, chord('G3 B3 D4 G4'), t + 0.6, 0.22)
        stab(s, chord('C4 E4 G4 C5'), t + 0.9, 1.6, 0.06)
        gatedSnare(s, t + 0.9, s.sfx, 0.25, 0.4)
        ;[60, 64, 67, 72, 76, 79, 84].forEach((n, i) => bell(s, n, t + 1.0 + i * 0.08, 0.06))
      } else if (ratio >= 0.4) {
        stab(s, chord('F3 A3 C4 F4'), t, 0.4)
        stab(s, chord('C4 E4 G4 C5'), t + 0.5, 1.2, 0.055)
      } else {
        for (const n of chord('E3 G3 B3')) s.supersaw(mtof(n), t, 1.8, { voices: 4, spread: 24, gain: 0.05, a: 0.05, d: 0.5, s: 0.8, r: 0.4, slide: 0.84, filter: { freq: 1800, to: 180, time: 1.8 }, verb: 0.35 })
      }
    },
  },
}
