import type { Synth } from './core'
import { isLetter, rnd, type Voice } from './themes/helpers'

// Original nonsense speech: a low, grainy throat tone through moving vowel
// resonances. Quote-based voices avoid hinting at the speaker's identity.
const VOWELS: [number, number][] = [[730, 1090], [530, 1840], [300, 2180], [570, 840], [340, 990]]

export function dialogueBlip(s: Synth, t: number, ch: string, v: Voice, i: number) {
  if (!isLetter(ch)) return
  const letter = ch.toLowerCase(), vowel = 'aeiou'.indexOf(letter)
  const variation = rnd(v.seed + i * 37)
  const formants = VOWELS[vowel >= 0 ? vowel : (letter.charCodeAt(0) + v.seed) % VOWELS.length]
  const pitch = (105 + v.seed % 110) * Math.pow(2, (variation - .5) * .45)
  const throat = .8 + rnd(v.seed + 17) * .35
  const dur = vowel >= 0 ? .062 : .043
  const slide = .82 + variation * .33

  for (let band = 0; band < 2; band++) {
    const freq = formants[band] * throat
    s.tone(pitch, t, dur, {
      type: 'reed', bits: 5, gain: band === 0 ? .32 : .2,
      a: .006, d: .035, s: .65, r: .025, slide,
      filter: { type: 'bandpass', freq: freq * 1.15, to: freq * .88, q: band === 0 ? 2 : 3 },
      filter2: { type: 'lowpass', freq: 3200, q: .7 },
    })
  }
  s.tone(pitch, t, dur, { type: 'triangle', gain: .07, a: .006, r: .02, slide })
  if (vowel < 0) s.noise(t, .016, { gain: .018, a: .004, r: .014, filter: { type: 'bandpass', freq: 1500, q: .7 } })
}
