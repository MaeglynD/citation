// Render every sound theme offline in headless Chromium and report levels, clipping and a spectrogram PNG.
// usage: node scripts/audio-qa.mjs [url] [themeId ...] [--seconds N]   (default 24 s of music)
import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { encodePNG } from './png.mjs'

const url = process.argv[2] && process.argv[2].startsWith('http') ? process.argv[2] : 'http://127.0.0.1:5180/'
const secArg = process.argv.indexOf('--seconds')
const seconds = secArg > 0 ? Number(process.argv[secArg + 1]) : 24
const only = process.argv.slice(2).filter((a, i, arr) => !a.startsWith('http') && a !== '--seconds' && arr[i - 1] !== '--seconds')
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction(() => typeof window.__renderThemeOffline === 'function', null, { timeout: 20000 })
const themes = only.length ? only : ['arcade']
const reports = {}
fs.mkdirSync('shots/audio', { recursive: true })

for (const id of themes) {
  const res = await page.evaluate(async ({ id, seconds }) => {
    const { music, sfx, sampleRate } = await window.__renderThemeOffline(id, seconds, 22050)
    function analyse(x) {
      let peak = 0, sum = 0, clip = 0
      for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; sum += x[i] * x[i]; if (a > 0.98) clip++ }
      const rms = Math.sqrt(sum / x.length)
      // spectrogram: 1024-point FFT, hop 512, 96 log-spaced bins from 40 Hz to Nyquist
      const N = 1024, hop = 512, bins = 96
      const frames = Math.floor((x.length - N) / hop)
      const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N))
      const spec = []
      let centroidSum = 0, centroidW = 0, silent = 0
      const re = new Float32Array(N), im = new Float32Array(N)
      for (let f = 0; f < frames; f++) {
        for (let i = 0; i < N; i++) { re[i] = x[f * hop + i] * win[i]; im[i] = 0 }
        // iterative radix-2 FFT
        for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] } }
        for (let len = 2; len <= N; len <<= 1) {
          const ang = (-2 * Math.PI) / len
          for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) {
            const wr = Math.cos(ang * k), wi = Math.sin(ang * k)
            const ur = re[i + k], ui = im[i + k]
            const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi, vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr
            re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi
          }
        }
        const row = new Array(bins).fill(0)
        let e = 0, c = 0
        for (let k = 1; k < N / 2; k++) {
          const mag = Math.hypot(re[k], im[k])
          const hz = (k * sampleRate) / N
          const b = Math.floor((Math.log(Math.max(hz, 40) / 40) / Math.log(sampleRate / 2 / 40)) * bins)
          if (b >= 0 && b < bins) row[b] = Math.max(row[b], mag)
          e += mag; c += mag * hz
        }
        if (e > 1e-3) { centroidSum += c; centroidW += e } else silent++
        spec.push(row.map((m) => Math.max(-90, 20 * Math.log10(m / N + 1e-9))))
      }
      // per-second loudness so dropouts and lopsided arrangements show up in text
      const secs = []
      for (let s0 = 0; s0 + sampleRate <= x.length; s0 += sampleRate) { let e2 = 0; for (let i = s0; i < s0 + sampleRate; i++) e2 += x[i] * x[i]; secs.push(Math.round(20 * Math.log10(Math.sqrt(e2 / sampleRate) + 1e-9))) }
      return { peak, rms, rmsDb: 20 * Math.log10(rms + 1e-9), clip, centroid: centroidSum / (centroidW || 1), silentPct: (100 * silent) / Math.max(1, frames), spec, secs }
    }
    return { music: analyse(music), sfx: analyse(sfx) }
  }, { id, seconds })
  // PNG: music on top, sfx below; time left to right, frequency bottom to top
  const draw = (A) => A.spec
  const W = Math.max(res.music.spec.length, res.sfx.spec.length), Hh = 96 * 2 + 4
  const img = new Uint8ClampedArray(W * Hh * 4)
  const put = (spec, y0) => spec.forEach((row, x) => row.forEach((db, b) => {
    const v = Math.max(0, Math.min(1, (db + 90) / 80))
    const y = y0 + 95 - b
    const k = (y * W + x) * 4
    img[k] = Math.round(255 * Math.min(1, v * 1.6)); img[k + 1] = Math.round(255 * Math.max(0, v * 1.4 - 0.4)); img[k + 2] = Math.round(255 * (0.25 + 0.5 * (1 - v)) * (v > 0.05 ? 1 : 0.3)); img[k + 3] = 255
  }))
  for (let i = 0; i < img.length; i += 4) img[i + 3] = 255
  put(draw(res.music), 0)
  put(draw(res.sfx), 100)
  fs.writeFileSync(`shots/audio/${id}.png`, encodePNG(W, Hh, img))
  const fmt = (a) => `peak ${a.peak.toFixed(2)}  rms ${a.rmsDb.toFixed(1)} dB  clipped ${a.clip}  centroid ${Math.round(a.centroid)} Hz  silent ${a.silentPct.toFixed(0)}%`
  for (const kind of ['music', 'sfx']) {
    const { spec, ...metrics } = res[kind]
    assert(Number.isFinite(metrics.rmsDb) && metrics.peak > 0, `${id} ${kind} must render sound`)
    assert.equal(metrics.clip, 0, `${id} ${kind} clips`)
    reports[id] ??= {}
    reports[id][kind] = metrics
  }
  console.log(`${id.padEnd(10)} music: ${fmt(res.music)}\n${' '.repeat(10)}        per-second dB: ${res.music.secs.join(' ')}\n${' '.repeat(10)} sfx:   ${fmt(res.sfx)}\n${' '.repeat(10)}        per-second dB: ${res.sfx.secs.join(' ')}`)
}
const levels = Object.values(reports).map(r => r.music.rmsDb)
assert(Math.max(...levels) - Math.min(...levels) < 3, 'Theme music levels differ by more than 3 dB')
fs.writeFileSync('shots/audio/report.json', JSON.stringify(reports, null, 2))
await browser.close()
