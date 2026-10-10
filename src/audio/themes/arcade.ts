import { mtof } from '../core'
import { type Theme, isLetter, rnd, applause } from './helpers'

// ---------------------------------------------------------------------------
// ARCADE: the original quiz-show chiptune, preserved as it was

const C_LEAD: (number | null)[] = [
  76, 79, 84, null, 79, null, 76, null, 74, 76, 77, null, 76, null, 72, null,
  69, 72, 76, null, 72, null, 69, null, 67, 69, 71, null, 72, null, null, null,
  65, 69, 72, null, 69, null, 65, null, 67, null, 71, null, 74, null, null, null,
  72, 76, 79, null, 84, null, null, null, 83, 79, 76, 72, 74, null, null, null,
  76, null, 79, null, 84, 83, 84, null, 79, null, 76, null, 74, 72, 74, null,
  69, null, 72, null, 76, 74, 76, null, 72, null, 69, null, 67, null, null, null,
  65, 69, 72, 77, 76, 72, 69, 65, 67, 71, 74, 79, 77, 74, 71, 67,
  72, null, null, 76, null, null, 79, null, 84, null, null, null, null, null, null, null,
]
const C_BASS: number[] = [
  48, 48, 43, 48, 48, 48, 43, 47, 45, 45, 40, 45, 45, 45, 40, 43,
  41, 41, 36, 41, 41, 41, 36, 40, 43, 43, 38, 43, 43, 47, 50, 47,
  48, 48, 43, 48, 48, 48, 43, 47, 45, 45, 40, 45, 45, 45, 40, 43,
  41, 41, 36, 41, 41, 41, 36, 40, 43, 43, 38, 43, 43, 47, 50, 47,
]

export const arcade: Theme = {
  id: 'arcade',
  name: 'ARCADE',
  musicGain: 1.12,
  sfxGain: 1.0,
  song: {
    bpm: 138,
    bars: 8,
    bar(s, b, t0, st, dest) {
      for (let j = 0; j < 16; j++) {
        const i = b * 16 + j
        const t = t0 + j * st
        const lead = C_LEAD[i]
        if (lead !== null) {
          let len = 1
          while (i + len < C_LEAD.length && C_LEAD[i + len] === null && len < 3) len++
          s.tone(mtof(lead), t, st * len * 0.9, { type: 'square', gain: 0.11, r: 0.03, vib: { rate: 6, cents: 8 }, dest })
        }
        if (j % 2 === 0) s.tone(mtof(C_BASS[(i / 2) % C_BASS.length]), t, st * 1.7, { type: 'triangle', gain: 0.22, r: 0.04, dest })
        if (j % 2 === 0) s.noise(t, 0.03, { gain: 0.05, filter: { type: 'highpass', freq: 7000 }, dest })
        if (j % 8 === 4) s.noise(t, 0.09, { gain: 0.11, filter: { type: 'bandpass', freq: 1800, q: 0.6 }, dest })
        if (j % 8 === 0) s.tone(55, t, 0.09, { type: 'sine', gain: 0.25, slide: 0.5, dest })
      }
    },
  },
  sfx: {
    blip(s, t, ch, v) {
      if (!isLetter(ch)) return
      const vowel = /[aeiouy]/i.test(ch)
      const semis = ((ch.toLowerCase().charCodeAt(0) * 7) % 12) - 6
      const f = v.base * Math.pow(2, semis / 24) * (vowel ? 1.3 : 1)
      s.tone(f, t, 0.055, { type: v.wave, gain: 0.12, a: 0.004, r: 0.02, slide: vowel ? 1.1 : 0.85, filter: { type: 'lowpass', freq: 2600 } })
    },
    typed() {},
    hover(s, t) { s.tone(880, t, 0.04, { type: 'square', gain: 0.07, slide: 1.3 }) },
    mumble(s, t, label, v) {
      let tt = t
      for (const ch of label.replace(/[^a-z]/gi, '').slice(0, 4)) {
        const vowel = /[aeiouy]/i.test(ch)
        const semis = ((ch.toLowerCase().charCodeAt(0) * 7) % 12) - 6
        s.tone(v.base * 0.8 * Math.pow(2, semis / 24) * (vowel ? 1.3 : 1), tt, 0.05, { type: v.wave, gain: 0.07, a: 0.004, r: 0.02, slide: vowel ? 1.1 : 0.85, filter: { type: 'lowpass', freq: 2200 } })
        tt += 0.055
      }
    },
    select(s, t) { s.tone(660, t, 0.06, { type: 'square', gain: 0.12 }); s.tone(990, t + 0.06, 0.09, { type: 'square', gain: 0.12 }) },
    drumroll(s, t, dur) {
      let x = 0, gap = 0.085
      while (x < dur) { s.noise(t + x, 0.05, { gain: 0.16, filter: { type: 'bandpass', freq: 1800 + rnd(x * 100) * 600, q: 1.2 } }); x += gap; gap = Math.max(0.028, gap * 0.9) }
      s.noise(t + dur, 0.35, { gain: 0.14, filter: { type: 'highpass', freq: 5000 } })
    },
    correct(s, t) {
      ;[72, 76, 79, 84, 88].forEach((n, i) => s.tone(mtof(n), t + i * 0.055, 0.14, { type: 'square', gain: 0.14, r: 0.06 }))
      s.tone(mtof(96), t + 0.3, 0.3, { type: 'triangle', gain: 0.12, vib: { rate: 6, cents: 10 } })
    },
    wrong(s, t) {
      s.tone(110, t, 0.35, { type: 'sawtooth', gain: 0.16, filter: { freq: 900 }, vib: { rate: 6, cents: 180 } })
      s.tone(113, t, 0.35, { type: 'square', gain: 0.08, filter: { freq: 700 } })
      ;[62, 61, 60, 59].forEach((n, i) => {
        const d = i === 3 ? 0.7 : 0.22
        s.tone(mtof(n), t + 0.4 + i * 0.26, d, { type: 'sawtooth', gain: 0.1, filter: { freq: 1400 }, vib: { rate: 6, cents: i === 3 ? 60 : 15 }, slide: i === 3 ? 0.93 : 0.985, a: 0.03, r: 0.08 })
      })
    },
    stamp(s, t) { s.tone(90, t, 0.16, { type: 'sine', gain: 0.5, slide: 0.4, r: 0.1 }); s.noise(t, 0.08, { gain: 0.25, filter: { type: 'lowpass', freq: 1200 } }) },
    crowd(s, t, right) {
      s.noise(t, 0.4, { gain: 0.18, a: 0.15, filter: { type: 'bandpass', freq: 500, to: 1800, q: 0.8 } })
      if (right) applause(s, t + 0.35, 1.3)
      else { s.tone(196, t + 0.45, 0.55, { type: 'triangle', gain: 0.08, slide: 0.84, vib: { rate: 6, cents: 25 }, a: 0.08, r: 0.2 }); s.tone(247, t + 0.45, 0.55, { type: 'triangle', gain: 0.06, slide: 0.84, vib: { rate: 6, cents: 25 }, a: 0.08, r: 0.2 }) }
    },
    page(s, t) { s.noise(t, 0.18, { gain: 0.12, filter: { type: 'lowpass', freq: 3000, to: 300 } }); s.tone(220, t, 0.08, { type: 'triangle', gain: 0.1, slide: 2.5 }) },
    fanfare(s, t, ratio) {
      if (ratio >= 0.7) {
        const seq = [72, 72, 72, 76, 79, 76, 79, 84], dur = [0.1, 0.1, 0.1, 0.25, 0.25, 0.12, 0.12, 0.8]
        let tt = t
        seq.forEach((n, i) => { s.tone(mtof(n), tt, dur[i], { type: 'square', gain: 0.14, r: 0.05 }); s.tone(mtof(n - 12), tt, dur[i], { type: 'triangle', gain: 0.12, r: 0.05 }); tt += dur[i] + 0.03 })
      } else if (ratio >= 0.4) [67, 71, 74, 79].forEach((n, i) => s.tone(mtof(n), t + i * 0.12, 0.3, { type: 'square', gain: 0.12 }))
      else [64, 63, 62, 55].forEach((n, i) => s.tone(mtof(n), t + i * 0.28, i === 3 ? 0.9 : 0.25, { type: 'sawtooth', gain: 0.1, filter: { freq: 1200 }, vib: { rate: 6, cents: i === 3 ? 50 : 10 }, slide: i === 3 ? 0.9 : 1 }))
    },
  },
}

